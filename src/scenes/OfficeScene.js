/**
 * Офис оператора: монитор с шестью камерами, HUD, НАДЗОР и журнал.
 */
import { game as manager } from '../managers/GameManager.js';
import { CameraWindow } from '../entities/CameraWindow.js';
import { Operator } from '../entities/Operator.js';
import { addCoverImage } from '../ui/backdrop.js';
import {
  COLORS,
  addScanlines,
  drawBar,
  drawIcon,
  drawPanel,
  makeText,
} from '../ui/theme.js';
import { Button, LogList, StatBar, showToast } from '../ui/widgets.js';
import { formatMoney, formatTime } from '../utils/format.js';
import { threatScore } from '../systems/threat.js';

const CELL = { w: 434, h: 172, gapX: 8, gapY: 8, x: 202, y: 104 };

export class OfficeScene extends Phaser.Scene {
  constructor() {
    super('Office');
  }

  create() {
    this.state = manager.state;
    if (!this.state) {
      this.scene.start('Menu');
      return;
    }
    this.unsubs = [];
    this.lastHudSecond = -1;
    this.nextBlink = 0;
    this.saveLed = null;
    this.soundOn = this.state.settings?.sound !== false;

    manager.audio?.setMuted(!this.soundOn);

    this.buildBackground();
    this.buildMonitor();
    this.buildCameraGrid();
    this.buildOperator();
    this.buildTopBar();
    this.buildLeftPanel();
    this.buildRightPanel();
    this.buildHotkeys();

    this.bindEvents();
    this.refreshAll();
    this.refreshAi();
    this.logList.setEntries(this.state.log || []);

    this.state.settings = this.state.settings || {};
    this.state.settings.sound = this.soundOn;

    if (this.state.alarm) this.handleAlarm(this.state.alarm, false);

    this.cameras.main.fadeIn(220, 0, 0, 0);

    this.time.delayedCall(520, () => {
      const note = manager.takePendingNote();
      if (note) {
        this.scene.launch('Modal', {
          title: note.title,
          code: 'КАНАЛ ПРЕДЫДУЩЕГО ОПЕРАТОРА',
          body: `${note.text}\n\n— найденная записка, день ${note.day}`,
          accent: COLORS.purple,
          pause: true,
          typewriter: true,
          buttons: [{ label: 'УБРАТЬ В ЖУРНАЛ', variant: 'purple' }],
        });
      }
    });

    this.events.once('shutdown', () => {
      for (const off of this.unsubs) off();
      this.unsubs = [];
    });
  }

  /* ========================================================================
     Построение сцены
     ====================================================================== */

  buildBackground() {
    addCoverImage(this, 'office_bg', 1280, 800, {
      tint: 0x6d8186,
      alpha: 1,
      depth: -30,
    });
    const dark = this.add.graphics().setDepth(-20);
    dark.fillStyle(0x04080a, 0.4);
    dark.fillRect(0, 0, 1280, 800);

    // Тёмный передний план под монитором.
    const gradient = this.add.graphics().setDepth(10);
    for (let i = 0; i < 16; i += 1) {
      gradient.fillStyle(0x030708, (i / 16) * 0.94);
      gradient.fillRect(0, 648 + i * 10, 1280, 10);
    }

    this.dust = [];
    for (let i = 0; i < 18; i += 1) {
      const dot = this.add
        .circle(160 + Math.random() * 960, 120 + Math.random() * 500, Math.random() < 0.7 ? 1 : 2, 0x9fc9b8, 0.1 + Math.random() * 0.12)
        .setDepth(8);
      this.dust.push(dot);
      this.tweens.add({
        targets: dot,
        y: dot.y - 30 - Math.random() * 40,
        alpha: 0.01,
        duration: 5000 + Math.random() * 7000,
        repeat: -1,
        delay: Math.random() * 4000,
        onRepeat: () => {
          dot.y = 120 + Math.random() * 480;
          dot.x = 160 + Math.random() * 960;
          dot.setAlpha(0.1 + Math.random() * 0.12);
        },
      });
    }
  }

  buildMonitor() {
    const glow = this.add
      .ellipse(640, 360, 960, 500, 0x356e6a, 0.04)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(0);
    this.tweens.add({
      targets: glow,
      alpha: 0.018,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const g = this.add.graphics().setDepth(2);
    // Тень и корпус.
    g.fillStyle(0x000000, 0.55);
    g.fillRect(196, 94, 916, 576);
    g.fillStyle(0x0a1214, 1);
    g.fillRect(186, 84, 908, 568);
    g.fillStyle(0x16262a, 1);
    g.fillRect(190, 88, 900, 560);
    g.fillStyle(0x070d0f, 1);
    g.fillRect(194, 92, 892, 552);

    // Экран.
    g.fillStyle(0x04090a, 1);
    g.fillRect(200, 100, 880, 540);
    g.lineStyle(2, 0x1d3538, 1);
    g.strokeRect(199, 99, 882, 542);
    g.lineStyle(1, 0x2f5558, 0.7);
    g.strokeRect(201, 101, 878, 538);

    // Винты и индикаторы.
    g.fillStyle(0x2b4448, 1);
    for (const [sx, sy] of [
      [196, 94],
      [1084, 94],
      [196, 642],
      [1084, 642],
    ]) {
      g.fillCircle(sx, sy, 3);
      g.fillStyle(0x0b1416, 1);
      g.fillCircle(sx, sy, 1);
      g.fillStyle(0x2b4448, 1);
    }

    // Полоса наклеек на корпусе.
    g.fillStyle(0x1a2a2d, 0.8);
    g.fillRect(206, 88, 240, 10);
    g.fillStyle(0x0a1214, 0.9);
    g.fillRect(456, 88, 120, 10);

    makeText(this, 210, 88, 'НАДЗОР-7 / СИСТЕМА НАБЛЮДЕНИЯ', {
      size: 6,
      color: COLORS.dimmer,
      font: 'display',
    }).setDepth(3);

    const led = this.add.circle(1062, 93, 3, COLORS.green, 1).setDepth(3);
    this.tweens.add({ targets: led, alpha: 0.2, duration: 1500, yoyo: true, repeat: -1 });

    const rec = this.add.circle(1046, 93, 3, COLORS.red, 1).setDepth(3);
    this.tweens.add({ targets: rec, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
    makeText(this, 1038, 90, 'REC', {
      size: 6,
      color: COLORS.red,
      font: 'display',
      origin: [1, 0],
    }).setDepth(3);

    // Ближнее стекло.
    const glass = this.add.graphics().setDepth(7);
    glass.fillStyle(0x9fd3c8, 0.012);
    glass.fillRect(202, 102, 876, 536);
    glass.fillStyle(0xcfe8e0, 0.025);
    glass.beginPath();
    glass.moveTo(202, 102);
    glass.lineTo(520, 102);
    glass.lineTo(320, 300);
    glass.lineTo(202, 360);
    glass.closePath();
    glass.fillPath();

    addScanlines(this, 200, 100, 880, 540, 0.14, 8);
  }

  buildCameraGrid() {
    this.windows = [];
    for (let index = 0; index < 6; index += 1) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = CELL.x + col * (CELL.w + CELL.gapX);
      const y = CELL.y + row * (CELL.h + CELL.gapY);
      const window = new CameraWindow(this, x, y, index + 1, manager);
      window.setDepth(6);
      window.setOnOpen((slot) => this.openRoom(slot));
      this.windows.push(window);
    }
  }

  buildOperator() {
    const halo = this.add
      .ellipse(640, 768, 540, 250, 0x2f6a66, 0.075)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(11);
    this.tweens.add({
      targets: halo,
      alpha: 0.035,
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.operator = new Operator(this, 640, 806);
    const floor = this.add.ellipse(640, 776, 380, 60, 0x000000, 0.5).setDepth(11);
    floor.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  buildTopBar() {
    const bar = this.add.container(0, 0).setDepth(40);
    this.topBar = bar;

    const g = this.add.graphics();
    drawPanel(g, 8, 6, 1264, 72, {
      fill: 0x080f11,
      stroke: COLORS.line,
      alpha: 0.95,
      cornerColor: COLORS.lineBright,
      cornerSize: 9,
    });
    g.fillStyle(COLORS.amber, 0.65);
    g.fillRect(8, 6, 4, 72);
    bar.add(g);

    const day = makeText(this, 20, 15, 'ДЕНЬ 01', { size: 10, color: COLORS.amber, font: 'display' });
    const shift = makeText(this, 20, 37, 'СМЕНА 01', { size: 8, color: COLORS.dim, font: 'display' });
    this.dayText = day;
    this.shiftText = shift;
    bar.add([day, shift]);

    const div1 = this.add.graphics();
    div1.lineStyle(1, COLORS.line, 0.7);
    div1.lineBetween(112, 14, 112, 70);
    bar.add(div1);

    const timerLabel = makeText(this, 124, 9, 'ДО КОНЦА СМЕНЫ', {
      size: 7,
      color: COLORS.dim,
      font: 'display',
    });
    this.timerText = makeText(this, 124, 20, '08:00', {
      size: 18,
      color: COLORS.text,
      font: 'display',
    });
    this.timerBar = this.add.graphics();
    bar.add([timerLabel, this.timerText, this.timerBar]);

    const div2 = this.add.graphics();
    div2.lineStyle(1, COLORS.line, 0.7);
    div2.lineBetween(356, 14, 356, 70);
    bar.add(div2);

    const resource = (x, icon, label, color) => {
      const iconG = this.add.graphics();
      drawIcon(iconG, icon, x, 25, 20, color);
      const labelText = makeText(this, x + 28, 12, label, {
        size: 7,
        color: COLORS.dim,
        font: 'display',
      });
      const valueText = makeText(this, x + 28, 28, '—', {
        size: 11,
        color: COLORS.text,
        font: 'display',
      });
      bar.add([iconG, labelText, valueText]);
      return valueText;
    };

    this.moneyText = resource(370, 'money', 'БЮДЖЕТ', COLORS.yellow);
    this.bioText = resource(520, 'biomass', 'БИОМАССА', COLORS.green);
    this.repText = resource(670, 'rep', 'РЕПУТАЦИЯ', COLORS.cyan);
    this.offersText = resource(820, 'contract', 'ПРЕДЛОЖЕНИЯ', COLORS.amber);

    this.alarmTopLabel = makeText(this, 972, 12, 'СОСТОЯНИЕ', {
      size: 7,
      color: COLORS.dim,
      font: 'display',
    });
    this.alarmTopText = makeText(this, 972, 28, 'НОРМА', {
      size: 11,
      color: COLORS.green,
      font: 'display',
    });
    bar.add([this.alarmTopLabel, this.alarmTopText]);

    this.speedBtn = new Button(this, 1098, 22, 46, 34, '×1', {
      variant: 'ghost',
      size: 9,
      onClick: () => {
        const next = manager.state.speed === 1 ? 2 : 1;
        manager.setSpeed(next);
      },
    });
    bar.add(this.speedBtn);

    this.endShiftBtn = new Button(this, 1150, 22, 112, 34, 'ЗАВЕРШИТЬ', {
      variant: 'danger',
      size: 8,
      onClick: () => this.confirmEndShift(),
    });
    bar.add(this.endShiftBtn);
  }

  buildLeftPanel() {
    const panel = this.add.container(0, 0).setDepth(40);
    this.leftPanel = panel;

    const g = this.add.graphics();
    drawPanel(g, 8, 86, 176, 556, {
      fill: 0x080f11,
      stroke: COLORS.line,
      alpha: 0.95,
      cornerColor: COLORS.lineBright,
      cornerSize: 9,
    });
    panel.add(g);

    panel.add(
      makeText(this, 20, 94, 'ОПЕРАТОР', { size: 8, color: COLORS.amber, font: 'display' })
    );

    this.energyBar = new StatBar(this, 20, 110, 152, 'ЭНЕРГИЯ', {
      compact: true,
      labelSize: 11,
      valueSize: 11,
      color: COLORS.cyan,
    });
    panel.add(this.energyBar);

    this.coffeeBtn = new Button(this, 20, 144, 152, 32, 'КОФЕ +24 · 70₽', {
      variant: 'ghost',
      size: 7,
      icon: 'coffee',
      onClick: () => {
        const result = manager.buyCoffee();
        if (result.ok) {
          showToast(this, 'КОФЕ ВЫПИТ. ЭНЕРГИЯ ВОССТАНОВЛЕНА.', { kind: 'good', y: 660 });
          this.refreshAll();
        } else {
          showToast(this, result.reason || 'Недоступно', { kind: 'danger', y: 660 });
        }
      },
    });
    panel.add(this.coffeeBtn);

    this.powerBar = new StatBar(this, 20, 184, 152, 'ПИТАНИЕ БУНКЕРА', {
      compact: true,
      labelSize: 11,
      valueSize: 11,
      color: COLORS.green,
    });
    panel.add(this.powerBar);

    this.generatorBtn = new Button(this, 20, 218, 152, 32, 'ГЕНЕРАТОР 120₽', {
      variant: 'ghost',
      size: 7,
      icon: 'power',
      onClick: () => {
        const result = manager.restartGenerator();
        if (result.ok) showToast(this, 'ГЕНЕРАТОР ПЕРЕЗАПУЩЕН. ПИТАНИЕ +45.', { kind: 'good', y: 660 });
        else showToast(this, result.reason || 'Недоступно', { kind: 'danger', y: 660 });
        this.refreshAll();
      },
    });
    panel.add(this.generatorBtn);

    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.line, 0.8);
    divider.lineBetween(20, 260, 172, 260);
    panel.add(divider);
    panel.add(
      makeText(this, 20, 268, 'ДЕЙСТВИЯ', { size: 7, color: COLORS.dim, font: 'display' })
    );

    this.contractsBtn = new Button(this, 20, 286, 152, 44, 'КОНТРАКТЫ', {
      variant: 'amber',
      size: 9,
      icon: 'contract',
      sub: '0',
      onClick: () => this.openMarket(),
    });
    panel.add(this.contractsBtn);

    this.helpBtn = new Button(this, 20, 338, 152, 30, 'ИНСТРУКЦИЯ', {
      variant: 'ghost',
      size: 7,
      icon: 'note',
      onClick: () => this.showHelp(),
    });
    panel.add(this.helpBtn);

    this.soundBtn = new Button(this, 20, 374, 152, 28, this.soundOn ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ', {
      variant: 'ghost',
      size: 7,
      icon: this.soundOn ? 'sound' : 'mute',
      onClick: () => this.toggleSound(),
    });
    panel.add(this.soundBtn);

    // Панель тревоги / статуса.
    this.alarmBox = this.add.container(0, 0);
    this.alarmBoxG = this.add.graphics();
    this.alarmBoxTitle = makeText(this, 20, 416, 'СТАТУС', {
      size: 8,
      color: COLORS.dim,
      font: 'display',
    });
    this.alarmBoxLine1 = makeText(this, 20, 436, '', {
      size: 12,
      color: COLORS.text,
      font: 'body',
      wrap: 150,
    });
    this.alarmBoxLine2 = makeText(this, 20, 462, '', {
      size: 11,
      color: COLORS.dim,
      font: 'body',
      wrap: 150,
    });
    this.alarmOpenBtn = new Button(this, 20, 500, 152, 38, 'ОТКРЫТЬ', {
      variant: 'danger',
      size: 8,
      onClick: () => {
        if (manager.state.alarm) this.openRoom(manager.state.alarm.slot);
      },
    });
    this.alarmBox.add([
      this.alarmBoxG,
      this.alarmBoxTitle,
      this.alarmBoxLine1,
      this.alarmBoxLine2,
      this.alarmOpenBtn,
    ]);
    panel.add(this.alarmBox);

    this.shiftStatsText = makeText(this, 20, 562, '', {
      size: 10,
      color: COLORS.dim,
      font: 'body',
      wrap: 150,
      lineSpacing: 2,
    });
    panel.add(this.shiftStatsText);
    panel.add(
      makeText(this, 20, 620, 'ESC — ПАУЗА', { size: 7, color: COLORS.dimmer, font: 'display' })
    );
  }

  buildRightPanel() {
    const panel = this.add.container(0, 0).setDepth(40);
    this.rightPanel = panel;

    const g = this.add.graphics();
    drawPanel(g, 1096, 86, 176, 556, {
      fill: 0x080f11,
      stroke: COLORS.line,
      alpha: 0.95,
      cornerColor: COLORS.lineBright,
      cornerSize: 9,
    });
    panel.add(g);

    const title = makeText(this, 1108, 94, 'НАДЗОР-7', {
      size: 8,
      color: COLORS.green,
      font: 'display',
    });
    panel.add(title);
    const dot = this.add.circle(1258, 99, 3, COLORS.green, 1);
    this.tweens.add({ targets: dot, alpha: 0.2, duration: 1300, yoyo: true, repeat: -1 });
    panel.add(dot);

    panel.add(
      makeText(this, 1108, 114, 'ДОВЕРИЕ', { size: 10, color: COLORS.dim, font: 'body' })
    );
    this.trustText = makeText(this, 1260, 113, '50', {
      size: 9,
      color: COLORS.text,
      font: 'display',
      origin: [1, 0],
    });
    panel.add(this.trustText);
    this.trustBar = this.add.graphics();
    panel.add(this.trustBar);

    this.aiContainer = this.add.container(0, 0);
    panel.add(this.aiContainer);

    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.line, 0.8);
    divider.lineBetween(1108, 418, 1260, 418);
    panel.add(divider);
    panel.add(
      makeText(this, 1108, 426, 'ЖУРНАЛ', { size: 7, color: COLORS.dim, font: 'display' })
    );

    this.logList = new LogList(this, 1108, 440, 152, 188, { size: 12, maxLines: 11 });
    panel.add(this.logList);
  }

  buildHotkeys() {
    this.input.keyboard?.on('keydown-ESC', () => this.openPause());
    this.input.keyboard?.on('keydown-M', () => this.toggleSound());
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (manager.state?.alarm) this.openRoom(manager.state.alarm.slot);
    });
    this.input.keyboard?.on('keydown-TAB', () => this.openMarket());
    this.input.keyboard?.on('keydown-H', () => this.showHelp());
  }

  /* ========================================================================
     Обновление
     ====================================================================== */

  bindEvents() {
    const on = (event, handler) => this.unsubs.push(manager.bus.on(event, handler));

    on('tick', () => this.refreshAll());
    on('creature', () => {
      this.refreshWindows();
      this.refreshHud();
    });
    on('money', () => this.refreshHud());
    on('energy', () => this.refreshHud());
    on('power', () => this.refreshHud());
    on('biomass', () => this.refreshHud());
    on('reputation', () => this.refreshHud());
    on('offers', () => this.refreshHud());

    on('log', () => {
      if (this.logList) this.logList.setEntries(manager.state.log);
      this.logFlash = 1;
    });

    on('ai', () => {
      this.refreshAi();
      if (manager.audio) manager.audio.glitch();
    });

    on('notice', (notice) => {
      showToast(this, notice.text, { kind: notice.kind, y: 660 });
      if (notice.kind === 'danger' && manager.audio) manager.audio.error();
    });

    on('alarm', (alarm) => this.handleAlarm(alarm, true));
    on('alarm-cleared', () => this.clearAlarm());
    on('escape', (escape) => this.handleEscape(escape));
    on('shift-end', () => {
      manager.audio?.stopAlarm?.();
      this.scene.start('Report');
    });
    on('blackout', () => {
      this.showToast('ПИТАНИЕ ОТКЛЮЧЕНО. КАМЕРЫ НЕ РАБОТАЮТ.', 'danger');
      this.refreshAll();
    });
    on('contract-done', (result) => {
      if (result.outcome === 'critical' || result.outcome === 'success') {
        showToast(this, `КОНТРАКТ: ${result.name} · ВЫПЛАТА ${formatMoney(result.payout)} ₽`, {
          kind: 'good',
          y: 660,
        });
      }
      this.refreshAll();
    });
    on('speed', () => this.refreshHud());
    on('save', () => this.flashSave());
    on('mutation', () => {
      manager.audio?.mutate?.();
      this.cameras.main.shake(220, 0.004);
      this.refreshAll();
    });
  }

  refreshAll() {
    if (!manager.state) return;
    this.refreshHud();
    this.refreshWindows();
    if (this.state.alarm && this.state.alarm !== manager.state.alarm) {
      this.clearAlarm();
    }
    if (manager.state.alarm) {
      this.alarmBoxLine1.setText(`СЕКТОР ${String(manager.state.alarm.slot).padStart(2, '0')}`);
      this.alarmBoxLine2.setText(
        `ДО ПОБЕГА: ${Math.max(0, Math.ceil(manager.state.alarm.countdown))} С`
      );
    }
  }

  refreshWindows() {
    if (!this.windows) return;
    for (const window of this.windows) window.refresh();
  }

  refreshHud() {
    const state = manager.state;
    if (!state || !this.timerText) return;

    this.dayText.setText(`ДЕНЬ ${String(state.day).padStart(2, '0')}`);
    this.shiftText.setText(`СМЕНА ${String(state.shift).padStart(2, '0')}`);
    this.timerText.setText(formatTime(state.shiftTimeLeft));
    this.timerText.setColor(state.shiftTimeLeft <= 60 ? COLORS.red : COLORS.white);
    this.timerBar.clear();
    drawBar(
      this.timerBar,
      124,
      58,
      210,
      5,
      (state.shiftTimeLeft / Math.max(1, state.shiftDuration)) * 100,
      state.shiftTimeLeft <= 60 ? COLORS.red : COLORS.green,
      { ticks: false }
    );

    this.moneyText.setText(formatMoney(state.money));
    this.bioText.setText(String(Math.round(state.biomass)));
    this.repText.setText(String(Math.round(state.reputation)));
    this.offersText.setText(String(state.offers?.length || 0));
    this.offersText.setColor(state.offers?.length ? COLORS.amber : COLORS.dimmer);

    this.energyBar.setValue(state.operatorEnergy, state.operatorEnergy < 25 ? COLORS.red : COLORS.cyan);
    this.powerBar.setValue(state.power, state.power < 30 ? COLORS.red : COLORS.green);
    this.powerBar.labelObj.setText(
      state.blackout ? 'ПИТАНИЕ · АВАРИЯ' : 'ПИТАНИЕ БУНКЕРА'
    );
    this.generatorBtn.setVariant(state.blackout ? 'danger' : 'ghost');

    this.contractsBtn.setSub(String(state.offers?.length || 0));
    this.contractsBtn.setEnabled(state.offers?.length > 0);

    this.speedBtn.setLabel(state.speed === 2 ? '×2' : '×1');
    this.speedBtn.setVariant(state.speed === 2 ? 'amber' : 'ghost');

    this.shiftStatsText.setText(
      `КОНТРАКТЫ ${state.stats.contractsDone} · ПОБЕГИ ${state.stats.escapes}`
    );

    this.trustText.setText(String(Math.round(state.plot.aiTrust)));
    this.trustBar.clear();
    drawBar(this.trustBar, 1108, 130, 148, 4, state.plot.aiTrust, COLORS.cyan, { ticks: false });

    if (state.alarm) {
      this.alarmTopLabel.setText('ТРЕВОГА');
      this.alarmTopText.setColor(COLORS.red);
      this.alarmTopText.setText(
        `${String(state.alarm.slot).padStart(2, '0')} · ${Math.max(0, Math.ceil(state.alarm.countdown))}С`
      );
      this.alarmBoxTitle.setText('ТРЕВОГА');
      this.alarmBoxTitle.setColor(COLORS.red);
      this.alarmOpenBtn.setVisible(true);
      this.alarmBoxLine1.setColor(COLORS.text);
      this.alarmBoxLine2.setColor(COLORS.amber);
    } else {
      this.alarmTopLabel.setText('СОСТОЯНИЕ');
      this.alarmTopText.setColor(COLORS.green);
      this.alarmTopText.setText(state.blackout ? 'АВАРИЯ' : 'НОРМА');
      this.alarmBoxTitle.setText('СТАТУС');
      this.alarmBoxTitle.setColor(COLORS.dim);
      this.alarmBoxLine1.setText(
        state.blackout ? 'ПИТАНИЕ ОТСУТСТВУЕТ' : 'СИСТЕМА СТАБИЛЬНА'
      );
      this.alarmBoxLine1.setColor(state.blackout ? COLORS.red : COLORS.green);
      const maxThreat = Math.max(
        0,
        ...state.creatures.filter((c) => c.defId && ['idle', 'training'].includes(c.status)).map(threatScore)
      );
      this.alarmBoxLine2.setText(`МАКС. РИСК: ${Math.round(maxThreat)} / 74`);
      this.alarmBoxLine2.setColor(maxThreat >= 60 ? COLORS.amber : COLORS.dim);
      this.alarmOpenBtn.setVisible(false);
    }

    this.alarmBoxG.clear();
    if (state.alarm) {
      drawPanel(this.alarmBoxG, 16, 408, 160, 142, {
        fill: 0x1e0c09,
        stroke: COLORS.red,
        alpha: 0.95,
        cornerColor: COLORS.red,
        cornerSize: 8,
      });
    } else {
      drawPanel(this.alarmBoxG, 16, 408, 160, 142, {
        fill: 0x0a1113,
        stroke: COLORS.line,
        alpha: 0.9,
        cornerSize: 6,
      });
    }

    this.coffeeBtn.setEnabled(state.coffeeUsed < 3 && state.money >= 70);
    this.generatorBtn.setEnabled(state.money >= 120);
  }

  refreshAi() {
    if (!this.aiContainer) return;
    this.aiContainer.removeAll(true);
    const messages = (manager.state?.aiMessages || []).slice(-3);
    let y = 152;
    messages.forEach((message, index) => {
      const newest = index === messages.length - 1;
      const text = makeText(this, 1108, y, message.text, {
        size: 12,
        color: newest ? COLORS.green : COLORS.dimmer,
        font: 'body',
        wrap: 150,
        lineSpacing: 2,
      });
      this.aiContainer.add(text);
      y += text.height + 10;
    });
    if (!messages.length) {
      const empty = makeText(this, 1108, 160, 'НЕТ СООБЩЕНИЙ', {
        size: 11,
        color: COLORS.dimmer,
        font: 'body',
      });
      this.aiContainer.add(empty);
    }
  }

  update(time, delta) {
    if (!manager.state) return;
    manager.tick(delta);
    this.operator?.update(time);
    for (const window of this.windows) window.tickUpdate(time);

    if (this.alarmPulse) {
      this.alarmPulse.alpha = 0.25 + Math.sin(time / 200) * 0.2;
    }

    const energy = manager.state?.operatorEnergy ?? 100;
    if (energy < 25 && time > this.nextBlink) {
      this.nextBlink = time + 3200 + Math.random() * 3800;
      this.cameras.main.shake(140, 0.0018);
      const overlay = this.add.rectangle(0, 0, 1280, 800, 0x000000, 0.35).setOrigin(0).setDepth(70);
      this.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 240,
        onComplete: () => overlay.destroy(),
      });
    }

    if (this.logFlash > 0) {
      this.logFlash -= delta / 380;
      this.logList.setAlpha(1 + Math.max(0, this.logFlash) * 0.25);
    }
  }

  /* ========================================================================
     Тревога / побег
     ====================================================================== */

  handleAlarm(alarm, withSound = true) {
    if (!alarm) return;
    this.operator?.setTense(true);
    if (withSound) manager.audio?.startAlarm?.();
    showToast(
      this,
      `ТРЕВОГА: СЕКТОР ${String(alarm.slot).padStart(2, '0')} · ОТКРОЙТЕ КАМЕРУ`,
      { kind: 'danger', y: 660, duration: 3600 }
    );
    this.alarmPulse = this.add
      .rectangle(0, 0, 1280, 800, 0xd8503f, 0.05)
      .setOrigin(0)
      .setDepth(45);
    this.tweens.add({
      targets: this.alarmPulse,
      alpha: 0.12,
      duration: 420,
      yoyo: true,
      repeat: -1,
    });
    this.refreshAll();
  }

  clearAlarm() {
    this.operator?.setTense(false);
    manager.audio?.stopAlarm?.();
    if (this.alarmPulse) {
      this.alarmPulse.destroy();
      this.alarmPulse = null;
    }
    this.refreshAll();
  }

  handleEscape(escape) {
    manager.audio?.stopAlarm?.();
    this.scene.start('Horror', escape);
  }

  /* ========================================================================
     Действия
     ====================================================================== */

  openRoom(slot) {
    if (!manager.state || manager.state.phase !== 'office') return;
    manager.audio?.glitch?.();
    this.cameras.main.fadeOut(170, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Room', { slot });
    });
  }

  openMarket() {
    manager.audio?.ui?.();
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Market');
    });
  }

  confirmEndShift() {
    this.scene.launch('Modal', {
      title: 'ЗАВЕРШИТЬ СМЕНУ?',
      body:
        'Смена будет завершена досрочно. Вы получите жалование и биомассу, но не успеете выполнить всё запланированное.\n\n' +
        'Существа на контрактах продолжат работу.',
      accent: COLORS.amber,
      pause: true,
      typewriter: false,
      buttons: [
        {
          label: 'ЗАВЕРШИТЬ',
          variant: 'danger',
          onClick: () => {
            manager.setPaused(false);
            this.scene.stop('Modal');
            manager.endShift('manual');
          },
        },
        { label: 'ОСТАТЬСЯ', variant: 'ghost' },
      ],
    });
  }

  showHelp() {
    manager.audio?.ui?.();
    this.cameras.main.fadeOut(140, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Guide', { from: 'Office' });
    });
  }

  openPause() {
    this.scene.launch('Modal', {
      title: 'ПАУЗА',
      body: `День ${manager.state?.day}, смена ${manager.state?.shift}.\nВремя смены остановлено.`,
      accent: COLORS.cyan,
      pause: true,
      typewriter: false,
      buttons: [
        { label: 'ПРОДОЛЖИТЬ', variant: 'primary' },
        {
          label: 'СОХРАНИТЬ',
          variant: 'ghost',
          onClick: () => {
            manager.save(true);
            showToast(this, 'ПРОГРЕСС СОХРАНЁН', { kind: 'good', y: 660 });
          },
        },
        {
          label: 'В МЕНЮ',
          variant: 'ghost',
          onClick: () => {
            manager.save(true);
            manager.setPaused(false);
            this.scene.stop('Modal');
            this.scene.start('Menu');
          },
        },
      ],
    });
  }

  toggleSound() {
    this.soundOn = !this.soundOn;
    manager.audio?.init();
    manager.audio?.setMuted(!this.soundOn);
    if (manager.state?.settings) manager.state.settings.sound = this.soundOn;
    this.soundBtn.setLabel(this.soundOn ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ');
    this.soundBtn.setVariant(this.soundOn ? 'ghost' : 'danger');
    manager.save();
  }

  flashSave() {
    if (this.saveLed) return;
    this.saveLed = this.add.circle(1240, 74, 3, COLORS.green, 1).setDepth(41);
    this.tweens.add({
      targets: this.saveLed,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        this.saveLed?.destroy();
        this.saveLed = null;
      },
    });
  }
}
