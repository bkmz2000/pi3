#!/usr/bin/env node
/**
 * Production API/UI canary. Opens an interactive browser for the operator to
 * sign in as the dedicated student account, then obtains a 10-minute token
 * scoped to one canary project. The token is never printed or injected into
 * browser requests; the IDE uses its normal session cookie.
 */
import puppeteer from 'puppeteer';

const baseUrl = (process.env.PI3_CANARY_BASE_URL || '').replace(/\/$/, '');
const expectedUserId = process.env.PI3_CANARY_USER_ID;
const base = baseUrl ? new URL(baseUrl) : null;
if (!baseUrl || !expectedUserId) {
  throw new Error('Set PI3_CANARY_BASE_URL and PI3_CANARY_USER_ID');
}
if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) {
  throw new Error('PI3_CANARY_BASE_URL must be a bare HTTPS origin');
}

const stamp = `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;
const marker = `pi3-release-canary-${stamp}`;
const canaryName = `Release canary ${stamp}`;
const canaryCode = `# ${marker}\nprint("${marker}")`;
let projectId;
let token;
let browser;
let page;
let operationError;
const cleanupErrors = [];

async function scopedApi(path, options = {}) {
  const expectedPath = projectId ? `/api/canary/projects/${encodeURIComponent(projectId)}` : '';
  const method = options.method || 'GET';
  if (!token || path !== expectedPath || !['GET', 'DELETE'].includes(method)) {
    throw new Error('Refusing a canary API request outside the scoped project read/delete operations');
  }
  return fetch(`${baseUrl}${path}`, {
    ...options,
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

async function browserApi(path, options = {}) {
  if (!page || page.isClosed()) throw new Error('Canary browser session is unavailable');
  return page.evaluate(async ({ requestPath, requestOptions }) => {
    const response = await fetch(requestPath, {
      ...requestOptions,
      credentials: 'include',
      redirect: 'error',
      headers: {
        ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(requestOptions.headers || {}),
      },
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data };
  }, { requestPath: path, requestOptions: options });
}

try {
  browser = await puppeteer.launch({
    headless: process.env.PI3_CANARY_HEADLESS === 'true',
    devtools: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  page = await browser.newPage();
  await page.goto(`${baseUrl}/ide`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Sign in in the opened browser as the configured dedicated student; the canary does not inspect or export credentials or session cookies.');

  const authenticatedUser = await page.waitForFunction(async () => {
    try {
      const response = await fetch('/api/users/me', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) return false;
      const user = await response.json();
      return { id: user.id, role: user.role };
    } catch {
      return false;
    }
  }, { polling: 1000, timeout: 10 * 60 * 1000 });
  const user = await authenticatedUser.jsonValue();
  if (user.id !== expectedUserId || user.role !== 'student') {
    throw new Error('Sign in with the configured dedicated student account; no project was created.');
  }

  const created = await browserApi('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: canaryName,
      files: { 'main.py': '# created by release canary' },
      assets: {}, tilemaps: {}, sounds: {}, currentFile: 'main.py',
    }),
  });
  if (created.status !== 201 || !created.data?.id) {
    throw new Error(`Canary project creation returned HTTP ${created.status}`);
  }
  projectId = created.data.id;

  const tokenResponse = await browserApi('/api/canary/token', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
  if (
    tokenResponse.status !== 201 ||
    typeof tokenResponse.data?.token !== 'string' ||
    !Number.isFinite(tokenResponse.data?.expiresAt) ||
    tokenResponse.data.expiresAt <= Date.now() ||
    tokenResponse.data.expiresAt > Date.now() + 10 * 60 * 1000
  ) {
    throw new Error(`Scoped canary token issuance returned an invalid response (HTTP ${tokenResponse.status})`);
  }
  token = tokenResponse.data.token;

  await page.goto(`${baseUrl}/ide/${encodeURIComponent(projectId)}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('.cm-content', { timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector('.cm-content')?.textContent?.includes('created by release canary'),
    { timeout: 30000 },
  );

  await page.click('.cm-content');
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.type(canaryCode);

  const canaryPath = `/api/canary/projects/${encodeURIComponent(projectId)}`;
  const saveDeadline = Date.now() + 30000;
  let persisted = false;
  while (Date.now() < saveDeadline) {
    const response = await scopedApi(canaryPath);
    if (!response.ok) throw new Error(`Canary read-back returned HTTP ${response.status}`);
    const current = await response.json();
    if (current.files?.['main.py'] === canaryCode) { persisted = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!persisted) throw new Error('Edited canary content was not persisted by the IDE autosave');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cm-content', { timeout: 60000 });
  await page.waitForFunction(
    (expected) => {
      const text = document.querySelector('.cm-content')?.innerText || '';
      return text.replace(/\\r/g, '').replace(/\\n$/, '') === expected;
    },
    { timeout: 30000 }, canaryCode,
  );
  const reloadedResponse = await scopedApi(canaryPath);
  if (!reloadedResponse.ok) throw new Error(`Canary reload read-back returned HTTP ${reloadedResponse.status}`);
  const reloaded = await reloadedResponse.json();
  if (reloaded.files?.['main.py'] !== canaryCode) {
    throw new Error('Canary content differs after editor reload');
  }
  console.log(`✓ API/UI canary create-edit-reload verified for project ${projectId}`);
} catch (error) {
  operationError = error;
}

// Recover the ID if project creation committed but its response was lost.
if (!projectId && page && !page.isClosed()) {
  try {
    const listed = await browserApi('/api/projects');
    if (listed.status !== 200 || !Array.isArray(listed.data)) {
      throw new Error(`Could not list projects for cleanup (HTTP ${listed.status})`);
    }
    projectId = listed.data.find((candidate) => candidate.name === canaryName)?.id;
  } catch (error) {
    cleanupErrors.push(new Error(`Could not locate a possibly-created canary project: ${error.message}`));
  }
}

if (projectId) {
  let cleanupVerified = false;
  let scopedCleanupError;
  if (token) {
    try {
      const path = `/api/canary/projects/${encodeURIComponent(projectId)}`;
      const deleted = await scopedApi(path, { method: 'DELETE' });
      if (deleted.status !== 204) throw new Error(`delete returned HTTP ${deleted.status}`);
      const absent = await scopedApi(path);
      if (absent.status !== 404) throw new Error(`expected 404 after delete, received ${absent.status}`);
      cleanupVerified = true;
    } catch (error) {
      scopedCleanupError = error;
    }
  }

  // The normal session is an independent cleanup path if the scoped token
  // expired or the scoped API is unavailable.
  if (!cleanupVerified && page && !page.isClosed()) {
    try {
      const path = `/api/projects/${encodeURIComponent(projectId)}`;
      const deleted = await browserApi(path, { method: 'DELETE' });
      if (![204, 404].includes(deleted.status)) throw new Error(`session cleanup returned HTTP ${deleted.status}`);
      const absent = await browserApi(path);
      if (absent.status !== 404) throw new Error(`expected 404 after delete, received ${absent.status}`);
      cleanupVerified = true;
    } catch (error) {
      cleanupErrors.push(new Error(`Session cleanup failed for ${projectId}: ${error.message}`));
    }
  }

  if (!cleanupVerified) {
    if (scopedCleanupError) cleanupErrors.push(new Error(`Scoped cleanup failed for ${projectId}: ${scopedCleanupError.message}`));
    if (!cleanupErrors.length) cleanupErrors.push(new Error(`Canary cleanup unavailable for ${projectId}`));
  } else {
    console.log('✓ Canary project deleted and absence verified');
  }
}

if (browser) {
  try { await browser.close(); }
  catch (error) { cleanupErrors.push(new Error(`Could not close canary browser: ${error.message}`)); }
}

if (operationError) {
  for (const error of cleanupErrors) console.error(error.message);
  throw operationError;
}
if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Canary cleanup did not fully verify');
