import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

describe('Telegram backup alerts', () => {
  jest.setTimeout(15_000);

  it('keeps the bot token out of curl arguments', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'pi3-telegram-test-'));
    const bin = join(temp, 'bin');
    mkdirSync(bin);
    const config = join(temp, 'backup.env');
    const argsLog = join(temp, 'curl-args.txt');
    const token = ['123456789', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_123456'].join(':');
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
    const fakeToken = ['123456789', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_123456'].join(':');
    writeFileSync(config, `TELEGRAM_BOT_TOKEN=${fakeToken}\nTELEGRAM_CHAT_ID=123456789\n`);
    const notify = join(temp, 'notify');
    const notifyLog = join(temp, 'notifications.txt');
    writeFileSync(notify, `#!/bin/sh\nprintf '%s\\n' "$1" >> "$TEST_NOTIFY_LOG"\n`);
    chmodSync(notify, 0o755);
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const backupFile = `pi3-daily-${oldDate.toISOString().slice(0, 10)}.db.age`;
    const backupPath = join(backups, backupFile);
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
});
