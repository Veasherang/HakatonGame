/**
 * Комната существа: диорама, характеристики, кормление, обучение,
 * успокоение, улучшения, мутации, контракты и аварийное сдерживание.
 */
import { game as manager } from '../managers/GameManager.js';
import { getMutation, skillNodes } from '../data/creatures.js';
import { FOODS } from '../data/food.js';
import { UPGRADES, UPGRADE_MAX_LEVEL, maxIntegrity, upgradeCost } from '../data/upgrades.js';
import { CARE_TOOL_LIST } from '../data/tools.js';
import { professionLabel } from '../data/companies.js';
import { BALANCE, STAT_META } from '../config/balance.js';
import { addCoverImage } from '../ui/backdrop.js';
import { COLORS, addScanlines, drawBar, drawIcon, drawPanel, makeText, statColor } from '../ui/theme.js';
import { Button, StatBar, showToast } from '../ui/widgets.js';
import { addPumpkin } from '../ui/pumpkin.js';
import { formatMoney, roman } from '../utils/format.js';

const PANEL = { x: 896, y: 8, w: 376, h: 784 };
const INNER = { x: 916, w: 336 };
const ROOM_FRAME = { x: 48, y: 84, w: 820, h: 606 };

export class RoomScene extends Phaser.Scene {
  constructor() {
    super('Room');
  }

  init(data) {
    this.slot = data?.slot || 1;
  }

  create() {
    this.state = manager.state;
    this.creature = manager.get(this.slot);
    this.def = manager.def(this.slot);

    if (!this.state || !this.creature) {
      this.scene.start('Menu');
      return;
    }

    this.unsubs = [];
    this.defenseMode = false;
    this.modal = null;
    this.modalSpec = null;
    this.monsterStage = this.creature.stage;

    this.buildBackground();
    this.buildDiorama();
    this.buildPumpkins();
    this.buildTopBar();
    this.buildPanel();
    this.buildActions();
    this.buildInterference();
    this.buildDefense();
    this.bindEvents();

    this.refreshAll();
    this.cameras.main.fadeIn(200, 0, 0, 0);

    if (this.state.alarm?.slot === this.slot) this.enterDefense();
    else if (this.state.alarm) this.showOtherAlarm();

    this.events.once('shutdown', () => {
      for (const off of this.unsubs) off();
      this.unsubs = [];
      this.modal = null;
    });
  }

  /* ========================================================================
     Построение
     ====================================================================== */

  buildBackground() {
    addCoverImage(this, 'room_bg', 1280, 800, { tint: 0x94a89f, alpha: 1, depth: -30 });
    const dark = this.add.graphics().setDepth(-20);
    dark.fillStyle(0x030708, 0.34);
    dark.fillRect(0, 0, 1280, 800);

    const rightShade = this.add.graphics().setDepth(-19);
    rightShade.fillStyle(0x030708, 0.35);
    rightShade.fillRect(890, 0, 390, 800);
  }

  buildDiorama() {
    const frame = this.add.graphics().setDepth(2);
    frame.lineStyle(2, 0x355e61, 0.65);
    frame.strokeRect(ROOM_FRAME.x, ROOM_FRAME.y, ROOM_FRAME.w, ROOM_FRAME.h);
    frame.lineStyle(1, 0x9fd3c8, 0.08);
    frame.strokeRect(ROOM_FRAME.x + 6, ROOM_FRAME.y + 6, ROOM_FRAME.w - 12, ROOM_FRAME.h - 12);

    // Уголки «стекла».
    frame.lineStyle(3, 0x6fb8b4, 0.55);
    const corners = [
      [ROOM_FRAME.x, ROOM_FRAME.y, 1, 1],
      [ROOM_FRAME.x + ROOM_FRAME.w, ROOM_FRAME.y, -1, 1],
      [ROOM_FRAME.x, ROOM_FRAME.y + ROOM_FRAME.h, 1, -1],
      [ROOM_FRAME.x + ROOM_FRAME.w, ROOM_FRAME.y + ROOM_FRAME.h, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      frame.lineBetween(x, y, x + 26 * sx, y);
      frame.lineBetween(x, y, x, y + 26 * sy);
    }

    // Блик стекла.
    frame.fillStyle(0xcfe8e0, 0.025);
    frame.beginPath();
    frame.moveTo(ROOM_FRAME.x + 20, ROOM_FRAME.y + 10);
    frame.lineTo(ROOM_FRAME.x + 260, ROOM_FRAME.y + 10);
    frame.lineTo(ROOM_FRAME.x + 80, ROOM_FRAME.y + 240);
    frame.lineTo(ROOM_FRAME.x + 20, ROOM_FRAME.y + 300);
    frame.closePath();
    frame.fillPath();

    addScanlines(this, ROOM_FRAME.x, ROOM_FRAME.y, ROOM_FRAME.w, ROOM_FRAME.h, 0.12, 30);

    // Лампа и вентиляция.
    this.lightGlow = this.add
      .ellipse(150, 160, 320, 220, 0xf0c24a, 0.05)
      .setDepth(1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.ventLines = this.add.graphics().setDepth(1);
    this.containmentGlow = this.add.graphics().setDepth(1);

    this.monsterShadow = this.add.ellipse(450, 664, 300, 46, 0x000000, 0.55).setDepth(4);
    this.monster = this.add.image(450, 664, 'bobek_1').setOrigin(0.5, 1).setDepth(5);
    this.monsterBase = { x: 450, y: 664 };
    this.updateMonsterTexture();
    this.bobTween = this.tweens.add({
      targets: this.monster,
      y: this.monsterBase.y - 3,
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Пыль в комнате.
    for (let i = 0; i < 14; i += 1) {
      const dot = this.add
        .circle(80 + Math.random() * 760, 120 + Math.random() * 480, Math.random() < 0.7 ? 1 : 2, 0xa8c8ba, 0.12)
        .setDepth(3);
      this.tweens.add({
        targets: dot,
        y: dot.y - 30,
        alpha: 0.01,
        duration: 6000 + Math.random() * 5000,
        repeat: -1,
        delay: Math.random() * 3000,
        onRepeat: () => {
          dot.y = 120 + Math.random() * 480;
          dot.x = 80 + Math.random() * 760;
          dot.setAlpha(0.08 + Math.random() * 0.1);
        },
      });
    }

    // Аварийные лампы.
    for (const x of [64, 852]) {
      const lamp = this.add.circle(x, 98, 4, COLORS.red, 0.9).setDepth(6);
      this.tweens.add({ targets: lamp, alpha: 0.15, duration: 1500, yoyo: true, repeat: -1 });
    }

    this.buildStateOverlay();
  }

  buildObjectButtons() {
    const items = [
      { x: 70, y: 112, label: 'СВЕТ', icon: 'lamp', action: () => this.calmAction('light') },
      { x: 350, y: 112, label: 'СДЕРЖИВАНИЕ', icon: 'shield', action: () => this.openUpgradePanel('security') },
      { x: 680, y: 112, label: 'ВЕНТИЛЯЦИЯ', icon: 'vent', action: () => this.calmAction('vent') },
      { x: 70, y: 628, label: 'КОРМУШКА', icon: 'bowl', action: () => this.openFeedPanel() },
      { x: 680, y: 628, label: 'ЛЕЖАНКА', icon: 'calm', action: () => this.restAction() },
    ];
    this.objectButtons = [];
    for (const item of items) {
      const button = new Button(this, item.x, item.y, 168, 38, item.label, {
        variant: 'ghost',
        size: 8,
        icon: item.icon,
        onClick: item.action,
      });
      button.setDepth(20);
      button.setAlpha(0.92);
      this.objectButtons.push(button);
    }
  }

  buildStateOverlay() {
    this.stateOverlay = this.add.container(0, 0).setDepth(25).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(0x04080a, 0.82);
    g.fillRect(ROOM_FRAME.x, ROOM_FRAME.y, ROOM_FRAME.w, ROOM_FRAME.h);
    this.stateTitle = makeText(this, 458, 300, '', {
      size: 16,
      color: COLORS.amber,
      font: 'display',
      origin: [0.5, 0.5],
    });
    this.stateSub = makeText(this, 458, 340, '', {
      size: 15,
      color: COLORS.text,
      font: 'body',
      align: 'center',
      wrap: 620,
      origin: [0.5, 0],
    });
    this.stateBar = this.add.graphics();
    this.stateFoot = makeText(this, 458, 420, '', {
      size: 12,
      color: COLORS.dim,
      font: 'body',
      align: 'center',
      wrap: 620,
      origin: [0.5, 0],
    });
    this.stateOverlay.add([g, this.stateTitle, this.stateSub, this.stateBar, this.stateFoot]);
  }

  /** Случайная декоративная тыква на безопасном месте у стены. */
  buildPumpkins() {
    const slots = [
      { x: 150, y: 668, flip: false },
      { x: 790, y: 668, flip: true },
    ];
    const slot = Phaser.Utils.Array.GetRandom(slots);
    this.pumpkin = addPumpkin(this, {
      x: slot.x + Phaser.Math.Between(-8, 8),
      y: slot.y + Phaser.Math.Between(-3, 3),
      minHeight: 100,
      maxHeight: 125,
      depth: 4,
      flip: slot.flip,
    });
  }

  buildTopBar() {
    const top = this.add.graphics().setDepth(38);
    top.fillStyle(0x050b0d, 0.72);
    top.fillRect(0, 0, 890, 76);
    top.lineStyle(1, COLORS.line, 0.6);
    top.lineBetween(0, 75.5, 890, 75.5);

    this.backBtn = new Button(this, 20, 18, 106, 36, 'НАЗАД', {
      variant: 'ghost',
      size: 8,
      icon: 'back',
      onClick: () => this.goBack(),
    });
    this.backBtn.setDepth(40);

    const name = this.def ? this.def.name : 'ПУСТО';
    makeText(this, 146, 16, `${this.def?.sector || 'СЕКТОР'} · ${name}`, {
      size: 10,
      color: COLORS.text,
      font: 'display',
    }).setDepth(40);
    makeText(this, 146, 38, this.def ? this.def.species : 'СЕКТОР НЕ ВВЕДЁН В ЭКСПЛУАТАЦИЮ', {
      size: 12,
      color: COLORS.dim,
      font: 'body',
    }).setDepth(40);

    this.topStatus = makeText(this, 862, 16, '', {
      size: 8,
      color: COLORS.dim,
      font: 'display',
      origin: [1, 0],
    }).setDepth(40);
    this.topSub = makeText(this, 862, 38, '', {
      size: 12,
      color: COLORS.dimmer,
      font: 'body',
      origin: [1, 0],
    }).setDepth(40);

    this.topResources = makeText(this, 338, 14, '', {
      size: 9,
      color: COLORS.amber,
      font: 'display',
    }).setDepth(40);
    this.topResources2 = makeText(this, 338, 38, '', {
      size: 8,
      color: COLORS.dim,
      font: 'display',
    }).setDepth(40);

    this.helpBtn = new Button(this, 560, 16, 124, 34, 'ПОМОЩЬ', {
      variant: 'ghost',
      size: 7,
      icon: 'note',
      onClick: () => this.openGuide(),
    });
    this.helpBtn.setDepth(41);
    this.backBtn.setDepth(40);
  }

  buildPanel() {
    const panel = this.add.container(0, 0).setDepth(40);
    this.rightPanel = panel;

    const g = this.add.graphics();
    drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, {
      fill: 0x080f11,
      stroke: COLORS.line,
      alpha: 0.96,
      cornerColor: COLORS.lineBright,
      cornerSize: 12,
    });
    g.fillStyle(COLORS.amber, 0.6);
    g.fillRect(PANEL.x, PANEL.y, 3, PANEL.h);
    panel.add(g);

    const name = this.def ? this.def.name : 'ПУСТО';
    this.panelName = makeText(this, INNER.x, 22, name, {
      size: 16,
      color: COLORS.text,
      font: 'display',
    });
    this.panelSubject = makeText(this, INNER.x, 50, this.def?.subject || '—', {
      size: 8,
      color: COLORS.dimmer,
      font: 'display',
    });
    this.panelSpecies = makeText(this, INNER.x, 66, this.def?.species || '', {
      size: 12,
      color: COLORS.dim,
      font: 'body',
    });
    this.panelLevel = makeText(this, INNER.x, 86, '', {
      size: 8,
      color: COLORS.amber,
      font: 'display',
    });
    panel.add([this.panelName, this.panelSubject, this.panelSpecies, this.panelLevel]);

    this.bars = {};
    const keys = ['hunger', 'stress', 'energy', 'health', 'aggression', 'cleanliness', 'integrity', 'loyalty'];
    keys.forEach((key, index) => {
      const bar = new StatBar(this, INNER.x, 146 + index * 27, INNER.w, STAT_META[key].label, {
        compact: true,
        labelSize: 12,
        valueSize: 9,
        color: STAT_META[key].color,
      });
      this.bars[key] = bar;
      panel.add(bar);
    });

    this.readyLabel = makeText(this, INNER.x, 108, 'ГОТОВНОСТЬ К КОНТРАКТУ', {
      size: 10,
      color: COLORS.dim,
      font: 'body',
    });
    this.readyValue = makeText(this, INNER.x + INNER.w, 104, '0', {
      size: 14,
      color: COLORS.text,
      font: 'display',
      origin: [1, 0],
    });
    this.readyBar = this.add.graphics();
    panel.add([this.readyLabel, this.readyValue, this.readyBar]);

    this.mutationLabel = makeText(this, INNER.x, 356, 'ШКАЛА МУТАЦИИ', {
      size: 8,
      color: COLORS.purple,
      font: 'display',
    });
    this.mutationValue = makeText(this, INNER.x + INNER.w, 354, '', {
      size: 8,
      color: COLORS.purple,
      font: 'display',
      origin: [1, 0],
    });
    this.mutationBar = this.add.graphics();
    panel.add([this.mutationLabel, this.mutationValue, this.mutationBar]);

    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.line, 0.75);
    divider.lineBetween(INNER.x, 396, INNER.x + INNER.w, 396);
    panel.add(divider);

    panel.add(
      makeText(this, INNER.x, 404, 'ПОВЕДЕНИЕ', { size: 7, color: COLORS.dim, font: 'display' })
    );
    this.hintText = makeText(this, INNER.x, 420, '', {
      size: 12,
      color: COLORS.dim,
      font: 'body',
      wrap: INNER.w,
      lineSpacing: 3,
    });
    panel.add(this.hintText);

    panel.add(
      makeText(this, INNER.x, 486, 'ОБОРУДОВАНИЕ', { size: 7, color: COLORS.dim, font: 'display' })
    );
    this.equipTexts = [];
    this.equipPips = this.add.graphics();
    panel.add(this.equipPips);
    for (let i = 0; i < 6; i += 1) {
      const key = Object.keys(UPGRADES)[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const text = makeText(this, INNER.x + col * 168, 504 + row * 24, UPGRADES[key].short, {
        size: 11,
        color: COLORS.dim,
        font: 'body',
      });
      this.equipTexts.push({ key, text });
      panel.add(text);
    }

    this.infoText = makeText(this, INNER.x, 590, '', {
      size: 11,
      color: COLORS.dimmer,
      font: 'body',
      wrap: INNER.w,
    });
    this.prefText = makeText(this, INNER.x, 608, '', {
      size: 11,
      color: COLORS.dimmer,
      font: 'body',
      wrap: INNER.w,
    });
    this.statusText = makeText(this, INNER.x, 628, '', {
      size: 12,
      color: COLORS.text,
      font: 'body',
      wrap: INNER.w,
      lineSpacing: 2,
    });
    panel.add([this.infoText, this.prefText, this.statusText]);

    this.emergencyBtn = new Button(this, INNER.x, 700, INNER.w, 38, 'АВАРИЙНЫЙ ПРОТОКОЛ', {
      variant: 'danger',
      size: 8,
      icon: 'skull',
      onClick: () => this.confirmEmergency(),
    });
    panel.add(this.emergencyBtn);

    this.replacementBtn = new Button(this, INNER.x, 744, INNER.w, 38, 'ЗАПРОСИТЬ ЗАМЕНУ', {
      variant: 'amber',
      size: 8,
      icon: 'mutate',
      sub: '2600 ₽',
      onClick: () => this.confirmReplacement(),
    });
    this.replacementBtn.setVisible(false);
    panel.add(this.replacementBtn);
  }

  buildActions() {
    this.actionBar = this.add.container(0, 0).setDepth(40);
    const labels = [
      ['feed', 'КОРМИТЬ'],
      ['clean', 'ПОМЫТЬ'],
      ['train', 'ОБУЧАТЬ'],
      ['calm', 'УСПОКОИТЬ'],
      ['rest', 'ОТДЫХ'],
      ['repair', 'РЕМОНТ'],
      ['upgrade', 'УЛУЧШИТЬ'],
      ['mutate', 'МУТИРОВАТЬ'],
      ['contract', 'КОНТРАКТ'],
    ];
    this.actionButtons = {};
    labels.forEach(([key, label], index) => {
      const button = new Button(this, 24 + index * 96, 716, 90, 48, label, {
        variant: key === 'feed' ? 'primary' : key === 'contract' ? 'amber' : 'default',
        size: 8,
        onClick: () => this.onAction(key),
      });
      this.actionBar.add(button);
      this.actionButtons[key] = button;
    });

    this.actionHint = makeText(this, 24, 692, '', {
      size: 11,
      color: COLORS.dimmer,
      font: 'body',
    }).setDepth(40);
  }

  buildInterference() {
    const container = this.add.container(0, 0).setDepth(60).setVisible(false);
    const dim = this.add
      .rectangle(0, 0, 1280, 800, 0x010203, 1)
      .setOrigin(0)
      .setInteractive();
    const noise = this.add
      .tileSprite(0, 0, 1280, 800, 'noise0')
      .setOrigin(0)
      .setAlpha(0.35);
    const title = makeText(this, 640, 190, 'СИГНАЛ ПОТЕРЯН', {
      size: 20,
      color: COLORS.red,
      font: 'display',
      origin: [0.5, 0],
    });
    const subtitle = makeText(
      this,
      640,
      228,
      'ПОМЕХИ ПОЛНОСТЬЮ ЗАКРЫВАЮТ КАМЕРУ.\nСУБЪЕКТ НЕ ВИДЕН. СТАТУС НЕИЗВЕСТЕН.\nВОССТАНОВИТЕ КАНАЛ ИЛИ ДОЖДИТЕСЬ.',
      { size: 14, color: COLORS.text, font: 'body', align: 'center', origin: [0.5, 0], lineSpacing: 5 }
    );
    const timer = makeText(this, 640, 320, '', {
      size: 28,
      color: COLORS.red,
      font: 'display',
      origin: [0.5, 0],
    });
    const clear = new Button(this, 420, 390, 440, 50, 'ВОССТАНОВИТЬ СВЯЗЬ', {
      variant: 'danger',
      size: 9,
      icon: 'sensor',
      onClick: () => this.openInterferenceGame(),
    });
    const back = new Button(this, 20, 18, 106, 36, 'НАЗАД', {
      variant: 'ghost',
      size: 8,
      icon: 'back',
      onClick: () => this.goBack(),
    });
    container.add([dim, noise, title, subtitle, timer, clear, back]);
    this.interference = { container, noise, timer, clear, game: null };
  }

  openInterferenceGame(forcedVariant = null) {
    if (this.interference?.game) return;
    const variant = forcedVariant || (Math.random() < 0.5 ? 'clicker' : 'digits');
    const game = this.add.container(0, 0).setDepth(70);
    const panel = this.add.graphics();
    drawPanel(panel, 250, 180, 780, 440, {
      fill: 0x070d0f,
      stroke: COLORS.red,
      alpha: 0.99,
      cornerColor: COLORS.red,
      cornerSize: 14,
    });
    const heading = makeText(this, 280, 200, 'ВОССТАНОВЛЕНИЕ КАНАЛА', {
      size: 13,
      color: COLORS.red,
      font: 'display',
    });
    const close = new Button(this, 960, 196, 44, 34, 'X', {
      variant: 'ghost',
      size: 8,
      onClick: () => this.closeInterferenceGame(),
    });
    game.add([panel, heading, close]);

    if (variant === 'clicker') this.buildJamClicker(game);
    else this.buildJamDigits(game);
    this.interference.game = game;
  }

  buildJamClicker(game) {
    const target = 5 + Math.floor(Math.random() * 6);
    let clicks = 0;
    const hint = makeText(this, 640, 250, 'ПОМЕХИ ДРОЖАТ. НАЖИМАЙ, ЧТОБЫ СТАБИЛИЗИРОВАТЬ КАНАЛ.', {
      size: 14,
      color: COLORS.text,
      font: 'body',
      origin: [0.5, 0],
      align: 'center',
      wrap: 700,
    });
    const count = makeText(this, 640, 292, '', {
      size: 11,
      color: COLORS.amber,
      font: 'display',
      origin: [0.5, 0],
    });
    const bar = this.add.graphics();
    const button = new Button(this, 490, 390, 300, 90, 'СТАБИЛИЗИРОВАТЬ', {
      variant: 'danger',
      size: 10,
      onClick: () => {
        clicks += 1;
        count.setText(`${clicks} / ${target}`);
        bar.clear();
        drawBar(bar, 440, 350, 400, 12, (clicks / target) * 100, COLORS.red, { ticks: true });
        this.cameras.main.shake(35, 0.001);
        if (clicks >= target) this.completeInterferenceGame();
      },
    });
    game.add([hint, count, bar, button]);
    count.setText(`0 / ${target}`);
    drawBar(bar, 440, 350, 400, 12, 0, COLORS.red, { ticks: true });
  }

  buildJamDigits(game) {
    const count = 4 + Math.floor(Math.random() * 3);
    const numbers = Array.from({ length: count }, (_, index) => index + 1);
    const shuffled = Phaser.Utils.Array.Shuffle([...numbers]);
    let expected = 1;
    const hint = makeText(
      this,
      640,
      246,
      `ВОССТАНОВИ КОД: НАЖИМАЙ ${count} ЦИФР ПО ВОЗРАСТАНИЮ.`,
      {
        size: 14,
        color: COLORS.text,
        font: 'body',
        origin: [0.5, 0],
      }
    );
    const status = makeText(this, 640, 280, 'СЛЕДУЮЩАЯ: 1', {
      size: 10,
      color: COLORS.amber,
      font: 'display',
      origin: [0.5, 0],
    });
    game.add([hint, status]);
    const buttons = [];
    shuffled.forEach((number, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const button = new Button(this, 440 + col * 145, 320 + row * 72, 125, 56, String(number), {
        variant: 'danger',
        size: 16,
        onClick: () => {
          if (number !== expected) {
            expected = 1;
            status.setText('СБОЙ. НАЧНИ С 1');
            for (const item of buttons) item.setEnabled(true);
            manager.audio?.error?.();
            return;
          }
          expected += 1;
          button.setEnabled(false);
          status.setText(expected > count ? 'КОД ПРИНЯТ' : `СЛЕДУЮЩАЯ: ${expected}`);
          if (expected > count) this.completeInterferenceGame();
        },
      });
      buttons.push(button);
      game.add(button);
    });
  }

  completeInterferenceGame() {
    const result = manager.clearInterference(this.slot);
    this.closeInterferenceGame();
    if (result.ok) {
      manager.audio?.confirm?.();
      showToast(this, 'СВЯЗЬ ВОССТАНОВЛЕНА', { kind: 'good', y: 676 });
      this.cameras.main.flash(180, 120, 40, 30);
      this.refreshAll();
    }
  }

  closeInterferenceGame() {
    if (!this.interference?.game) return;
    this.interference.game.destroy(true);
    this.interference.game = null;
  }

  buildDefense() {    this.defenseBar = this.add.container(0, 0).setDepth(46).setVisible(false);

    const bannerG = this.add.graphics();
    drawPanel(bannerG, ROOM_FRAME.x, 84, ROOM_FRAME.w, 76, {
      fill: 0x230c08,
      stroke: COLORS.red,
      alpha: 0.94,
      cornerColor: COLORS.red,
      cornerSize: 10,
    });
    this.defenseBar.add(bannerG);

    this.defenseTitle = makeText(this, 72, 96, 'ТРЕВОГА · СДЕРЖИВАНИЕ', {
      size: 10,
      color: COLORS.red,
      font: 'display',
    });
    this.defenseSub = makeText(this, 72, 120, 'ВЫБЕРИТЕ ВОЗДЕЙСТВИЕ, КОТОРОЕ УСПОКОИТ СУЩЕСТВО', {
      size: 12,
      color: COLORS.text,
      font: 'body',
      wrap: 700,
      lineSpacing: 2,
    });
    this.defenseTimer = makeText(this, 844, 98, '00:24', {
      size: 22,
      color: COLORS.red,
      font: 'display',
      origin: [1, 0],
    });
    this.defenseBar.add([this.defenseTitle, this.defenseSub, this.defenseTimer]);

    this.defenseButtons = [];
    CARE_TOOL_LIST.forEach((tool, index) => {
      const button = new Button(this, 40 + index * 168, 720, 160, 48, tool.short, {
        variant: 'danger',
        size: 8,
        icon: tool.icon,
        sub: `${tool.energy} ЭН`,
        onClick: () => this.defendAction(tool.id),
      });
      this.defenseBar.add(button);
      this.defenseButtons.push(button);
    });
  }

  /* ========================================================================
     События и обновление
     ====================================================================== */

  bindEvents() {
    const on = (event, handler) => this.unsubs.push(manager.bus.on(event, handler));

    on('tick', () => this.refreshAll());
    on('creature', ({ slot }) => {
      if (slot === this.slot) {
        this.updateMonsterTexture();
        this.refreshAll();
      }
    });
    on('notice', (notice) => showToast(this, notice.text, { kind: notice.kind, y: 676 }));
    on('alarm', (alarm) => {
      manager.audio?.startAlarm?.();
      if (alarm?.slot === this.slot) this.enterDefense();
      else this.showOtherAlarm();
    });
    on('alarm-cleared', () => {
      this.exitDefense();
      if (!this.state.alarm) {
        manager.audio?.stopAlarm?.();
      }
    });
    on('escape', (escape) => {
      manager.audio?.stopAlarm?.();
      this.scene.start('Horror', escape);
    });
    on('shift-end', () => this.scene.start('Report'));
    on('contract-done', (result) => {
      if (result.slot === this.slot) {
        showToast(this, `${result.name}: ${result.outcome.toUpperCase()}`, {
          kind: result.payout > 0 ? 'good' : 'danger',
          y: 676,
        });
      }
      this.refreshAll();
    });
    on('blackout', () => showToast(this, 'ПИТАНИЕ ОТКЛЮЧЕНО', { kind: 'danger', y: 676 }));
    on('energy-low', ({ level }) => {
      showToast(
        this,
        level >= 2
          ? 'ЭНЕРГИЯ НА ИСХОДЕ. ВЫПЕЙТЕ КОФЕ, ИНАЧЕ ДЕНЬ ПРОВАЛЕН.'
          : 'ЭНЕРГИЯ НИЖЕ 30. СЛЕДИТЕ ЗА ШКАЛОЙ.',
        { kind: level >= 2 ? 'danger' : 'warning', y: 676, duration: 4200 }
      );
      this.cameras.main.shake(level >= 2 ? 220 : 100, level >= 2 ? 0.005 : 0.002);
      manager.audio?.error?.();
    });
    on('speed', () => this.refreshAll());

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.modal) this.closeModal();
      else this.goBack();
    });
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.state.alarm?.slot === this.slot && !this.defenseMode) this.enterDefense();
    });
  }

  refreshAll() {
    this.creature = manager.get(this.slot);
    this.refreshMonster();
    this.refreshPanel();
    this.refreshActions();
    this.refreshDiorama();
    this.refreshDefense();
    this.refreshTop();
    this.refreshInterference();
  }

  refreshInterference() {
    if (!this.interference) return;
    const remaining = this.state.camDown?.[this.slot] || 0;
    const active = remaining > 0;
    this.interference.container.setVisible(active);
    if (!active) {
      this.closeInterferenceGame();
      return;
    }
    if (this.modal && !this.defenseMode) this.closeModal();
    this.interference.timer.setText(`${Math.ceil(remaining)} С`);
    this.interference.clear.setEnabled(true);
    this.interference.clear.setSub('МИНИ-ИГРА');
  }

  refreshTop() {
    if (!this.creature) return;
    const c = this.creature;
    let status = '';
    let sub = '';
    if (c.status === 'contract' && c.contract) {
      status = 'НА КОНТРАКТЕ';
      sub = `${c.contract.companyName} · ${Math.ceil(c.contract.endIn)} с`;
    } else if (c.status === 'training' && c.training) {
      status = 'ОБУЧЕНИЕ';
      sub = `${Math.round(100 - (c.training.timeLeft / c.training.total) * 100)}%`;
    } else if (c.status === 'terminated') {
      status = 'УТИЛИЗИРОВАН';
      sub = 'ПРОГРЕСС УНИЧТОЖЕН';
    } else if (c.status === 'escaped') {
      status = 'ПОБЕГ';
      sub = 'КЛЕТКА ПУСТА';
    } else {
      status = c.activity || 'НАБЛЮДАЕТ';
      sub = `СТАДИЯ ${roman(c.stage)} · УР.${c.level}`;
    }
    if (this.state.alarm?.slot === this.slot) {
      status = 'ТРЕВОГА';
      sub = `ДО ПОБЕГА ${Math.max(0, Math.ceil(this.state.alarm.countdown))} с`;
    }
    this.topStatus.setText(status);
    this.topStatus.setColor(this.state.alarm?.slot === this.slot ? COLORS.red : COLORS.dim);
    this.topSub.setText(sub);
    if (this.topResources) {
      this.topResources.setText(`${formatMoney(this.state.money)} ₽`);
      this.topResources2.setText(
        `БИО ${Math.round(this.state.biomass)} · РЕП ${Math.round(this.state.reputation)} · ЭН ${Math.round(this.state.operatorEnergy)}`
      );
    }

    if (this.state.alarm && this.state.alarm.slot !== this.slot) {
      this.topStatus.setText(`ТРЕВОГА В СЕКТОРЕ ${this.state.alarm.slot}`);
      this.topStatus.setColor(COLORS.red);
    }
  }

  refreshMonster() {
    const c = this.creature;
    if (!c) return;
    const visible = ['idle', 'training'].includes(c.status);
    this.monster.setVisible(visible && this.monsterStage > 0);
    this.monsterShadow.setVisible(visible);
    if (this.bobTween) {
      if (visible) this.bobTween.resume();
      else this.bobTween.pause();
    }

    if (!visible) {
      const overlay = {
        contract: ['НА КОНТРАКТЕ', c.contract ? `${c.contract.companyName}\n${c.contract.title}` : '', 'СВЯЗЬ ТОЛЬКО ЧЕРЕЗ КОРПОРАЦИЮ'],
        terminated: ['СУБЪЕКТ УТИЛИЗИРОВАН', 'ПРОГРЕСС УНИЧТОЖЕН АВАРИЙНЫМ ПРОТОКОЛОМ', 'ДОСТУПЕН ЗАПРОС ЗАМЕНЫ'],
        escaped: ['КЛЕТКА ПУСТА', 'СУБЪЕКТ ПОКИНУЛ БУНКЕР', 'ПРОВЕРЬТЕ КАМЕРЫ'],
        empty: ['СЕКТОР НЕ ВВЕДЁН', 'ПУСТАЯ КОМНАТА', 'ОЖИДАНИЕ СУБЪЕКТА'],
      }[c.status] || ['—', '', ''];
      this.stateTitle.setText(overlay[0]);
      this.stateSub.setText(overlay[1]);
      this.stateFoot.setText(overlay[2]);
      this.stateBar.clear();
      if (c.status === 'contract' && c.contract) {
        const ratio = 1 - Math.max(0, c.contract.endIn) / Math.max(1, c.contract.duration);
        drawBar(this.stateBar, 458 - 200, 396, 400, 7, ratio * 100, COLORS.cyan, { ticks: false });
        this.stateFoot.setText(
          `${c.contract.companyName} · ОСТАЛОСЬ ${Math.ceil(c.contract.endIn)} С · ${formatMoney(c.contract.pay)} ₽`
        );
      }
      this.stateOverlay.setVisible(true);
      return;
    }

    this.stateOverlay.setVisible(false);
    this.monster.setTint(this.state.alarm?.slot === this.slot ? 0xffb0a0 : 0xffffff);
    const frame = this.monster.frame;
    const scale = Math.min(330 / frame.realHeight, 430 / frame.realWidth);
    this.monster.setScale(scale);
    this.monster.setAlpha(c.status === 'training' ? 0.9 : 1);
  }

  updateMonsterTexture() {
    const c = this.creature;
    if (!c?.defId) {
      this.monsterStage = 0;
      return;
    }
    const key = `${c.defId}_${c.stage}`;
    if (this.textures.exists(key)) {
      this.monster.setTexture(key);
      this.monsterStage = c.stage;
      const frame = this.monster.frame;
      const scale = Math.min(330 / frame.realHeight, 430 / frame.realWidth);
      this.monster.setScale(scale);
    }
  }

  refreshPanel() {
    const c = this.creature;
    if (!c || !this.def) {
      this.panelName.setText('ПУСТО');
      this.panelSubject.setText('СЕКТОР НЕ ВВЕДЁН');
      this.panelSpecies.setText(this.creature?.note || '');
      this.panelLevel.setText('');
      this.hintText.setText('Сектор предусмотрен под будущих существ. Оборудование не установлено.');
      this.infoText.setText('');
      this.prefText.setText('');
      this.statusText.setText('ДЕЙСТВИЯ НЕДОСТУПНЫ');
      this.emergencyBtn.setVisible(false);
      this.replacementBtn.setVisible(false);
      Object.values(this.bars).forEach((bar) => bar.setVisible(false));
      this.readyValue.setText('—');
      this.readyBar.clear();
      return;
    }

    Object.values(this.bars).forEach((bar) => bar.setVisible(true));
    this.panelName.setText(this.def.name);
    this.panelSubject.setText(this.def.subject);
    this.panelSpecies.setText(this.def.species);
    this.panelLevel.setText(
      `УРОВЕНЬ ${c.level} · СТАДИЯ ${roman(c.stage)} · ${this.def.stageNames[c.stage - 1]}`
    );

    const stats = c.stats;
    for (const [key, bar] of Object.entries(this.bars)) {
      bar.setValue(stats[key], statColor(key, stats[key]));
    }

    const readiness = manager.readinessOf(this.slot);
    this.readyValue.setText(String(readiness));
    this.readyValue.setColor(readiness >= 60 ? COLORS.green : readiness >= 45 ? COLORS.amber : COLORS.red);
    this.readyBar.clear();
    drawBar(
      this.readyBar,
      INNER.x,
      126,
      INNER.w,
      7,
      readiness,
      readiness >= 60 ? COLORS.green : COLORS.cyan,
      { ticks: true }
    );

    const mutation = manager.mutationInfo(this.slot);
    const mutationLocked = c.stage >= 3;
    this.mutationLabel.setText(mutationLocked ? 'МУТАЦИЯ ЗАВЕРШЕНА' : 'ШКАЛА МУТАЦИИ');
    this.mutationValue.setText(
      mutationLocked ? 'III / III' : `${mutation.progress}% · ОСТАЛОСЬ ${mutation.remaining}`
    );
    this.mutationValue.setColor(mutation.ready ? COLORS.green : COLORS.purple);
    this.mutationBar.clear();
    drawBar(
      this.mutationBar,
      INNER.x,
      376,
      INNER.w,
      7,
      mutationLocked ? 100 : mutation.progress,
      mutationLocked ? COLORS.green : COLORS.purple,
      { ticks: true }
    );

    this.hintText.setText(this.def.hint);
    this.prefText.setText(
      `ЛЮБИТ: ${FOODS[this.def.food.love]?.name || '—'}  ·  НЕ ЕСТ: ${FOODS[this.def.food.hate]?.name || '—'}`
    );

    const learned = Object.values(c.skills || {}).filter(Boolean).length;
    this.infoText.setText(
      `МУТАЦИЯ ${roman(c.stage)}/III · НАВЫКИ ${learned}/9 · АДАПТАЦИЯ ${c.adaptation || 0} · УР.${c.level}`
    );

    this.equipPips.clear();
    this.equipTexts.forEach(({ key, text }, index) => {
      const level = c.upgrades?.[key] || 0;
      const col = index % 2;
      const row = Math.floor(index / 2);
      text.setColor(level > 0 ? COLORS.text : COLORS.dimmer);
      for (let i = 0; i < UPGRADE_MAX_LEVEL; i += 1) {
        this.equipPips.fillStyle(i < level ? UPGRADES[key].color : 0x1c2c2f, 1);
        this.equipPips.fillRect(INNER.x + col * 168 + 68 + i * 9, 508 + row * 24, 6, 6);
      }
    });

    let status = '';
    if (c.status === 'contract' && c.contract) {
      status = `НА КОНТРАКТЕ: ${c.contract.title}\n${c.contract.companyName} · ОСТАЛОСЬ ${Math.ceil(c.contract.endIn)} С`;
    } else if (c.status === 'training' && c.training) {
      const percent = Math.round(100 - (c.training.timeLeft / c.training.total) * 100);
      status = `ОБУЧЕНИЕ: ${this.getTrainingNodeName()}\nПРОГРЕСС ${percent}%`;
    } else if (c.status === 'terminated') {
      status = 'СУБЪЕКТ УТИЛИЗИРОВАН.\nПРОГРЕСС И КОНТРАКТЫ ПОТЕРЯНЫ.';
    } else if (c.status === 'escaped') {
      status = 'СУБЪЕКТ СБЕЖАЛ.\nВЕРНЁТСЯ ПОСЛЕ ДНЯ — С ПОВЫШЕННОЙ АДАПТАЦИЕЙ.';
    } else if (readiness < 60) {
      status = 'НЕ ГОТОВ К КОНТРАКТУ.\nСнизьте стресс и агрессию, обучите навыкам.';
    } else {
      status = 'ГОТОВ К КОНТРАКТУ.\nПроверьте предложения компаний.';
    }
    if (this.state.alarm?.slot === this.slot) {
      status = `ТРЕВОГА. ВРЕМЯ НА РЕАКЦИЮ: ${Math.max(0, Math.ceil(this.state.alarm.countdown))} С.\nИспользуйте средства сдерживания.`;
      this.statusText.setColor(COLORS.red);
    } else {
      this.statusText.setColor(c.status === 'terminated' ? COLORS.red : COLORS.dim);
    }
    this.statusText.setText(status);

    this.emergencyBtn.setVisible(['idle', 'training'].includes(c.status));
    this.replacementBtn.setVisible(c.status === 'terminated');
    const jammed = (this.state.camDown?.[this.slot] || 0) > 0;
    this.emergencyBtn.setEnabled(!jammed);
    this.replacementBtn.setEnabled(!jammed);
  }

  getTrainingNodeName() {
    const c = this.creature;
    if (!c?.training) return '—';
    const nodes = skillNodes(this.def);
    return nodes.find((node) => node.id === c.training.nodeId)?.name || '—';
  }

  refreshActions() {
    const c = this.creature;
    if (!c || !this.def) {
      Object.values(this.actionButtons).forEach((button) => button.setEnabled(false));
      this.objectButtons?.forEach((button) => button.setVisible(false));
      return;
    }
    const active = ['idle', 'training'].includes(c.status);
    const money = this.state.money;
    const energy = this.state.operatorEnergy;
    const readiness = manager.readinessOf(this.slot);
    const jammed = (this.state.camDown?.[this.slot] || 0) > 0;
    const matchingOffers = (this.state.offers || []).filter((offer) =>
      this.def.professions.includes(offer.profession)
    );

    this.objectButtons?.forEach((button) => {
      button.setVisible(active && !jammed);
      button.setEnabled(active && !jammed);
    });

    if (jammed) {
      Object.values(this.actionButtons).forEach((button) => button.setEnabled(false));
      this.actionBar.setVisible(true);
      this.actionHint
        .setText('ПОМЕХИ НА КАМЕРЕ. ВЗАИМОДЕЙСТВИЕ ЗАБЛОКИРОВАНО.')
        .setColor(COLORS.red);
      return;
    }

    this.actionButtons.feed.setEnabled(active && money >= 70 && energy >= 4);
    this.actionButtons.clean.setEnabled(
      active && c.stats.cleanliness < 98 && money >= BALANCE.cleaning.cost && energy >= BALANCE.cleaning.energy
    );
    this.actionButtons.clean.setSub(`${BALANCE.cleaning.cost} ₽`);
    this.actionButtons.train.setEnabled(active);
    this.actionButtons.calm.setEnabled(active && energy >= 4);
    this.actionButtons.rest.setEnabled(active && (c.restCooldown || 0) <= 0 && energy >= 5);
    this.actionButtons.repair.setEnabled(
      active && c.stats.integrity < maxIntegrity(c) - 1 && money >= 460 && energy >= 8
    );
    this.actionButtons.repair.setSub('460 ₽');
    this.actionButtons.upgrade.setEnabled(active);
    const nextMutation = getMutation(this.def, c.stage + 1);
    this.actionButtons.mutate.setEnabled(active && Boolean(nextMutation));
    if (nextMutation) {
      const info = manager.mutationInfo(this.slot);
      this.actionButtons.mutate.setSub(`${info.progress}%`);
    }
    this.actionButtons.contract.setEnabled(
      active && matchingOffers.length > 0 && readiness >= 40 && manager.contractLimit().available > 0
    );
    this.actionButtons.contract.setSub(`${matchingOffers.length}`);

    if (this.state.alarm?.slot === this.slot) {
      this.actionBar.setVisible(false);
      this.actionHint.setText('ТРЕВОГА. ДЕЙСТВИЯ ЗАБЛОКИРОВАНЫ ДО СДЕРЖИВАНИЯ.').setColor(COLORS.red);
    } else {
      this.actionBar.setVisible(true);
      if (c.status === 'contract') {
        this.actionHint.setText('СУЩЕСТВО ВНЕ БУНКЕРА. ДЕЙСТВИЯ НЕДОСТУПНЫ.').setColor(COLORS.dim);
      } else if (c.status === 'terminated') {
        this.actionHint.setText('СУБЪЕКТ УТИЛИЗИРОВАН. ДОСТУПЕН ЗАПРОС ЗАМЕНЫ.').setColor(COLORS.red);
      } else if (c.status === 'training') {
        this.actionHint.setText('ИДЁТ ОБУЧЕНИЕ. КОРМЛЕНИЕ И УСПОКОЕНИЕ ДОСТУПНЫ.').setColor(COLORS.cyan);
      } else if (energy < 30) {
        this.actionHint
          .setText(`ЭНЕРГИЯ ОПЕРАТОРА ${Math.round(energy)} · КРИТИЧЕСКИ МАЛО · КОФЕ +24`)
          .setColor(COLORS.red);
      } else {
        this.actionHint.setText(
          `ЭНЕРГИЯ ${Math.round(energy)} · БЮДЖЕТ ${formatMoney(money)} ₽ · БИОМАССА ${Math.round(this.state.biomass)}`
        ).setColor(COLORS.dimmer);
      }
    }
  }

  refreshDiorama() {
    const c = this.creature;
    if (!c?.upgrades) return;
    const light = c.upgrades.light || 0;
    const vent = c.upgrades.vent || 0;
    const security = c.upgrades.security || 0;

    if (this.state.blackout) {
      this.lightGlow.setAlpha(0);
    } else {
      this.lightGlow.setAlpha(0.03 + light * 0.035 + Math.sin(this.time.now / 900) * 0.008);
    }

    this.ventLines.clear();
    if (vent > 0) {
      this.ventLines.lineStyle(1, 0x8fc7cc, 0.12 + vent * 0.1);
      for (let i = 0; i < 4; i += 1) {
        const y = 150 + i * 12 + Math.sin(this.time.now / 800 + i) * 3;
        this.ventLines.lineBetween(700, y, 760, y + 6);
      }
    }

    this.containmentGlow.clear();
    if (security > 0) {
      this.containmentGlow.lineStyle(2, 0xb58ed8, 0.12 + security * 0.1);
      this.containmentGlow.strokeRect(ROOM_FRAME.x + 3, ROOM_FRAME.y + 3, ROOM_FRAME.w - 6, ROOM_FRAME.h - 6);
    }
  }

  refreshDefense() {
    if (!this.defenseMode) return;
    const alarm = this.state.alarm;
    if (!alarm || alarm.slot !== this.slot) {
      this.exitDefense();
      return;
    }
    this.defenseTimer.setText(`${Math.max(0, Math.ceil(alarm.countdown))} С`);
    this.defenseTimer.setColor(alarm.countdown <= 8 ? COLORS.red : COLORS.amber);
  }

  update(time, delta) {
    if (!manager.state) return;

    if (this.creature && this.creature.status === 'idle' && this.creature.stats) {
      const unstable = this.creature.stats.stress > 70 || this.creature.stats.aggression > 65;
      const alarmed = this.state.alarm?.slot === this.slot;
      if (unstable || alarmed) {
        this.monster.x = this.monsterBase.x + (Math.random() * 4 - 2);
      } else {
        this.monster.x = this.monsterBase.x;
      }
    }

    if (this.modal && this.state.alarm?.slot === this.slot) {
      this.closeModal();
      this.enterDefense();
    }

    if (this.defenseMode) {
      this.defenseTimer.setAlpha(0.7 + Math.sin(time / 160) * 0.3);
    }
    if (this.interference?.container.visible) {
      this.interference.noise.tilePositionX = (time / 8) % 96;
      this.interference.noise.tilePositionY = (time / 13) % 96;
      this.interference.noise.setAlpha(0.14 + Math.random() * 0.16);
    }
  }

  /* ========================================================================
     Действия
     ====================================================================== */

  onAction(key) {
    switch (key) {
      case 'feed':
        this.openFeedPanel();
        break;
      case 'clean':
        this.cleanAction();
        break;
      case 'train':
        this.openTrainPanel();
        break;
      case 'calm':
        this.openCalmPanel();
        break;
      case 'rest':
        this.restAction();
        break;
      case 'repair':
        this.repairAction();
        break;
      case 'upgrade':
        this.openUpgradePanel();
        break;
      case 'mutate':
        this.openMutationPanel();
        break;
      case 'contract':
        this.openContractPanel();
        break;
      default:
        break;
    }
  }

  cleanAction() {
    const result = manager.cleanCreature(this.slot);
    if (result.ok) {
      showToast(
        this,
        `ПОМЫТО. ЧИСТОТА +${BALANCE.cleaning.amount}, СТРЕСС +${BALANCE.cleaning.stress}.`,
        { kind: 'good', y: 676 }
      );
      manager.audio?.confirm?.();
      this.cameras.main.flash(140, 30, 90, 110);
      this.refreshAll();
    } else {
      showToast(this, result.reason || 'Недоступно', { kind: 'danger', y: 676 });
      manager.audio?.error?.();
    }
  }

  restAction() {
    const result = manager.restCreature(this.slot);
    if (result.ok) {
      showToast(this, 'СУЩЕСТВО ОТДЫХАЕТ. ЭНЕРГИЯ +14.', { kind: 'good', y: 676 });
      manager.audio?.confirm?.();
      this.tweens.add({
        targets: this.monster,
        scaleY: this.monster.scaleY * 0.98,
        duration: 300,
        yoyo: true,
      });
    } else {
      showToast(this, result.reason || 'Недоступно', { kind: 'danger', y: 676 });
      manager.audio?.error?.();
    }
    this.refreshAll();
  }

  repairAction() {
    const result = manager.repairCell(this.slot);
    if (result.ok) showToast(this, 'КЛЕТКА ОТРЕМОНТИРОВАНА', { kind: 'good', y: 676 });
    else showToast(this, result.reason || 'Недоступно', { kind: 'danger', y: 676 });
    this.refreshAll();
  }

  calmAction(toolId) {
    if (this.state.alarm?.slot === this.slot) {
      this.defendAction(toolId);
      return;
    }
    const result = manager.calm(this.slot, toolId);
    if (result.ok) {
      const kind = result.result?.kind;
      showToast(this, result.result?.text || 'ВОЗДЕЙСТВИЕ ПРИМЕНЕНО', {
        kind: kind === 'bad' ? 'danger' : 'good',
        y: 676,
      });
      if (kind === 'good') manager.audio?.confirm?.();
      else if (kind === 'bad') manager.audio?.error?.();
    } else {
      showToast(this, result.reason || 'Недоступно', { kind: 'danger', y: 676 });
    }
    this.refreshAll();
  }

  defendAction(toolId) {
    const result = manager.defend(this.slot, toolId);
    if (!result.ok) {
      showToast(this, result.reason || 'Недоступно', { kind: 'danger', y: 676 });
      return;
    }
    if (!this.sys.isActive() || this.state.phase !== 'office') return;
    if (result.success) {
      showToast(this, result.text || 'ТРЕВОГА СНЯТА', { kind: 'good', y: 676 });
      this.exitDefense();
    } else {
      showToast(this, result.text || 'СЛАБОЕ ВОЗДЕЙСТВИЕ', { kind: 'danger', y: 676 });
      if (this.state.alarm?.slot === this.slot) {
        this.cameras.main.shake(180, 0.006);
        this.defenseTimer.setText(`${Math.max(0, Math.ceil(this.state.alarm.countdown))} С`);
      }
    }
    this.refreshAll();
  }

  /* ========================================================================
     Панели действий
     ====================================================================== */

  openFeedPanel() {
    if (!this.def) return;
    const foods = manager.foodsFor(this.slot);
    this.openModal({
      title: 'КОРМЛЕНИЕ · ' + this.def.name,
      accent: COLORS.green,
      width: 940,
      height: 600,
      build: (content, ox, oy) => {
        const cardW = 430;
        const cardH = 132;
        content.add(
          makeText(this, ox, oy, `БЮДЖЕТ: ${formatMoney(this.state.money)} ₽ · ЭНЕРГИЯ: ${Math.round(this.state.operatorEnergy)}`, {
            size: 12,
            color: COLORS.green,
            font: 'display',
          })
        );
        foods.forEach((food, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const x = ox + col * (cardW + 14);
          const y = oy + 24 + row * (cardH + 10);
          const g = this.add.graphics();
          drawPanel(g, x, y, cardW, cardH, {
            fill: 0x0b1416,
            stroke: COLORS.line,
            alpha: 0.96,
            cornerSize: 6,
          });
          content.add(g);

          const icon = this.add.graphics();
          drawIcon(icon, 'bowl', x + 14, y + 14, 22, food.color);
          content.add(icon);

          const pref =
            this.def.food.love === food.id ? 'ЛЮБИМАЯ' : this.def.food.hate === food.id ? 'НЕ ЕСТ' : '';
          const prefColor =
            pref === 'ЛЮБИМАЯ' ? COLORS.green : pref === 'НЕ ЕСТ' ? COLORS.red : COLORS.dimmer;

          const name = makeText(this, x + 46, y + 12, food.name, {
            size: 9,
            color: COLORS.text,
            font: 'display',
          });
          const price = makeText(this, x + cardW - 16, y + 12, `${formatMoney(food.price)} ₽`, {
            size: 10,
            color: COLORS.amber,
            font: 'display',
            origin: [1, 0],
          });
          const after = makeText(this, x + cardW - 16, y + 28, `ОСТАНЕТСЯ ${formatMoney(Math.max(0, this.state.money - food.price))} ₽`, {
            size: 7,
            color: this.state.money >= food.price ? COLORS.dimmer : COLORS.red,
            font: 'display',
            origin: [1, 0],
          });
          const prefText = makeText(this, x + 46, y + 32, pref, {
            size: 11,
            color: prefColor,
            font: 'body',
          });
          const effects = makeText(
            this,
            x + 16,
            y + 54,
            `ГОЛОД −${food.nutrition}   ЭНЕРГИЯ +${food.energy}   СТРЕСС ${food.stress >= 0 ? '+' : '−'}${Math.abs(food.stress)}   ЧИСТОТА ${food.cleanliness >= 0 ? '+' : '−'}${Math.abs(food.cleanliness)}`,
            { size: 11, color: COLORS.cyan, font: 'body' }
          );
          const desc = makeText(this, x + 16, y + 72, food.desc, {
            size: 10,
            color: COLORS.dim,
            font: 'body',
            wrap: cardW - 160,
          });
          const button = new Button(this, x + cardW - 138, y + cardH - 34, 122, 28, 'ДАТЬ', {
            variant: 'primary',
            size: 8,
            onClick: () => {
              const result = manager.feed(this.slot, food.id);
              if (result.ok) {
                showToast(this, result.result?.text || 'СУЩЕСТВО ПОЕЛО', {
                  kind: result.result?.preference === 'hate' ? 'danger' : 'good',
                  y: 676,
                });
                if (result.result?.preference === 'love') manager.audio?.feed?.();
                else manager.audio?.confirm?.();
                this.closeModal();
                this.refreshAll();
              } else {
                showToast(this, result.reason || 'НЕ ПОЛУЧИЛОСЬ', { kind: 'danger', y: 676 });
              }
            },
          });
          content.add([name, price, after, prefText, effects, desc, button]);
        });
      },
    });
  }

  openTrainPanel() {
    if (!this.def) return;
    const branches = this.def.skills;
    this.openModal({
      title: 'ОБУЧЕНИЕ · ' + this.def.name,
      accent: COLORS.cyan,
      width: 960,
      height: 610,
      build: (content, ox, oy) => {
        const cardW = 284;
        const gap = 14;
        content.add(
          makeText(this, ox, oy, `БЮДЖЕТ: ${formatMoney(this.state.money)} ₽ · ЭНЕРГИЯ: ${Math.round(this.state.operatorEnergy)} ₽`, {
            size: 12,
            color: COLORS.green,
            font: 'display',
          })
        );
        branches.forEach((branch, colIndex) => {
          const x = ox + colIndex * (cardW + gap);
          const learned = branch.nodes.filter((node, idx) => {
            const nodes = skillNodes(this.def);
            const nodeId = `${this.def.id}_${branch.id}_${idx + 1}`;
            return this.creature.skills[nodeId];
          }).length;

          const title = makeText(this, x, oy + 24, branch.name, {
            size: 9,
            color: branch.color,
            font: 'display',
          });
          const progress = makeText(this, x + cardW, oy + 26, `${learned}/3`, {
            size: 9,
            color: COLORS.dim,
            font: 'display',
            origin: [1, 0],
          });
          content.add([title, progress]);

          branch.nodes.forEach((node, index) => {
            const nodeId = `${this.def.id}_${branch.id}_${index + 1}`;
            const state = manager.skillState(this.slot, nodeId);
            const y = oy + 50 + index * 138;
            const g = this.add.graphics();
            const accent =
              state.state === 'learned'
                ? COLORS.green
                : state.state === 'available'
                  ? branch.color
                  : COLORS.line;
            drawPanel(g, x, y, cardW, 128, {
              fill: state.state === 'available' ? 0x0d1a1c : 0x080f11,
              stroke: accent,
              alpha: 0.96,
              cornerSize: 5,
            });
            content.add(g);

            const name = makeText(this, x + 12, y + 10, node.name, {
              size: 8,
              color: state.state === 'locked' ? COLORS.dimmer : COLORS.text,
              font: 'display',
              wrap: cardW - 24,
            });
            const cost = makeText(this, x + cardW - 12, y + 10, `${formatMoney(node.cost)} ₽ · ${node.time} С`, {
              size: 7,
              color: COLORS.amber,
              font: 'display',
              origin: [1, 0],
            });
            const desc = makeText(this, x + 12, y + 32, node.desc, {
              size: 11,
              color: state.state === 'locked' ? COLORS.dimmer : COLORS.dim,
              font: 'body',
              wrap: cardW - 24,
              lineSpacing: 2,
            });
            content.add([name, cost, desc]);

            let label = 'ИЗУЧИТЬ';
            let enabled = true;
            let variant = 'primary';
            if (state.state === 'learned') {
              label = 'ИЗУЧЕНО';
              enabled = false;
              variant = 'ghost';
            } else if (state.state === 'training') {
              const percent = Math.round(100 - (this.creature.training.timeLeft / this.creature.training.total) * 100);
              label = `ОБУЧЕНИЕ ${percent}%`;
              enabled = false;
              variant = 'ghost';
            } else if (state.state === 'locked') {
              label = 'ЗАКРЫТО';
              enabled = false;
              variant = 'ghost';
            } else if (this.state.money < node.cost || this.state.operatorEnergy < 8) {
              enabled = false;
            }

            const button = new Button(this, x + 12, y + 90, cardW - 24, 30, label, {
              variant,
              size: 7,
              enabled,
              onClick: () => {
                const result = manager.train(this.slot, nodeId);
                if (result.ok) {
                  showToast(this, `ОБУЧЕНИЕ НАЧАТО: ${node.name}`, { kind: 'good', y: 676 });
                  this.closeModal();
                  this.refreshAll();
                } else {
                  showToast(this, result.reason || 'НЕДОСТУПНО', { kind: 'danger', y: 676 });
                }
              },
            });
            content.add(button);
          });
        });
      },
    });
  }

  openCalmPanel() {
    if (!this.def) return;
    this.openModal({
      title: 'УСПОКОЕНИЕ · ' + this.def.name,
      accent: COLORS.amber,
      width: 960,
      height: 560,
      build: (content, ox, oy) => {
        const hint = makeText(
          this,
          ox,
          oy,
          `ПОДСКАЗКА: ${this.def.hint}`,
          { size: 13, color: COLORS.amber, font: 'body', wrap: 880, lineSpacing: 3 }
        );
        content.add(hint);

        const cardW = 168;
        const gap = 12;
        CARE_TOOL_LIST.forEach((tool, index) => {
          const x = ox + index * (cardW + gap);
          const y = oy + 54;
          const g = this.add.graphics();
          drawPanel(g, x, y, cardW, 330, {
            fill: 0x0b1416,
            stroke: COLORS.line,
            alpha: 0.96,
            cornerSize: 6,
          });
          content.add(g);

          const icon = this.add.graphics();
          drawIcon(icon, tool.icon, x + cardW / 2 - 15, y + 16, 30, tool.color);
          content.add(icon);

          const name = makeText(this, x + cardW / 2, y + 58, tool.name, {
            size: 7,
            color: COLORS.text,
            font: 'display',
            align: 'center',
            wrap: cardW - 16,
            origin: [0.5, 0],
          });
          const energy = makeText(this, x + cardW / 2, y + 100, `${tool.energy} ЭНЕРГИИ${tool.cost ? ` · ${tool.cost} ₽` : ''}`, {
            size: 8,
            color: COLORS.cyan,
            font: 'display',
            origin: [0.5, 0],
          });
          const desc = makeText(this, x + 10, y + 124, tool.desc, {
            size: 11,
            color: COLORS.dim,
            font: 'body',
            wrap: cardW - 20,
            align: 'center',
            origin: [0, 0],
          });

          const history = this.creature.calmHistory?.[tool.id];
          const reaction = history === 'good' ? 'РЕАКЦИЯ: +' : history === 'bad' ? 'РЕАКЦИЯ: −' : history ? 'РЕАКЦИЯ: ~' : 'РЕАКЦИЯ: ?';
          const reactionColor =
            history === 'good' ? COLORS.green : history === 'bad' ? COLORS.red : history ? COLORS.amber : COLORS.dimmer;
          const reactionText = makeText(this, x + cardW / 2, y + 214, reaction, {
            size: 10,
            color: reactionColor,
            font: 'display',
            origin: [0.5, 0],
          });

          const button = new Button(this, x + 10, y + 276, cardW - 20, 36, 'ПРИМЕНИТЬ', {
            variant: 'amber',
            size: 7,
            onClick: () => {
              this.calmAction(tool.id);
              this.closeModal();
            },
          });
          content.add([name, energy, desc, reactionText, button]);
        });
      },
    });
  }

  openUpgradePanel(focusKey = null) {
    if (!this.def) return;
    this.openModal({
      title: 'ОБОРУДОВАНИЕ КЛЕТКИ · ' + this.def.name,
      accent: COLORS.purple,
      width: 940,
      height: 590,
      build: (content, ox, oy) => {
        const keys = Object.keys(UPGRADES);
        content.add(
          makeText(this, ox, oy, `БЮДЖЕТ: ${formatMoney(this.state.money)} ₽ · ЭНЕРГИЯ: ${Math.round(this.state.operatorEnergy)}`, {
            size: 12,
            color: COLORS.green,
            font: 'display',
          })
        );
        keys.forEach((key, index) => {
          const upgrade = UPGRADES[key];
          const level = this.creature.upgrades[key] || 0;
          const y = oy + 22 + index * 68;
          const g = this.add.graphics();
          drawPanel(g, ox, y, 880, 64, {
            fill: 0x0b1416,
            stroke: focusKey === key ? COLORS.amber : COLORS.line,
            alpha: 0.96,
            cornerSize: 5,
          });
          content.add(g);

          const icon = this.add.graphics();
          drawIcon(icon, upgrade.icon, ox + 14, y + 24, 22, upgrade.color);
          content.add(icon);

          const name = makeText(this, ox + 46, y + 8, upgrade.name, {
            size: 8,
            color: COLORS.text,
            font: 'display',
          });
          const effect = makeText(this, ox + 46, y + 28, level > 0 ? upgrade.effectText(level) : upgrade.effect, {
            size: 11,
            color: COLORS.dim,
            font: 'body',
          });
          const pips = makeText(this, ox + 320, y + 9, `УРОВЕНЬ ${level}/3`, {
            size: 8,
            color: level >= 3 ? COLORS.green : COLORS.amber,
            font: 'display',
          });
          content.add([name, effect, pips]);

          for (let i = 0; i < 3; i += 1) {
            const pip = this.add
              .rectangle(ox + 440 + i * 16, y + 17, 10, 10, i < level ? upgrade.color : 0x1b2a2d)
              .setStrokeStyle(1, COLORS.line);
            content.add(pip);
          }

          const cost = level >= 3 ? 'МАКС' : `${formatMoney(upgradeCost(key, level))} ₽`;
          const button = new Button(this, ox + 740, y + 17, 124, 34, level >= 3 ? 'УРОВЕНЬ 3' : 'УЛУЧШИТЬ', {
            variant: level >= 3 ? 'ghost' : 'purple',
            size: 7,
            enabled: level < 3,
            sub: level >= 3 ? '' : cost,
            onClick: () => {
              const result = manager.upgrade(this.slot, key);
              if (result.ok) {
                showToast(this, `${upgrade.name} → УРОВЕНЬ ${result.level}`, { kind: 'good', y: 676 });
                manager.audio?.buy?.();
                this.rebuildModal();
              } else {
                showToast(this, result.reason || 'НЕДОСТУПНО', { kind: 'danger', y: 676 });
              }
            },
          });
          content.add(button);
        });

        const hint = makeText(
          this,
          ox,
          oy + 458,
          'СВЕТ И ВЕНТИЛЯЦИЯ ПО-РАЗНОМУ ВЛИЯЮТ НА СУЩЕСТВ: ИЗУЧИТЕ ИХ ТРИГГЕРЫ В ПАНЕЛИ ХАРАКТЕРИСТИК.',
          { size: 11, color: COLORS.dimmer, font: 'body', wrap: 880 }
        );
        content.add(hint);
      },
    });
  }

  openMutationPanel() {
    if (!this.def) return;
    const current = this.creature;
    const next = getMutation(this.def, current.stage + 1);
    this.openModal({
      title: 'КЛИКЕР МУТАЦИИ · ' + this.def.name,
      accent: COLORS.purple,
      width: 980,
      height: 620,
      build: (content, ox, oy) => {
        const cardW = 300;
        const cardH = 470;
        const g = this.add.graphics();
        drawPanel(g, ox, oy, cardW, cardH, {
          fill: 0x0b1416,
          stroke: COLORS.green,
          alpha: 0.96,
          cornerSize: 6,
        });
        content.add(g);
        content.add(
          makeText(this, ox + 14, oy + 12, `ТЕКУЩАЯ СТАДИЯ ${roman(current.stage)}`, {
            size: 9,
            color: COLORS.green,
            font: 'display',
          })
        );
        content.add(
          makeText(this, ox + 14, oy + 34, this.def.stageNames[current.stage - 1], {
            size: 8,
            color: COLORS.dim,
            font: 'display',
          })
        );
        const textureKey = `${this.def.id}_${current.stage}_thumb`;
        if (this.textures.exists(textureKey)) {
          const image = this.add.image(ox + cardW / 2, oy + 210, textureKey).setOrigin(0.5, 1);
          const scale = Math.min(160 / image.height, 250 / image.width);
          image.setScale(scale);
          content.add(image);
        }
        content.add(
          makeText(this, ox + 14, oy + 226, this.def.stageDesc[current.stage - 1], {
            size: 11,
            color: COLORS.dim,
            font: 'body',
            wrap: cardW - 28,
            lineSpacing: 3,
          })
        );
        content.add(
          makeText(this, ox + 14, oy + 390, `СТРЕСС ${Math.round(current.stats.stress)} · АГРЕССИЯ ${Math.round(current.stats.aggression)}`, {
            size: 8,
            color: COLORS.amber,
            font: 'display',
          })
        );

        const rx = ox + 330;
        const rw = 580;
        if (!next) {
          content.add(
            makeText(this, rx, oy + 20, 'ФИНАЛЬНАЯ СТАДИЯ', {
              size: 14,
              color: COLORS.green,
              font: 'display',
            })
          );
          content.add(
            makeText(
              this,
              rx,
              oy + 60,
              'Дальше мутировать некуда. Существо достигло предела протокола — и перестало быть тем, кем было.',
              { size: 15, color: COLORS.dim, font: 'body', wrap: rw, lineSpacing: 5 }
            )
          );
          return;
        }

        content.add(
          makeText(this, rx, oy + 16, `СЛЕДУЮЩАЯ СТАДИЯ ${roman(current.stage + 1)}`, {
            size: 13,
            color: COLORS.purple,
            font: 'display',
          })
        );
        content.add(
          makeText(this, rx, oy + 44, next.name, {
            size: 18,
            color: COLORS.text,
            font: 'display',
          })
        );
        content.add(
          makeText(this, rx, oy + 74, next.desc, {
            size: 13,
            color: COLORS.dim,
            font: 'body',
            wrap: rw,
            lineSpacing: 4,
          })
        );
        const effects = Object.entries(next.stat || {})
          .map(([key, value]) => `${STAT_META[key]?.short || key} ${value > 0 ? '+' : ''}${value}`)
          .join('   ');
        content.add(
          makeText(this, rx, oy + 154, effects, {
            size: 9,
            color: COLORS.amber,
            font: 'display',
          })
        );

        const barX = rx;
        const barY = oy + 210;
        const barW = rw;
        const barG = this.add.graphics();
        content.add(barG);
        const progressText = makeText(this, rx, oy + 178, '', {
          size: 9,
          color: COLORS.purple,
          font: 'display',
        });
        const remainingText = makeText(this, rx + rw, oy + 178, '', {
          size: 9,
          color: COLORS.purple,
          font: 'display',
          origin: [1, 0],
        });
        const hint = makeText(
          this,
          rx,
          oy + 232,
          'КАЖДОЕ НАЖАТИЕ ПРИБЛИЖАЕТ ПРЕВРАЩЕНИЕ. СЛЕДИ ЗА СТРЕССОМ И АГРЕССИЕЙ.',
          { size: 11, color: COLORS.dimmer, font: 'body', wrap: rw }
        );
        content.add([progressText, remainingText, hint]);

        let info = manager.mutationInfo(this.slot);
        const finish = new Button(this, rx, oy + 398, rw, 46, 'ЗАВЕРШИТЬ МУТАЦИЮ', {
          variant: 'purple',
          size: 9,
          icon: 'mutate',
          onClick: () => {
            const result = manager.mutate(this.slot);
            if (result.ok) {
              manager.audio?.mutate?.();
              this.cameras.main.flash(300, 120, 60, 160);
              showToast(this, `МУТАЦИЯ: ${result.mutation.name}`, { kind: 'plot', y: 676 });
              this.closeModal();
              this.refreshAll();
            } else {
              showToast(this, result.reason || 'НЕДОСТУПНО', { kind: 'danger', y: 676 });
            }
          },
        });
        content.add(finish);

        const click = new Button(this, rx + rw / 2 - 170, oy + 302, 340, 78, 'НАЖИМАТЬ', {
          variant: 'primary',
          size: 14,
          icon: 'mutate',
          onClick: () => {
            const result = manager.mutationClick(this.slot);
            if (!result.ok) {
              showToast(this, result.reason || 'НЕДОСТУПНО', { kind: 'danger', y: 676 });
              return;
            }
            manager.audio?.ui?.();
            this.cameras.main.shake(45, 0.0015);
            paint();
          },
        });
        content.add(click);

        const paint = () => {
          info = manager.mutationInfo(this.slot);
          barG.clear();
          drawBar(barG, barX, barY, barW, 10, info.progress, COLORS.purple, { ticks: true });
          progressText.setText(`ПРОГРЕСС ${info.progress}%`);
          remainingText.setText(info.ready ? 'ШКАЛА ЗАПОЛНЕНА' : `ОСТАЛОСЬ ${info.remaining}`);
          progressText.setColor(info.ready ? COLORS.green : COLORS.purple);
          remainingText.setColor(info.ready ? COLORS.green : COLORS.purple);
          const enough = this.state.biomass >= next.cost && this.state.operatorEnergy >= 12;
          finish.setEnabled(info.ready && enough);
          finish.setSub(
            info.ready
              ? `${next.cost} БИО · ${this.state.biomass} В НАЛИЧИИ`
              : `НУЖНО ${next.cost} БИОМАССЫ`
          );
          click.setLabel(info.ready ? 'ШКАЛА ЗАПОЛНЕНА' : 'НАЖИМАТЬ');
        };
        paint();
      },
    });
  }

  openContractPanel() {
    if (!this.def) return;
    const offers = (this.state.offers || []).filter((offer) =>
      this.def.professions.includes(offer.profession)
    );
    const readiness = manager.readinessOf(this.slot);
    this.openModal({
      title: 'КОНТРАКТЫ · ' + this.def.name,
      accent: COLORS.amber,
      width: 960,
      height: 610,
      build: (content, ox, oy) => {
        const limit = manager.contractLimit();
        const head = makeText(
          this,
          ox,
          oy - 2,
          `ГОТОВНОСТЬ: ${readiness}/100  ·  БЮДЖЕТ: ${formatMoney(this.state.money)} ₽  ·  ОФФЕРОВ: ${offers.length}  ·  КОНТРАКТЫ ${limit.active}/${limit.max}`,
          { size: 12, color: readiness >= 60 ? COLORS.green : COLORS.amber, font: 'body' }
        );
        content.add(head);

        if (!offers.length) {
          const empty = makeText(
            this,
            ox,
            oy + 40,
            'НЕТ ДОСТУПНЫХ ПРЕДЛОЖЕНИЙ.\nВсе контракты уже распределены или день подходит к концу.',
            { size: 14, color: COLORS.dim, font: 'body', wrap: 860, lineSpacing: 5 }
          );
          content.add(empty);
          return;
        }

        offers.forEach((offer, index) => {
          const y = oy + 26 + index * 124;
          const g = this.add.graphics();
          drawPanel(g, ox, y, 880, 112, {
            fill: 0x0b1416,
            stroke: COLORS.line,
            alpha: 0.96,
            cornerSize: 6,
          });
          g.fillStyle(offer.color || COLORS.amber, 0.9);
          g.fillRect(ox, y, 4, 112);
          content.add(g);

          const company = makeText(this, ox + 16, y + 10, offer.companyName, {
            size: 9,
            color: COLORS.text,
            font: 'display',
          });
          const title = makeText(this, ox + 16, y + 32, offer.title, {
            size: 14,
            color: COLORS.text,
            font: 'body',
          });
          const profession = makeText(
            this,
            ox + 16,
            y + 54,
            `${professionLabel[offer.profession] || offer.profession} · РИСК ${'★'.repeat(offer.risk)}${'☆'.repeat(3 - offer.risk)}`,
            { size: 11, color: COLORS.dim, font: 'body' }
          );
          const req = makeText(
            this,
            ox + 16,
            y + 74,
            `ГОТОВНОСТЬ ${offer.reqReadiness}/100 · ВАША ${readiness} · ${Math.round(offer.duration / 60 * 10) / 10} МИН`,
            { size: 8, color: readiness >= offer.reqReadiness ? COLORS.green : COLORS.red, font: 'display' }
          );
          content.add([company, title, profession, req]);

          const pay = makeText(this, ox + 640, y + 12, `${formatMoney(offer.pay)} ₽`, {
            size: 14,
            color: COLORS.amber,
            font: 'display',
            origin: [0, 0],
          });
          const flavor = makeText(this, ox + 640, y + 36, offer.flavor, {
            size: 10,
            color: COLORS.dimmer,
            font: 'body',
            wrap: 220,
          });
          content.add([pay, flavor]);

          const canTake = readiness >= offer.reqReadiness && manager.contractLimit().available > 0;
          const button = new Button(this, ox + 640, y + 74, 224, 30, canTake ? 'НАЗНАЧИТЬ' : 'НЕТ МЕСТА', {            variant: canTake ? 'amber' : 'ghost',
            size: 7,
            enabled: canTake,
            onClick: () => {
              const result = manager.acceptOffer(offer.id, this.slot);
              if (result.ok) {
                manager.audio?.confirm?.();
                showToast(this, 'КОНТРАКТ ПРИНЯТ. СУЩЕСТВО ПОКИДАЕТ БУНКЕР.', {
                  kind: 'good',
                  y: 676,
                });
                this.closeModal();
                this.refreshAll();
              } else {
                showToast(this, result.reason || 'НЕДОСТУПНО', { kind: 'danger', y: 676 });
              }
            },
          });
          content.add(button);
        });
      },
    });
  }

  /* ========================================================================
     Модальные окна
     ====================================================================== */

  openModal(spec) {
    this.closeModal();
    this.modalSpec = spec;
    const width = spec.width || 940;
    const height = spec.height || 600;
    const px = (1280 - width) / 2;
    const py = (800 - height) / 2;
    const container = this.add.container(0, 0).setDepth(200);

    const dim = this.add
      .rectangle(0, 0, 1280, 800, 0x020506, 0.72)
      .setOrigin(0)
      .setInteractive();
    dim.on('pointerup', () => {});
    container.add(dim);

    const accent = spec.accent || COLORS.amber;
    const g = this.add.graphics();
    drawPanel(g, px, py, width, height, {
      fill: 0x070d0f,
      stroke: accent,
      alpha: 0.98,
      cornerColor: accent,
      cornerSize: 16,
    });
    g.fillStyle(accent, 0.07);
    g.fillRect(px + 2, py + 2, width - 4, 48);
    g.lineStyle(1, accent, 0.5);
    g.lineBetween(px + 18, py + 50, px + width - 18, py + 50);
    container.add(g);

    container.add(
      makeText(this, px + 22, py + 15, spec.title, {
        size: 10,
        color: accent,
        font: 'display',
      })
    );

    const close = new Button(this, px + width - 48, py + 12, 32, 28, 'X', {
      variant: 'ghost',
      size: 8,
      onClick: () => this.closeModal(),
    });
    container.add(close);

    const content = this.add.container(0, 0);
    container.add(content);
    spec.build(content, px + 30, py + 68, width - 60, height - 96);

    this.modalScan = addScanlines(this, px, py, width, height, 0.1, 201);
    this.modal = container;
    manager.audio?.ui?.();
  }

  rebuildModal() {
    const spec = this.modalSpec;
    if (!spec) return;
    this.closeModal();
    this.time.delayedCall(10, () => {
      if (this.sys.isActive() && spec) this.openModal(spec);
    });
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.destroy(true);
    this.modal = null;
    if (this.modalScan) {
      this.modalScan.destroy();
      this.modalScan = null;
    }
  }

  /* ========================================================================
     Тревога
     ====================================================================== */

  enterDefense() {
    if (this.defenseMode) return;
    this.defenseMode = true;
    this.closeModal();
    this.actionBar.setVisible(false);
    this.defenseBar.setVisible(true);
    if (this.def) {
      this.defenseSub.setText(`ПОДСКАЗКА: ${this.def.hint}`);
    }
    manager.audio?.startAlarm?.();
    this.cameras.main.shake(260, 0.006);
    this.defenseTimer.setText(`${Math.max(0, Math.ceil(this.state.alarm?.countdown || 0))} С`);
    showToast(this, 'ТРЕВОГА. ВЫБЕРИТЕ СРЕДСТВО СДЕРЖИВАНИЯ.', { kind: 'danger', y: 676 });
    this.refreshAll();
  }

  exitDefense() {
    if (!this.defenseMode) {
      this.defenseBar.setVisible(false);
      this.actionBar.setVisible(true);
      return;
    }
    this.defenseMode = false;
    this.defenseBar.setVisible(false);
    this.actionBar.setVisible(true);
    manager.audio?.stopAlarm?.();
    this.refreshAll();
  }

  showOtherAlarm() {
    if (!this.state.alarm) return;
    showToast(
      this,
      `ТРЕВОГА В СЕКТОРЕ ${String(this.state.alarm.slot).padStart(2, '0')}. НУЖНО СДЕРЖИВАНИЕ.`,
      { kind: 'danger', y: 676, duration: 3200 }
    );
  }

  /* ========================================================================
     Аварийные протоколы
     ====================================================================== */

  confirmEmergency() {
    if (!this.def) return;
    this.scene.launch('Modal', {
      title: 'АВАРИЙНЫЙ ПРОТОКОЛ',
      body:
        `Сектор ${this.slot}, ${this.def.name}.\n\n` +
        'Существо будет выведено из эксплуатации. Вся прогрессия, навыки, мутации и контракты будут потеряны.\n\n' +
        'Клетка останется, оборудование сохранится. Можно запросить нового субъекта за 900 ₽.\n\n' +
        'Подтвердить?',
      accent: COLORS.red,
      pause: true,
      typewriter: false,
      buttons: [
        {
          label: 'ВЫВЕСТИ ИЗ ЭКСПЛУАТАЦИИ',
          variant: 'danger',
          size: 8,
          onClick: () => {
            const result = manager.emergency(this.slot);
            if (result.ok) {
              showToast(this, 'СУБЪЕКТ УТИЛИЗИРОВАН', { kind: 'danger', y: 676 });
              this.refreshAll();
            } else {
              showToast(this, result.reason || 'НЕДОСТУПНО', { kind: 'danger', y: 676 });
            }
          },
        },
        { label: 'ОТМЕНА', variant: 'ghost' },
      ],
    });
  }

  confirmReplacement() {
    this.scene.launch('Modal', {
      title: 'ЗАПРОС ЗАМЕНЫ',
      body:
        'Будет создан новый субъект той же серии. Уровень, навыки и мутации сбросятся.\n\n' +
        'Оборудование клетки сохранится.\n\nСтоимость: 900 ₽.',
      accent: COLORS.amber,
      pause: true,
      typewriter: false,
      buttons: [
        {
          label: 'ЗАПРОСИТЬ',
          variant: 'amber',
          onClick: () => {
            const result = manager.requestReplacement(this.slot);
            if (result.ok) {
              showToast(this, 'НОВЫЙ СУБЪЕКТ ДОСТАВЛЕН В СЕКТОР', { kind: 'good', y: 676 });
              this.creature = manager.get(this.slot);
              this.monsterStage = this.creature.stage;
              this.updateMonsterTexture();
              this.refreshAll();
            } else {
              showToast(this, result.reason || 'НЕДОСТУПНО', { kind: 'danger', y: 676 });
            }
          },
        },
        { label: 'ОТМЕНА', variant: 'ghost' },
      ],
    });
  }

  goBack() {
    if (this.modal) {
      this.closeModal();
      return;
    }
    manager.audio?.ui?.();
    this.time.delayedCall(20, () => this.scene.start('Office'));
  }

  openGuide() {
    manager.audio?.ui?.();
    this.closeModal();
    this.time.delayedCall(20, () => this.scene.start('Guide', { from: 'Room', slot: this.slot }));
  }
}
