/**
 * Browser-level SQA: drives the real Next.js UI through the Chrome DevTools
 * Protocol (headless Edge/Chrome), logs in through the form, opens the board
 * and integrations pages, asserts rendered content and captures screenshots.
 *
 *   pnpm --filter @rant/api sqa:ui
 *
 * Runs against the SQA data created by `sqa.mjs` (most recent SQA org).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '@rant/database';

const { PrismaClient } = db;
const prisma = new PrismaClient();

const WEB = process.env.SQA_WEB ?? 'http://localhost:3000';
const PORT = Number(process.env.SQA_CDP_PORT ?? 9333);
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const shotDir = fileURLToPath(new URL('../../../../', import.meta.url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ui-browser :: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, error: message });
    console.log(`FAIL  ui-browser :: ${name}\n      ${message}`);
  }
}

async function waitForHttp(url, timeoutMs = 20_000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      /* not up yet */
    }
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${url}`);
    await sleep(250);
  }
}

function pickBrowser() {
  for (const candidate of BROWSERS) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('No Edge/Chrome executable found');
}

function makeCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = new Set();
  let nextId = 1;

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP socket error')), { once: true });
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const waiter = pending.get(msg.id);
      if (waiter) {
        pending.delete(msg.id);
        if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
        else waiter.resolve(msg.result);
      }
      return;
    }
    for (const listener of listeners) listener(msg);
  });

  function send(method, params = {}) {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  function onEvent(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function waitEvent(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timed out waiting for ${method}`));
      }, timeoutMs);
      const off = onEvent((msg) => {
        if (msg.method === method) {
          clearTimeout(timer);
          off();
          resolve(msg.params);
        }
      });
    });
  }

  return { ws, ready, send, onEvent, waitEvent };
}

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: { startsWith: 'sqa-owner-' } },
    orderBy: { createdAt: 'desc' },
  });
  assert(owner, 'No SQA owner found — run `pnpm --filter @rant/api sqa` first');
  const org = await prisma.organization.findFirst({
    where: { ownerId: owner.id },
    orderBy: { createdAt: 'desc' },
  });
  assert(org, 'No SQA organization found');
  const workspace = await prisma.workspace.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
  });
  const project = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, key: 'SQA' },
    orderBy: { createdAt: 'asc' },
  });
  const issue = await prisma.issue.findFirst({
    where: { projectId: project.id, title: { contains: 'SQA issue alpha' } },
    orderBy: { createdAt: 'desc' },
  });
  const repo = await prisma.repository.findFirst({
    where: { organizationId: org.id, slug: 'sqa-app' },
    orderBy: { createdAt: 'desc' },
  });
  assert(issue, 'No SQA issue found');

  const browser = pickBrowser();
  const profile = mkdtempSync(join(tmpdir(), 'rant-ui-sqa-'));
  const child = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-allow-origins=*',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let cdp;
  const consoleErrors = [];
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/json/version`);
    const target = await (
      await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, {
        method: 'PUT',
      })
    ).json();

    cdp = makeCdp(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const netFailures = [];
    const requests = new Map();
    cdp.onEvent((msg) => {
      if (msg.method === 'Network.requestWillBeSent') {
        requests.set(msg.params.requestId, msg.params.request.url);
      }
      if (msg.method === 'Network.loadingFailed') {
        const url = requests.get(msg.params.requestId) ?? 'unknown';
        netFailures.push(`${url} :: ${msg.params.errorText}`);
      }
    });

    cdp.onEvent((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(msg.params.exceptionDetails?.text ?? 'exception');
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const text = (msg.params.args ?? [])
          .map((a) => a.value ?? a.description ?? '')
          .join(' ');
        if (text && !/favicon|Download the React DevTools/i.test(text)) consoleErrors.push(text);
      }
    });

    const evaluate = async (expression) => {
      const res = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(
          res.exceptionDetails.exception?.description ?? res.exceptionDetails.text ?? 'eval failed',
        );
      }
      return res.result.value;
    };

    const navigate = async (url) => {
      const loaded = cdp.waitEvent('Page.loadEventFired', 20_000);
      await cdp.send('Page.navigate', { url });
      await loaded;
      await sleep(400);
    };

    const waitUntil = async (fn, label, timeoutMs = 20_000) => {
      const start = Date.now();
      while (!(await fn())) {
        if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${label}`);
        await sleep(300);
      }
    };

    const fill = (selector, value) =>
      evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);

    const screenshot = async (name) => {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const path = join(shotDir, name);
      writeFileSync(path, Buffer.from(shot.data, 'base64'));
      return path;
    };

    await check('login page renders the form', async () => {
      await navigate(`${WEB}/login`);
      const text = await evaluate('document.body.innerText');
      assert(text.includes('Welcome back'), 'login heading missing');
      assert((await evaluate('!!document.querySelector("input[type=email]")')), 'email input missing');
      assert((await evaluate('!!document.querySelector("input[type=password]")')), 'password input missing');
    });

    await check('login form authenticates and redirects to the dashboard', async () => {
      assert(await fill('input[type=email]', owner.email), 'could not fill email');
      assert(await fill('input[type=password]', 'SqaPassw0rd!'), 'could not fill password');
      const filled = await evaluate(
        `[...document.querySelectorAll('input')].map((i) => i.value)`,
      );
      assert(filled[0] === owner.email && filled[1] === 'SqaPassw0rd!', `inputs not filled: ${JSON.stringify(filled)}`);
      await evaluate('document.querySelector("button[type=submit]").click()');
      try {
        await waitUntil(
          async () => (await evaluate('location.pathname')) === '/dashboard',
          'dashboard redirect',
        );
      } catch (err) {
        const diag = await evaluate(`(() => ({
          path: location.pathname,
          token: Boolean(localStorage.getItem('rant.access')),
          text: document.body.innerText.slice(0, 300),
        }))()`);
        throw new Error(
          `${err.message} :: diag=${JSON.stringify(diag)} :: net=${netFailures.slice(0, 6).join(' ; ')}`,
        );
      }
      const token = await evaluate("localStorage.getItem('rant.access')");
      assert(typeof token === 'string' && token.length > 20, 'access token not stored');
    });

    await check('dashboard lists the SQA organization', async () => {
      const text = await evaluate('document.body.innerText');
      assert(text.includes('SQA Corp'), 'SQA org not rendered on dashboard');
    });

    await check('board renders issues and supports opening a drawer', async () => {
      await navigate(`${WEB}/orgs/${org.id}/workspaces/${workspace.id}/projects/${project.id}`);
      await waitUntil(
        async () => (await evaluate('document.body.innerText')).includes(issue.title),
        'board issue',
      );
      const text = await evaluate('document.body.innerText');
      assert(text.includes('Backlog') || text.includes('To Do'), 'board columns missing');
      // Click the exact card (the <p> title's parent is the clickable card).
      const clicked = await evaluate(`(() => {
        const title = ${JSON.stringify(issue.title)};
        const p = [...document.querySelectorAll('p')].find((el) => el.textContent.trim() === title);
        if (!p) return false;
        p.parentElement.click();
        return true;
      })()`);
      assert(clicked, 'issue card not found');
      try {
        await waitUntil(
          async () => (await evaluate('document.body.innerText')).includes('Comments'),
          'issue drawer',
          8_000,
        );
      } catch (err) {
        const textNow = await evaluate('document.body.innerText');
        throw new Error(`${err.message} :: body=${textNow.slice(0, 500)}`);
      }
      await screenshot('ui-board.png');
    });

    await check('integrations page shows GitHub, Vercel and Sentry cards', async () => {
      await navigate(`${WEB}/orgs/${org.id}/integrations`);
      await waitUntil(
        async () => {
          const text = await evaluate('document.body.innerText');
          return text.includes('Vercel') && text.includes('Sentry');
        },
        'integration cards',
      );
      const text = await evaluate('document.body.innerText');
      assert(text.includes('GitHub'), 'GitHub card missing');
      assert(text.includes('Link project'), 'project-link form missing');
      await screenshot('ui-integrations.png');
    });

    await check('repositories page offers project linking', async () => {
      await navigate(`${WEB}/orgs/${org.id}/repos`);
      await waitUntil(
        async () => (await evaluate('document.body.innerText')).includes('Create repository'),
        'repositories page',
      );
      await waitUntil(
        async () => (await evaluate('document.querySelectorAll("select option").length')) > 1,
        'project options',
        15_000,
      );
      const options = await evaluate(
        `[...document.querySelectorAll('select option')].map((o) => o.textContent.trim())`,
      );
      assert(
        options.some((o) => o.includes('SQA')),
        `project options missing: ${JSON.stringify(options)}`,
      );
    });

    await check('chat page renders channels and the composer', async () => {
      await navigate(`${WEB}/orgs/${org.id}/chat`);
      try {
        await waitUntil(
          async () => (await evaluate('document.body.innerText')).includes('general'),
          'chat channels',
          25_000,
        );
      } catch (err) {
        const body = await evaluate('document.body.innerText');
        throw new Error(`${err.message} :: body=${body.slice(0, 500)}`);
      }
      const text = await evaluate('document.body.innerText');
      assert(text.includes('activity'), '#activity channel missing');
    });

    await check('notifications page renders the feed', async () => {
      await navigate(`${WEB}/notifications`);
      await waitUntil(
        async () => !(await evaluate('document.body.innerText')).includes('Loading'),
        'notifications load',
      );
      const text = await evaluate('document.body.innerText');
      assert(/notification/i.test(text), 'notification center did not render');
    });

    await check('no uncaught browser exceptions during the run', async () => {
      assert(
        consoleErrors.length === 0,
        `browser errors: ${consoleErrors.slice(0, 3).join(' | ')}`,
      );
    });
  } finally {
    try {
      cdp?.ws.close();
    } catch {
      /* ignore */
    }
    child.kill();
    await sleep(500);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* locked by the browser; temp dir will be cleaned by the OS */
    }
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nui-browser: ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    for (const f of failed) console.log(`- ${f.name}: ${f.error}`);
  }
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((err) => {
  console.error('UI SQA crashed:', err);
  process.exitCode = 1;
});
