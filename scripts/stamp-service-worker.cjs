const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const PLACEHOLDER = '__PI3_BUILD_ID__';

function stampServiceWorker(filePath, buildId) {
  if (!existsSync(filePath)) {
    throw new Error(`Service worker output not found: ${filePath}`);
  }

  const source = readFileSync(filePath, 'utf8');
  if (!source.includes(`'${PLACEHOLDER}'`)) {
    throw new Error(`Service worker build placeholder is missing from ${filePath}`);
  }

  const stamped = source.replace(`'${PLACEHOLDER}'`, JSON.stringify(buildId));
  writeFileSync(filePath, stamped, 'utf8');
}

if (require.main === module) {
  const outputPath = process.argv[2]
    ? resolve(process.argv[2])
    : join(ROOT, 'dist', 'sw.js');
  const buildId = process.env.PI3_BUILD_ID
    || process.env.VERCEL_GIT_COMMIT_SHA
    || `local-${Date.now().toString(36)}`;

  stampServiceWorker(outputPath, buildId);
  console.log(`[stamp-service-worker] ${outputPath} → ${buildId}`);
}

module.exports = { stampServiceWorker };
