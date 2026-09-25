import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
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

  it('treats READY as pre-promotion eligibility, with canary and rollback after the image switch', () => {
    const policy = readFileSync(join(root, 'docs/deployment-data-safety.md'), 'utf8');
    const check = readFileSync(join(root, 'scripts/release-policy-check.sh'), 'utf8');
    const makefile = readFileSync(join(root, 'Makefile'), 'utf8');
    expect(policy).toContain('`READY` means **eligible to attempt a controlled promotion**');
    const normalizedPolicy = policy.replace(/\s+/g, ' ');
    expect(normalizedPolicy).toContain('The production canary cannot run against the new image until *after* promotion');
    expect(normalizedPolicy).toContain('independent external host-down monitoring is recommended but not a launch gate');
    expect(normalizedPolicy).toContain('at least 10 minutes after the canary');
    expect(check).toContain("grep -Fqx '**Release gate status: READY**'");
    expect(check).toContain('stamp="$stamp_dir/${sha}-${profile}.stamp"');
    expect(check).toContain('-le 86400');
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

  it('keeps the rollback Compose evidence on failure and removes it only after verification', async () => {
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

    const fakeSsh = join(bin, 'ssh');
    writeFileSync(fakeSsh, '#!/bin/bash\nset -eu\nshift\nremote_cmd="$1"\nremote_cmd="${remote_cmd#*cd /app/pi3; }"\ncd "$TEST_REMOTE_DIR"\nexec bash -euc "$remote_cmd"\n');
    chmodSync(fakeSsh, 0o755);
    const fakeDocker = join(bin, 'docker');
    writeFileSync(fakeDocker, `#!/bin/sh\ncase "$1:$2" in\n  compose:pull) exit "${'${'}TEST_DOCKER_PULL_STATUS:-0}" ;;\n  compose:up) exit 0 ;;\n  inspect:pi3)\n    case "$*" in *Config.Image*) printf '%s\\n' "$TEST_PREVIOUS_IMAGE" ;; *) printf 'image-id\\n' ;; esac ;;\n  image:inspect) printf '%s\\n' "$TEST_PREVIOUS_IMAGE" ;;\n  *) exit 0 ;;\nesac\n`);
    chmodSync(fakeDocker, 0o755);
    const fakeCurl = join(bin, 'curl');
    writeFileSync(fakeCurl, '#!/bin/sh\nexit 0\n');
    chmodSync(fakeCurl, 0o755);

    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      TEST_REMOTE_DIR: remote,
      TEST_PREVIOUS_IMAGE: previous,
      IMAGE_REPO: 'ghcr.io/example/pi3',
    };
    try {
      const failed = await run('bash', ['scripts/rollback-vps.sh', 'test-vps', release, 'ghcr.io/example/pi3'], {
        ...env, TEST_DOCKER_PULL_STATUS: '17',
      });
      expect(failed).toMatchObject({ code: 17 });
      expect(existsSync(join(remote, '.pi3-compose.rollback'))).toBe(true);
      expect(readFileSync(join(remote, 'docker-compose.yml'), 'utf8')).toContain('previous');

      const succeeded = await run('bash', ['scripts/rollback-vps.sh', 'test-vps', release, 'ghcr.io/example/pi3'], {
        ...env, TEST_DOCKER_PULL_STATUS: '0',
      });
      expect(succeeded.code).toBe(0);
      expect(existsSync(join(remote, '.pi3-compose.rollback'))).toBe(false);
      expect(readFileSync(join(remote, '.pi3-current-image'), 'utf8').trim()).toBe(previous);
      expect(existsSync(join(remote, '.pi3-previous-image'))).toBe(false);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
