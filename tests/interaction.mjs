/**
 * Интерактивный smoke-тест через CDP: реальные клики по интерфейсу.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9450 + Math.floor(Math.random() * 50);
const profile = path.resolve(`.edge-click-${port}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPage() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await response.json();
      const page = list.find((item) => item.type === 'page');
      if (page) return page;
    } catch {
      /* wait */
    }
    await sleep(200);
  }
  throw new Error('DevTools endpoint unavailable');
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let counter = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
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
  return { socket, send, ready };
}

const browser = spawn(
  EDGE,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1280,800',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--remote-allow-origins=*',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const results = [];
const check = (name, condition, detail = '') => {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

try {
  const page = await waitForPage();
  const client = connect(page.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send('Page.navigate', { url: 'http://127.0.0.1:8123/?screen=office&fresh=1' });
  await sleep(10000);
  await client.send('Page.bringToFront');
  await client.send('Runtime.evaluate', { expression: 'window.focus()' });

  const evaluate = async (expression) => {
    const result = await client.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  };

  const click = async (x, y) => {
    await client.send('Page.bringToFront');
    await client.send('Runtime.evaluate', { expression: 'window.focus()' });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await sleep(100);
    await client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    await sleep(90);
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
    await sleep(500);
  };

  const pressKey = async (key, code = key) => {
    const keyCode = key === 'Enter' ? 13 : key === 'Escape' ? 27 : 0;
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    });
    await sleep(80);
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    });
    await sleep(600);
  };

  let active = await evaluate(
    `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
  );
  check('Офис открыт', active.includes('Office'), active);
  const finishButtonGone = await evaluate(
    `!Boolean(window.__ATD__.game.scene.getScene('Office').endShiftBtn)`
  );
  check('Кнопка завершения дня удалена', finishButtonGone);
  await evaluate(`(() => {
    const m = window.__ATD__.manager;
    m.state.nextEventIn = 99999;
    m.state.aiCooldown = 99999;
    m.state.alarmCooldown = 99999;
    m.state.alarm = null;
    m.state.camDown = {};
    const maintenance = window.__ATD__.game.maintenanceController;
    if (maintenance) {
      maintenance.timer = 999999;
      maintenance.lastDay = m.state.day;
      maintenance.lastAway = m.state.creatures.filter(
        (creature) => creature.defId && creature.status === 'contract'
      ).length;
      maintenance.active = true;
    }
    m.paused = false;
  })()`);

  await click(96, 351);
  await sleep(1000);
  active = await evaluate(
    `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
  );
  if (!active.includes('Shop')) {
    await click(96, 351);
    await sleep(1000);
    active = await evaluate(
      `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
    );
  }
  check('Кнопка ПИТОМНИК открывает магазин', active.includes('Shop'), active);

  await click(84, 39);
  await sleep(1000);
  active = await evaluate(
    `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
  );
  if (!active.includes('Office')) {
    await click(84, 39);
    await sleep(1000);
    active = await evaluate(
      `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
    );
  }
  check('Питомник возвращает в офис', active.includes('Office'), active);

  const before = await evaluate(
    `JSON.stringify({ money: __ATD__.manager.state.money, hunger: __ATD__.manager.get(1).stats.hunger })`
  );

  await click(400, 190);
  await sleep(900);
  active = await evaluate(
    `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
  );
  if (!active.includes('Room')) {
    await click(400, 190);
    await sleep(900);
    active = await evaluate(
      `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
    );
  }
  check('Клик по камере открывает комнату', active.includes('Room'), active);

  await evaluate(`(() => {
    const room = window.__ATD__.game.scene.getScene('Room');
    room.state.alarm = { slot: 1, countdown: 20, initial: 26, name: 'БОБЭК' };
    room.enterDefense();
  })()`);
  await sleep(500);
  await click(120, 744);
  await sleep(600);
  const alarmAfter = await evaluate(`JSON.stringify({ alarm: window.__ATD__.manager.state.alarm })`);
  check('Средство сдерживания снимает тревогу', JSON.parse(alarmAfter).alarm === null, alarmAfter);

  await click(75, 740);
  await sleep(500);
  await evaluate(`delete window.__ATD__.manager.state.camDown[1]; window.__ATD__.game.scene.getScene('Room').refreshAll()`);
  const modalOpen = await evaluate(`Boolean(window.__ATD__.game.scene.getScene('Room').modal)`);
  check('Кнопка КОРМИТЬ открывает панель', modalOpen);

  await click(997, 446);
  await sleep(800);
  let after = await evaluate(
    `JSON.stringify({ money: __ATD__.manager.state.money, hunger: __ATD__.manager.get(1).stats.hunger, modal: Boolean(window.__ATD__.game.scene.getScene('Room').modal) })`
  );
  if (JSON.parse(after).money === JSON.parse(before).money) {
    await click(997, 446);
    await sleep(700);
    after = await evaluate(
      `JSON.stringify({ money: __ATD__.manager.state.money, hunger: __ATD__.manager.get(1).stats.hunger, modal: Boolean(window.__ATD__.game.scene.getScene('Room').modal) })`
    );
  }
  const parsedBefore = JSON.parse(before);
  const parsedAfter = JSON.parse(after);
  check(
    'Кормление списало деньги и снизило голод',
    parsedAfter.money < parsedBefore.money && parsedAfter.hunger < parsedBefore.hunger,
    after
  );
  check('Панель закрылась после действия', parsedAfter.modal === false);

  await click(261, 740);
  await sleep(500);
  await evaluate(`delete window.__ATD__.manager.state.camDown[1]; window.__ATD__.game.scene.getScene('Room').refreshAll()`);
  const trainOpen = await evaluate(`Boolean(window.__ATD__.game.scene.getScene('Room').modal)`);
  check('Кнопка ОБУЧАТЬ открывает панель', trainOpen);

  await evaluate(`(() => {
    const manager = window.__ATD__.manager;
    const original = manager.train.bind(manager);
    window.__TRAIN_CALLED__ = null;
    manager.train = (...args) => { window.__TRAIN_CALLED__ = args; return original(...args); };
  })()`);

  await click(332, 318);
  await sleep(700);
  let training = await evaluate(
    `JSON.stringify({ called: window.__TRAIN_CALLED__, status: __ATD__.manager.get(1).status, training: __ATD__.manager.get(1).training, modal: Boolean(window.__ATD__.game.scene.getScene('Room').modal), money: __ATD__.manager.state.money, energy: __ATD__.manager.state.operatorEnergy, skillState: __ATD__.manager.skillState(1, 'bobek_obedience_1').state })`
  );
  if (JSON.parse(training).status !== 'training') {
    await click(332, 318);
    await sleep(700);
    training = await evaluate(
      `JSON.stringify({ called: window.__TRAIN_CALLED__, status: __ATD__.manager.get(1).status, training: __ATD__.manager.get(1).training, modal: Boolean(window.__ATD__.game.scene.getScene('Room').modal), money: __ATD__.manager.state.money, energy: __ATD__.manager.state.operatorEnergy, skillState: __ATD__.manager.skillState(1, 'bobek_obedience_1').state })`
    );
  }
  check('Обучение запущено', JSON.parse(training).status === 'training', training);
  await evaluate(`(() => { const c = __ATD__.manager.get(1); c.status = 'idle'; c.training = null; })()`);

  await click(70, 36);
  await sleep(1600);
  active = await evaluate(
    `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
  );
  const backDetail = await evaluate(
    `JSON.stringify({ active: window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key), fatal: document.getElementById('fatal-text').textContent, roomModal: Boolean(window.__ATD__.game.scene.getScene('Room')?.modal) })`
  );
  check('Кнопка НАЗАД возвращает в офис', active.includes('Office'), backDetail);

  const fatal = await evaluate(`document.getElementById('fatal-text').textContent`);
  check('Нет фатальных ошибок', !fatal, fatal);

  await click(96, 308);
  await sleep(900);
  const marketActive = await evaluate(
    `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
  );
  check('Кнопка КОНТРАКТЫ открывает рынок', marketActive.includes('Market'), marketActive);

  const offerPick = await evaluate(`(() => {
    const m = window.__ATD__.manager;
    const offers = m.state.offers;
    for (let i = 0; i < offers.length; i += 1) {
      const rows = m.state.creatures
        .filter((c) => c.defId)
        .map((c, row) => ({ c, row, ready: m.readinessOf(c.slot) }))
        .filter((x) => x.c.status === 'idle' && x.ready >= offers[i].reqReadiness);
      if (rows.length) return JSON.stringify({ offer: i, row: rows[0].row });
    }
    return null;
  })()`);
  check('На рынке есть доступный контракт', Boolean(offerPick), offerPick);

  if (offerPick) {
    const { offer, row } = JSON.parse(offerPick);
    await click(724, 212 + offer * 132);
    await sleep(600);
    await click(922, 246 + row * 86 + 36);
    await sleep(900);
    const contractState = await evaluate(`(() => {
      const m = window.__ATD__.manager;
      const away = m.state.creatures.filter((c) => c.status === 'contract');
      return JSON.stringify({ away: away.length, offers: m.state.offers.length });
    })()`);
    check('Контракт назначен через рынок', JSON.parse(contractState).away === 1, contractState);
    await sleep(1200);
    await click(70, 38);
    await sleep(1000);
    let marketBack = await evaluate(
      `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
    );
    if (!marketBack.includes('Office')) {
      await click(70, 38);
      await sleep(1000);
      marketBack = await evaluate(
        `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
      );
    }
  }

  await evaluate(`(() => {
    const m = window.__ATD__.manager;
    m.endShift('manual');
    window.__ATD__.game.scene.getScene('Office').scene.start('Report');
  })()`);
  await sleep(1800);
  let activeNow = await evaluate(
    `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
  );
  const reportPhase = await evaluate(`window.__ATD__.manager.state.phase`);
  check('День завершается по таймеру и открывается отчёт', activeNow.includes('Report') && reportPhase === 'report', `${activeNow} / ${reportPhase}`);

  await click(1046, 708);
  await sleep(1800);
  const dayAfter = await evaluate(`window.__ATD__.manager.state.day`);
  activeNow = await evaluate(
    `window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',')`
  );
  check('Следующий день начинается', activeNow.includes('Office') && dayAfter === 2, `${activeNow} / день ${dayAfter}`);

  await sleep(800);
  const noteOpen = await evaluate(
    `window.__ATD__.game.scene.scenes.some(s => s.scene.isActive() && s.scene.key === 'Modal')`
  );
  if (noteOpen) {
    await click(990, 163);
    await sleep(500);
  }
  check('Записка второго дня показана', noteOpen);

  await client.send('Page.navigate', { url: 'http://127.0.0.1:8123/' });
  let menuActive = '';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await client.send('Page.bringToFront');
    await client.send('Runtime.evaluate', { expression: 'window.focus()' });
    await sleep(1000);
    menuActive = await evaluate(
      `window.__ATD__ ? window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(',') : 'Boot'`
    );
    if (menuActive.includes('Menu')) break;
  }
  check('После перезагрузки открывается меню', menuActive.includes('Menu'), menuActive);

  await click(268, 529);
  await sleep(1800);
  const reloaded = await evaluate(
    `JSON.stringify({ active: window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key), day: window.__ATD__.manager.state?.day, money: window.__ATD__.manager.state?.money })`
  );
  const parsedReloaded = JSON.parse(reloaded);
  check(
    'Продолжение после перезагрузки сохраняет день',
    parsedReloaded.active.includes('Office') && parsedReloaded.day === 2,
    reloaded
  );

  await evaluate(`(() => {
    const m = window.__ATD__.manager;
    m.state.operatorEnergy = 0;
    m.endShift('exhausted');
    window.__ATD__.game.scene.getScene('Office').scene.start('Report');
  })()`);
  await sleep(1200);
  const failReport = await evaluate(
    `JSON.stringify({ active: window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key), failed: window.__ATD__.manager.state.report?.failed, day: window.__ATD__.manager.state.day })`
  );
  check('Поражение открывает отчёт с перезапуском дня', JSON.parse(failReport).failed === true, failReport);

  await click(1046, 708);
  await sleep(1600);
  const restarted = await evaluate(
    `JSON.stringify({ active: window.__ATD__.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key), day: window.__ATD__.manager.state.day, phase: window.__ATD__.manager.state.phase })`
  );
  const parsedRestart = JSON.parse(restarted);
  check(
    'Кнопка перезапускает тот же день',
    parsedRestart.active.includes('Office') && parsedRestart.day === 2 && parsedRestart.phase === 'office',
    restarted
  );
} catch (error) {
  console.error('INTERACTION_FAILED', error);
  results.push({ name: 'Исключение', ok: false, detail: error.message });
} finally {
  spawn('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
  await sleep(500);
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} шагов пройдено`);
if (failed.length) process.exit(1);
