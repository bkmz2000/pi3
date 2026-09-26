import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

function touchAt(path: string, epoch: number): void {
  writeFileSync(path, 'encrypted fixture');
  utimesSync(path, epoch, epoch);
}

describe('release script safety regressions', () => {
  jest.setTimeout(15_000);

  it('retries health probes until a starting service becomes ready', async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(requests < 3 ? 503 : 200, { connection: 'close' });
      response.end(requests < 3 ? 'starting' : '{"status":"ok"}');
    });
    try {
      await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
      const result = await run('sh', [
        'scripts/deploy-vps.sh', '--wait-for-health',
        `http://127.0.0.1:${address.port}/api/health`, 'candidate image', '8', '1',
      ]);
      expect(result.code).toBe(0);
      expect(requests).toBe(3);
      expect(result.stdout).toContain('healthy after 3 probe(s)');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    }
  });

  it('fails a bounded readiness wait when a service never becomes healthy', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(503, { connection: 'close' });
      response.end('not ready');
    });
    try {
      await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
      const started = Date.now();
      const result = await run('sh', [
        'scripts/deploy-vps.sh', '--wait-for-health',
        `http://127.0.0.1:${address.port}/api/health`, 'candidate image', '1', '1',
      ]);
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('did not become healthy within 1s');
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    }
  });

  it('fails closed on every unresolved deployment marker, including an unknown prior SHA', async () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'pi3-pending-state-test-'));
    const markers = [
      '.pi3-compose.rollback',
      '.pi3-previous-image',
      '.pi3-previous-release-sha',
      '.pi3-canary-passed-at',
    ];
    try {
      const args = ['scripts/deploy-vps.sh', '--assert-no-pending-state', stateDir];
      expect((await run('sh', args)).code).toBe(0);
      for (const marker of markers) {
        const markerPath = join(stateDir, marker);
        writeFileSync(markerPath, marker === '.pi3-previous-release-sha' ? 'unknown\n' : 'pending\n');
        const blocked = await run('sh', args);
        expect(blocked.code).not.toBe(0);
        expect(blocked.stderr).toContain(marker);
        rmSync(markerPath);
      }
      symlinkSync(join(stateDir, 'missing-target'), join(stateDir, '.pi3-compose.rollback'));
      const danglingMarker = await run('sh', args);
      expect(danglingMarker.code).not.toBe(0);
      expect(danglingMarker.stderr).toContain('.pi3-compose.rollback');
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it('validates the local age identity and binds the configured recipient before promotion', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'pi3-age-identity-test-'));
    const bin = join(temp, 'bin');
    const identity = join(temp, 'identity.txt');
    const recipient = 'age1' + 'a'.repeat(58);
    mkdirSync(bin);
    writeFileSync(identity, 'AGE-SECRET-KEY-1-TEST-FIXTURE\n');
    chmodSync(identity, 0o600);
    const fakeAgeKeygen = join(bin, 'age-keygen');
    writeFileSync(fakeAgeKeygen, '#!/bin/sh\n[ "$1" = -y ] && [ -f "$2" ] || exit 4\n[ "${TEST_AGE_FAIL:-0}" = 0 ] || exit 9\nprintf "%s\\n" "$TEST_DERIVED_RECIPIENT"\n');
    chmodSync(fakeAgeKeygen, 0o755);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, TEST_DERIVED_RECIPIENT: recipient };
    try {
      const check = async (expected: string, testEnv = env) => run('bash', ['scripts/verify-age-recipient.sh', identity, expected], testEnv);
      expect((await check(recipient)).code).toBe(0);
      const missingIdentity = await run('bash', ['scripts/verify-age-recipient.sh', join(temp, 'missing'), recipient], env);
      expect(missingIdentity.code).not.toBe(0);
      const symlink = join(temp, 'identity-link');
      writeFileSync(symlink, '');
      rmSync(symlink);
      symlinkSync(identity, symlink);
      expect((await run('bash', ['scripts/verify-age-recipient.sh', symlink, recipient], env)).code).not.toBe(0);
      const deriveFailure = await check(recipient, { ...env, TEST_AGE_FAIL: '1' });
      expect(deriveFailure.stderr).toContain('could not derive');
      const mismatch = await check('age1' + 'b'.repeat(58));
      expect(mismatch.code).not.toBe(0);
      expect(mismatch.stderr).toContain('does not match');
      expect((await check(recipient, { ...env, TEST_DERIVED_RECIPIENT: `${recipient}\n${recipient}` })).code).not.toBe(0);
      chmodSync(identity, 0o644);
      expect((await check(recipient)).stderr).toContain('mode 600');
      chmodSync(identity, 0o600);
      const noAgeBin = join(temp, 'no-age-bin');
      mkdirSync(noAgeBin);
      for (const utility of ['bash', 'stat', 'id']) {
        const resolved = execFileSync('which', [utility], { encoding: 'utf8' }).trim();
        symlinkSync(resolved, join(noAgeBin, utility));
      }
      const noTool = await check(recipient, { ...process.env, PATH: noAgeBin });
      expect(noTool.stderr).toContain('age-keygen is required');
      expect(noTool.stderr).not.toContain('AGE-SECRET-KEY');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('streams predeploy ciphertext through isolated Docker and removes partial output on failure', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'pi3-encrypt-snapshot-test-'));
    const bin = join(temp, 'bin');
    mkdirSync(bin);
    const snapshot = join(temp, 'source.db');
    const output = join(temp, 'backup.db.age');
    const argsLog = join(temp, 'docker-args.txt');
    writeFileSync(snapshot, 'isolated test snapshot');
    const fakeDocker = join(bin, 'docker');
    writeFileSync(fakeDocker, '#!/bin/sh\nprintf "%s\\n" "$@" > "$TEST_DOCKER_ARGS"\nprintf partial-ciphertext\n[ "${TEST_DOCKER_FAIL:-0}" = 0 ] || exit 17\n');
    chmodSync(fakeDocker, 0o755);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, TEST_DOCKER_ARGS: argsLog };
    try {
      const args = ['scripts/deploy-vps.sh', '--encrypt-predeploy-snapshot', 'candidate-image', 'age1' + 'a'.repeat(58), snapshot, output];
      const encrypted = await run('bash', args, env);
      expect(encrypted.code).toBe(0);
      expect(readFileSync(output, 'utf8')).toBe('partial-ciphertext');
      expect(statSync(output).mode & 0o777).toBe(0o600);
      const dockerArgs = readFileSync(argsLog, 'utf8');
      expect(dockerArgs).toContain('--network\nnone');
      expect(dockerArgs).toContain('--read-only');
      expect(dockerArgs).toContain(`type=bind,src=${snapshot},dst=/snapshot/pi3.db,readonly`);
      expect(dockerArgs).toContain('--entrypoint\nage');
      expect(dockerArgs).not.toContain(temp + '/:');

      rmSync(output);
      const failed = await run('bash', args, { ...env, TEST_DOCKER_FAIL: '1' });
      expect(failed.code).not.toBe(0);
      expect(existsSync(output)).toBe(false);
      expect(readdirSync(temp).some((name) => name.startsWith('backup.db.age.tmp.'))).toBe(false);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('sends CSRF headers for bodyless canary cleanup and retains failed-deploy evidence', () => {
    const canary = readFileSync(join(root, 'scripts/deploy-canary.mjs'), 'utf8');
    expect(canary).toContain("'X-Requested-With': 'XMLHttpRequest'");
    expect(canary).toContain('await page.goto(`${baseUrl}/projects`');
    const deploy = readFileSync(join(root, 'scripts/deploy-vps.sh'), 'utf8');
    expect(deploy).not.toContain('rm -f .pi3-compose.previous .pi3-compose.rollback');
  });

  it('requires coverage-gated container tests before stamping and isolates predeploy encryption', () => {
    const gate = readFileSync(join(root, 'scripts/release-gate.sh'), 'utf8');
    const deploy = readFileSync(join(root, 'scripts/deploy-vps.sh'), 'utf8');
    const removeOldStamp = gate.indexOf('rm -f "$stamp" "$stamp.tmp"');
    const coverageTest = gate.indexOf('make test');
    const writeStamp = gate.indexOf("printf 'v1 %s %s %s\\n'");
    expect(removeOldStamp).toBeGreaterThan(-1);
    expect(coverageTest).toBeGreaterThan(removeOldStamp);
    expect(writeStamp).toBeGreaterThan(coverageTest);
    expect(deploy).toContain('docker run --rm --network none --read-only');
    expect(deploy).toContain('--mount "type=bind,src=$backup,dst=/snapshot/pi3.db,readonly"');
    expect(deploy).toContain('> "$temporary"');
    expect(deploy).toContain('encrypt_predeploy_snapshot "$IMAGE_REF" "$AGE_RECIPIENT" "$backup" "$encrypted_backup"');
    expect(deploy).not.toContain('-v "$BACKUP_DIR:/backups"');
    expect(deploy).toContain('rm -f "$backup" "$encrypted_tmp"');
    expect(deploy).toContain('wait_for_health "$HEALTH" \'candidate image\'');
    expect(deploy).toContain('wait_for_health "$HEALTH" \'previous rollback image\'');
  });

  it('treats READY as pre-promotion eligibility, with canary and rollback after the image switch', () => {
    const policy = readFileSync(join(root, 'docs/deployment-data-safety.md'), 'utf8');
    const check = readFileSync(join(root, 'scripts/release-policy-check.sh'), 'utf8');
    const makefile = readFileSync(join(root, 'Makefile'), 'utf8');
    expect(policy).toContain('**Release gate status: READY**');
    expect(policy).toContain('`READY` means **eligible to attempt a controlled promotion**');
    expect(policy).toContain('canary attempt failed with HTTP 401 on scoped read-back');
    const normalizedPolicy = policy.replace(/\s+/g, ' ');
    expect(normalizedPolicy).toContain('The production canary cannot run against the new image until *after* promotion');
    expect(normalizedPolicy).toContain('independent external host-down monitoring is recommended but not a launch gate');
    expect(normalizedPolicy).toContain('at least 10 minutes after the canary');
    expect(check).toContain("grep -Fqx '**Release gate status: READY**'");
    expect(check).toContain('stamp="$stamp_dir/${sha}-${profile}.stamp"');
    expect(check).toContain('-le 86400');
    for (const marker of [
      '.pi3-compose.previous',
      '.pi3-compose.rollback',
      '.pi3-previous-image',
      '.pi3-previous-release-sha',
      '.pi3-canary-passed-at',
    ]) {
      expect(makefile).toContain(`test ! -e ${marker} && test ! -L ${marker}`);
    }
    const promotion = makefile.indexOf('promote-vps: release-policy-check');
    const imageSwitch = makefile.indexOf("/tmp/pi3-deploy-vps-$(SHA).sh '$(CANDIDATE_IMAGE_REF)'", promotion);
    const canary = makefile.indexOf('if node scripts/deploy-canary.mjs &&', promotion);
    const rollback = makefile.indexOf('scripts/rollback-vps.sh', canary);
    const nextTarget = makefile.indexOf('\nrollback:', canary);
    expect(promotion).toBeGreaterThan(-1);
    expect(imageSwitch).toBeGreaterThan(promotion);
    expect(canary).toBeGreaterThan(imageSwitch);
    expect(rollback).toBeGreaterThan(canary);
    expect(rollback).toBeLessThan(nextTarget);
    expect(makefile.slice(canary, nextTarget)).not.toContain('rm -f .pi3-compose.previous');
    expect(makefile).toContain('cp -p .pi3-compose.rollback docker-compose.yml');
    expect(makefile).toContain('finalize-vps:');
    const fixture = readFileSync(join(root, 'scripts/test-candidate-migrations.mjs'), 'utf8');
    expect(fixture.indexOf('if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN)'))
      .toBeLessThan(fixture.indexOf('await initDb()'));
  });

  it('retention keeps 7/4/1 rolling files and never removes the protected restore-tested copy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pi3-retention-test-'));
    try {
      const now = Math.floor(Date.now() / 1000);
      for (let i = 1; i <= 9; i += 1) touchAt(join(dir, `pi3-daily-2026-09-${String(i).padStart(2, '0')}.db.age`), now + i);
      for (let i = 1; i <= 5; i += 1) touchAt(join(dir, `pi3-weekly-2026-09-${String(i).padStart(2, '0')}.db.age`), now + i);
      for (let i = 1; i <= 2; i += 1) touchAt(join(dir, `pi3-monthly-2026-${String(i).padStart(2, '0')}.db.age`), now + i);
      touchAt(join(dir, 'pi3-restore-verified.db.age'), now + 100);

      const result = await run('sh', ['scripts/backup-retention.sh', dir]);
      expect(result.code).toBe(0);
      const names = readdirSync(dir);
      expect(names.filter((name) => name.startsWith('pi3-daily-'))).toHaveLength(7);
      expect(names.filter((name) => name.startsWith('pi3-weekly-'))).toHaveLength(4);
      expect(names.filter((name) => name.startsWith('pi3-monthly-'))).toHaveLength(1);
      expect(names).toContain('pi3-restore-verified.db.age');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('marks only a manifest-matched encrypted backup after explicit restore-drill confirmation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pi3-mark-verified-test-'));
    try {
      const artifact = 'pi3-daily-2026-09-25.db.age';
      const body = 'ciphertext-fixture';
      const sha = createHash('sha256').update(body).digest('hex');
      writeFileSync(join(dir, artifact), body);
      writeFileSync(join(dir, 'manifest.jsonl'), JSON.stringify({ file: artifact, encryptedSha256: sha }) + '\n');

      const missingConfirmation = await run('sh', ['scripts/mark-restore-verified.sh', artifact], { ...process.env, BACKUP_DIR: dir });
      expect(missingConfirmation.code).not.toBe(0);
      expect(existsSync(join(dir, 'pi3-restore-verified.db.age'))).toBe(false);

      const marked = await run('sh', ['scripts/mark-restore-verified.sh', artifact, '--restore-drill-passed'], {
        ...process.env, BACKUP_DIR: dir, SUDO_USER: 'test-operator',
      });
      expect(marked.code).toBe(0);
      expect(readFileSync(join(dir, 'pi3-restore-verified.db.age'), 'utf8')).toBe(body);
      expect(statSync(join(dir, 'pi3-restore-verified.db.age')).mode & 0o777).toBe(0o600);
      expect(readFileSync(join(dir, 'pi3-restore-verified.json'), 'utf8')).toContain(`"encryptedSha256":"${sha}"`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sends Telegram messages with the bot token kept out of curl arguments', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'pi3-telegram-test-'));
    const bin = join(temp, 'bin');
    mkdirSync(bin);
    const config = join(temp, 'backup.env');
    const argsLog = join(temp, 'curl-args.txt');
    const token = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_123456';
    writeFileSync(config, `TELEGRAM_BOT_TOKEN=${token}\nTELEGRAM_CHAT_ID=-1001234567890\n`);
    const fakeCurl = join(bin, 'curl');
    writeFileSync(fakeCurl, `#!/bin/sh\nprintf '%s\\n' "$@" > "$TELEGRAM_TEST_ARGS"\nprintf '{"ok":true}\\n'\n`);
    chmodSync(fakeCurl, 0o755);
    try {
      const result = await run('bash', ['scripts/telegram-notify.sh', 'backup check passed'], {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        PI3_BACKUP_ENV_FILE: config,
        TELEGRAM_TEST_ARGS: argsLog,
      });
      expect(result.code).toBe(0);
      const args = readFileSync(argsLog, 'utf8');
      expect(args).toContain('chat_id=-1001234567890');
      expect(args).toContain('text=backup check passed');
      expect(args).not.toContain(token);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('alerts once for stale backup/restore evidence and notifies when both recover', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'pi3-backup-watchdog-test-'));
    const backups = join(temp, 'backups');
    const state = join(temp, 'state');
    mkdirSync(backups);
    const config = join(temp, 'backup.env');
    writeFileSync(config, 'TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_123456\nTELEGRAM_CHAT_ID=123456789\n');
    const notify = join(temp, 'notify');
    const notifyLog = join(temp, 'notifications.txt');
    writeFileSync(notify, `#!/bin/sh\nprintf '%s\\n' "$1" >> "$TEST_NOTIFY_LOG"\n`);
    chmodSync(notify, 0o755);
    const backupFile = 'pi3-daily-2026-09-25.db.age';
    const backupPath = join(backups, backupFile);
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const oldTimestamp = oldDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    writeFileSync(backupPath, 'encrypted-old');
    const oldHash = createHash('sha256').update('encrypted-old').digest('hex');
    writeFileSync(join(backups, 'manifest.jsonl'), JSON.stringify({
      timestamp: oldTimestamp, kind: 'daily', file: backupFile, encryptedSha256: oldHash,
    }) + '\n');
    try {
      const env = {
        ...process.env,
        BACKUP_DIR: backups,
        BACKUP_ALERT_STATE_DIR: state,
        PI3_BACKUP_ENV_FILE: config,
        PI3_TELEGRAM_NOTIFY_SCRIPT: notify,
        TEST_NOTIFY_LOG: notifyLog,
      };
      const first = await run('bash', ['scripts/backup-alert-check.sh'], env);
      expect(first.code).toBe(0);
      expect(readFileSync(notifyLog, 'utf8')).toContain('daily backup is');
      expect(readFileSync(notifyLog, 'utf8')).toContain('restore-verified');

      await run('bash', ['scripts/backup-alert-check.sh'], env);
      expect(readFileSync(notifyLog, 'utf8').trim().split('\n')).toHaveLength(2);

      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      writeFileSync(backupPath, 'encrypted-current');
      const currentHash = createHash('sha256').update('encrypted-current').digest('hex');
      writeFileSync(join(backups, 'manifest.jsonl'), JSON.stringify({
        timestamp, kind: 'daily', file: backupFile, encryptedSha256: currentHash,
      }) + '\n');
      writeFileSync(join(backups, 'pi3-restore-verified.db.age'), 'verified-copy');
      const verifiedHash = createHash('sha256').update('verified-copy').digest('hex');
      writeFileSync(join(backups, 'pi3-restore-verified.json'), JSON.stringify({
        verifiedAt: now.toISOString(), encryptedSha256: verifiedHash,
      }));
      const recovered = await run('bash', ['scripts/backup-alert-check.sh'], env);
      expect(recovered.code).toBe(0);
      expect(readFileSync(notifyLog, 'utf8').trim().split('\n')).toHaveLength(4);
      expect(readFileSync(notifyLog, 'utf8')).toContain('condition is resolved');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('fails fast instead of accepting a different healthy server on the E2E port', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'pi3-e2e-runner-test-'));
    const server = createServer((req, res) => {
      if (req.url === '/api/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } else {
        res.writeHead(404).end();
      }
    });
    try {
      await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
      const result = await run('bash', ['scripts/run-e2e.sh', '--no-build'], {
        ...process.env, PORT: String(address.port), TMPDIR: temp,
      });
      expect(result.code).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain('refusing to test the wrong process');
      expect(readdirSync(temp)).toEqual([]);
    } finally {
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('keeps rollback evidence during the watch and finalizes only the matching canary after ten minutes', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'pi3-finalize-test-'));
    const remote = join(temp, 'remote');
    const bin = join(temp, 'bin');
    mkdirSync(remote);
    mkdirSync(bin);
    const release = 'a'.repeat(40);
    const image = 'ghcr.io/example/pi3@sha256:' + 'b'.repeat(64);
    writeFileSync(join(remote, '.pi3-current-release-sha'), `${release}\n`);
    writeFileSync(join(remote, '.pi3-current-image'), `${image}\n`);
    writeFileSync(join(remote, '.pi3-previous-image'), 'previous-image\n');
    writeFileSync(join(remote, '.pi3-previous-release-sha'), 'previous-sha\n');
    writeFileSync(join(remote, '.pi3-compose.rollback'), 'previous compose\n');
    const marker = join(remote, '.pi3-canary-passed-at');
    writeFileSync(marker, `${release} ${Math.floor(Date.now() / 1000) - 590}\n`);
    writeFileSync(join(bin, 'ssh'), '#!/bin/sh\nshift\nremote_cmd="$1"\nremote_cmd="${remote_cmd#*cd /app/pi3; }"\ncd "$TEST_REMOTE_DIR"\nexec sh -ec "$remote_cmd"\n');
    writeFileSync(join(bin, 'docker'), '#!/bin/sh\nprintf "%s\\n" "$TEST_CURRENT_IMAGE"\n');
    writeFileSync(join(bin, 'curl'), '#!/bin/sh\nexit 0\n');
    for (const executable of ['ssh', 'docker', 'curl']) chmodSync(join(bin, executable), 0o755);
    try {
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, TEST_REMOTE_DIR: remote, TEST_CURRENT_IMAGE: image };
      const early = await run('sh', ['scripts/finalize-vps.sh', 'test-vps', release], env);
      expect(early.code).not.toBe(0);
      expect(existsSync(join(remote, '.pi3-compose.rollback'))).toBe(true);
      writeFileSync(marker, `${release} ${Math.floor(Date.now() / 1000) - 610}\n`);
      const wrongRelease = await run('sh', ['scripts/finalize-vps.sh', 'test-vps', 'c'.repeat(40)], env);
      expect(wrongRelease.code).not.toBe(0);
      const finalized = await run('sh', ['scripts/finalize-vps.sh', 'test-vps', release], env);
      expect(finalized.code).toBe(0);
      expect(existsSync(join(remote, '.pi3-compose.rollback'))).toBe(false);
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('restores the environment and retains rollback evidence even after verified rollback', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'pi3-rollback-test-'));
    const remote = join(temp, 'remote');
    const bin = join(temp, 'bin');
    mkdirSync(remote);
    mkdirSync(bin);
    const previous = 'ghcr.io/example/pi3@sha256:' + 'a'.repeat(64);
    const release = 'b'.repeat(40);
    writeFileSync(join(remote, '.pi3-current-release-sha'), `${release}\n`);
    writeFileSync(join(remote, '.pi3-previous-image'), `${previous}\n`);
    writeFileSync(join(remote, '.pi3-previous-release-sha'), `${'c'.repeat(40)}\n`);
    writeFileSync(join(remote, '.pi3-compose.rollback'), 'services:\n  pi3:\n    image: previous\n');
    writeFileSync(join(remote, 'docker-compose.yml'), 'services:\n  pi3:\n    image: candidate\n');
    writeFileSync(join(remote, '.env'), 'SECRET=unchanged\nPI3_IMAGE=candidate\n', { mode: 0o600 });

    const fakeSsh = join(bin, 'ssh');
    writeFileSync(fakeSsh, '#!/bin/bash\nset -eu\nshift\nremote_cmd="$1"\nremote_cmd="${remote_cmd#*cd /app/pi3; }"\ncd "$TEST_REMOTE_DIR"\nexec bash -euc "$remote_cmd"\n');
    chmodSync(fakeSsh, 0o755);
    const fakeDocker = join(bin, 'docker');
    writeFileSync(fakeDocker, `#!/bin/sh\ncase "$1:$2" in\n  compose:pull) exit "${'${'}TEST_DOCKER_PULL_STATUS:-0}" ;;\n  compose:up) exit 0 ;;\n  inspect:pi3)\n    case "$*" in *Config.Image*) printf '%s\\n' "$TEST_PREVIOUS_IMAGE" ;; *) printf 'image-id\\n' ;; esac ;;\n  image:inspect) printf '%s\\n' "$TEST_PREVIOUS_IMAGE" ;;\n  *) exit 0 ;;\nesac\n`);
    chmodSync(fakeDocker, 0o755);
    const fakeCurl = join(bin, 'curl');
    writeFileSync(fakeCurl, '#!/bin/sh\nn=0\n[ ! -f "$TEST_CURL_COUNT" ] || n=$(cat "$TEST_CURL_COUNT")\nn=$((n + 1))\nprintf "%s\\n" "$n" > "$TEST_CURL_COUNT"\n[ "$n" -ge 3 ]\n');
    chmodSync(fakeCurl, 0o755);
    writeFileSync(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n');
    chmodSync(join(bin, 'sleep'), 0o755);

    const curlCount = join(temp, 'curl-count');
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      TEST_REMOTE_DIR: remote,
      TEST_PREVIOUS_IMAGE: previous,
      TEST_CURL_COUNT: curlCount,
      IMAGE_REPO: 'ghcr.io/example/pi3',
    };
    try {
      const failed = await run('bash', ['scripts/rollback-vps.sh', 'test-vps', release, 'ghcr.io/example/pi3'], {
        ...env, TEST_DOCKER_PULL_STATUS: '17',
      });
      expect(failed).toMatchObject({ code: 17 });
      expect(existsSync(join(remote, '.pi3-compose.rollback'))).toBe(true);
      expect(readFileSync(join(remote, 'docker-compose.yml'), 'utf8')).toContain('previous');

      rmSync(curlCount, { force: true });
      const succeeded = await run('bash', ['scripts/rollback-vps.sh', 'test-vps', release, 'ghcr.io/example/pi3'], {
        ...env, TEST_DOCKER_PULL_STATUS: '0',
      });
      expect(succeeded.code).toBe(0);
      expect(readFileSync(curlCount, 'utf8').trim()).toBe('3');
      expect(existsSync(join(remote, '.pi3-compose.rollback'))).toBe(true);
      expect(readFileSync(join(remote, '.pi3-current-image'), 'utf8').trim()).toBe(previous);
      expect(existsSync(join(remote, '.pi3-previous-image'))).toBe(true);
      expect(readFileSync(join(remote, '.env'), 'utf8')).toBe(`SECRET=unchanged\nPI3_IMAGE=${previous}\n`);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
