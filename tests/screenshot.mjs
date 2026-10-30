/**
 * Headless-скриншот через Chrome DevTools Protocol.
 * Использование: node tests/screenshot.mjs <url> <out.png> [waitMs]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'http://127.0.0.1:8123/';
const outFile = process.argv[3] || 'shots/screen.png';
const waitMs = Number(process.argv[4] || 7000);
const viewportWidth = Number(process.env.ATD_W || process.argv[7] || 1280);
const viewportHeight = Number(process.env.ATD_H || process.argv[8] || 800);
const port = 9333 + Math.floor(Math.random() * 100);
const profile = path.resolve(`.edge-cdp-${port}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForEndpoint() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const list = await response.json();
        const page = list.find((item) => item.type === 'page');
        if (page) return page;
      }
    } catch {
      /* not ready yet */
    }
    await sleep(250);
  }
  throw new Error('DevTools endpoint unavailable');
}

function cdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let counter = 0;
  const pending = new Map();
  const events = [];

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
      }
    } else {
      events.push(message);
    }
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      counter += 1;
      pending.set(counter, { resolve, reject });
      socket.send(JSON.stringify({ id: counter, method, params }));
    });

  return { socket, send, events, ready };
}

async function main() {
  const browser = spawn(
    EDGE,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--disable-dev-shm-usage',
      '--force-device-scale-factor=1',
      `--window-size=${viewportWidth},${viewportHeight}`,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--remote-allow-origins=*',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    const page = await waitForEndpoint();
    const client = cdpClient(page.webSocketDebuggerUrl);
    await client.ready;

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await client.send('Page.navigate', { url });
    await sleep(waitMs);

    const info = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        canvas: (() => { const c = document.querySelector('canvas'); return c ? { w: c.width, h: c.height, cssW: c.style.width, cssH: c.style.height } : null; })(),
        boot: document.getElementById('boot')?.className || '',
        fatal: document.getElementById('fatal-text')?.textContent || '',
        manager: window.__ATD__?.manager?.state ? {
          day: window.__ATD__.manager.state.day,
          phase: window.__ATD__.manager.state.phase,
          money: window.__ATD__.manager.state.money,
          creatures: window.__ATD__.manager.state.creatures.length
        } : null,
        scenes: window.__ATD__?.game?.scene?.scenes?.filter(s => s.scene.isActive()).map(s => s.scene.key) || []
      })`,
      returnByValue: true,
      awaitPromise: false,
    });

    console.log('STATE', info.result?.value);

    let expression = process.argv[5];
    if (expression?.startsWith('@')) {
      expression = fs.readFileSync(expression.slice(1), 'utf8');
    }
    if (expression) {
      const evaluated = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: false,
      });
      console.log('EVAL', JSON.stringify(evaluated.result?.value ?? evaluated.result));
      await sleep(700);
    }

    let expression2 = process.argv[6];
    if (expression2?.startsWith('@')) {
      expression2 = fs.readFileSync(expression2.slice(1), 'utf8');
    }
    if (process.env.ATD_CLICK) {
      const [clickX, clickY] = process.env.ATD_CLICK.split(',').map(Number);
      await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: clickX, y: clickY, button: 'none' });
      await sleep(80);
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickX, y: clickY, button: 'left', clickCount: 1 });
      await sleep(90);
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickX, y: clickY, button: 'left', clickCount: 1 });
      await sleep(700);
    }
    if (expression2) {
      const evaluated = await client.send('Runtime.evaluate', {
        expression: expression2,
        returnByValue: true,
        awaitPromise: false,
      });
      console.log('EVAL2', JSON.stringify(evaluated.result?.value ?? evaluated.result));
    }

    const errors = client.events
      .filter((event) => event.method === 'Runtime.exceptionThrown')
      .map((event) => event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text);
    const consoleErrors = client.events
      .filter((event) => event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error')
      .map((event) => event.params.args.map((arg) => arg.value || arg.description).join(' '));
    if (errors.length) console.log('PAGE_ERRORS', JSON.stringify(errors, null, 2));
    if (consoleErrors.length) console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors, null, 2));

    const shot = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });

    fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
    fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
    console.log('SAVED', outFile);

    client.socket.close();
  } finally {
    spawn('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
    await sleep(400);
  }
}

main().catch((error) => {
  console.error('SCREENSHOT_FAILED', error);
  process.exit(1);
});
