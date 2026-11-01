/**
 * Аварийные заявки обслуживания бункера.
 * Две короткие мини-игры: соединение проводов и сортировка образцов.
 */
import { game as manager } from '../managers/GameManager.js';
import { BALANCE } from '../config/balance.js';
import { COLORS, addScanlines, drawBar, drawPanel, makeText } from '../ui/theme.js';
import { Button } from '../ui/widgets.js';

const PANEL = { x: 150, y: 95, w: 980, h: 610 };
const WIRE_COLORS = [0xd9a04a, 0x6fc7c9, 0x6ad48a, 0xd8503f, 0xb58ed8, 0xe08a4a, 0x7db8e8];

const CATEGORIES = [
  { id: 'bio', label: 'БИОМАССА', prefix: 'БИО', color: 0x6ad48a },
  { id: 'tox', label: 'ТОКСИНЫ', prefix: 'ТОКС', color: 0xd8503f },
  { id: 'sample', label: 'ОБРАЗЦЫ', prefix: 'ОБР', color: 0x6fc7c9 },
];

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export class MaintenanceScene extends Phaser.Scene {
  constructor() {
    super('Maintenance');
  }

  init(data = {}) {
    this.forcedVariant = data.variant || null;
    this.sourceKey = data.sourceKey || 'Office';
    this.finished = false;
    this.closed = false;
  }

  create() {
    this.state = manager.state;
    this.variant = this.forcedVariant || (Math.random() < 0.52 ? 'wires' : 'samples');
    this.remaining = BALANCE.maintenance.timeout;

    const owned = (this.state?.creatures || []).filter((creature) => creature.defId);
    this.awayCount = owned.filter((creature) => creature.status === 'contract').length;
    this.freeCount = owned.filter(
      (creature) => creature.status === 'idle' || creature.status === 'training'
    ).length;

    this.buildFrame();
    this.buildHeader();
    if (this.variant === 'wires') this.buildWires();
    else this.buildSamples();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.tickTimer(),
    });
    this.input.keyboard?.on('keydown-ESC', () => this.finish(false, 'ОТКАЗ'));

    this.events.once('shutdown', () => {
      this.timerEvent?.remove();
      this.restoreSourceInput();
      if (!this.closed) this.game.maintenanceController?.onClosed();
    });
  }

  update() {
    if (this.closed) return;
    if (!manager.state || manager.state.phase !== 'office') this.close();
  }

  restoreSourceInput() {
    const source = this.scene.get(this.sourceKey);
    if (!source || !source.input) return;
    source.input.enabled = true;
    if (source.input.keyboard) source.input.keyboard.enabled = true;
  }

  buildFrame() {
    this.add
      .rectangle(0, 0, 1280, 800, 0x010203, 0.84)
      .setOrigin(0)
      .setDepth(-20);

    const g = this.add.graphics().setDepth(0);
    drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, {
      fill: 0x070d0f,
      stroke: COLORS.amber,
      alpha: 0.98,
      cornerColor: COLORS.amber,
      cornerSize: 12,
    });
    addScanlines(this, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0.07, 24);

    makeText(this, PANEL.x + 24, PANEL.y + 18, 'СЛУЖБА ОБСЛУЖИВАНИЯ · АТД-67', {
      size: 9,
      color: COLORS.amber,
      font: 'display',
    });
    makeText(this, PANEL.x + PANEL.w - 24, PANEL.y + 18, 'ПРИОРИТЕТ: ВЫСОКИЙ', {
      size: 8,
      color: COLORS.red,
      font: 'display',
      origin: [1, 0],
    });
    g.lineStyle(1, COLORS.line, 0.8);
    g.lineBetween(PANEL.x + 22, PANEL.y + 52, PANEL.x + PANEL.w - 22, PANEL.y + 52);
  }

  buildHeader() {
    const isWires = this.variant === 'wires';
    this.titleText = makeText(
      this,
      PANEL.x + 24,
      PANEL.y + 72,
      isWires ? 'РЕМОНТ ЭЛЕКТРОСЕТИ' : 'СОРТИРОВКА ОБРАЗЦОВ',
      { size: 18, color: isWires ? COLORS.amber : COLORS.cyan, font: 'display' }
    );
    this.subText = makeText(
      this,
      PANEL.x + 24,
      PANEL.y + 108,
      `${isWires
        ? 'СОЕДИНИТЕ ЛЕВЫЙ ПРОВОД С ПРАВЫМ ПРОВОДОМ ТОГО ЖЕ ЦВЕТА.'
        : 'ПЕРЕТАЩИТЕ ОБРАЗЦЫ В ПОДХОДЯЩИЕ КАТЕГОРИИ.'}  СВОБОДНЫХ: ${this.freeCount} · НА КОНТРАКТЕ: ${this.awayCount}.`,
      { size: 13, color: COLORS.text, font: 'body', wrap: 760 }
    );
    this.timerText = makeText(
      this,
      PANEL.x + PANEL.w - 24,
      PANEL.y + 72,
      `${this.remaining} С`,
      { size: 22, color: COLORS.amber, font: 'display', origin: [1, 0] }
    );
    this.timerG = this.add.graphics().setDepth(2);
    this.drawTimer();

    this.rewardText = makeText(
      this,
      PANEL.x + 24,
      PANEL.y + PANEL.h - 48,
      `УСПЕХ: +${BALANCE.maintenance.rewardMoney} ₽ · +${BALANCE.maintenance.rewardRep} РЕП.   ПРОВАЛ: −${BALANCE.maintenance.penaltyMoney} ₽ · −${BALANCE.maintenance.penaltyRep} РЕП.`,
      { size: 9, color: COLORS.dim, font: 'body' }
    );
    this.statusText = makeText(
      this,
      PANEL.x + 24,
      PANEL.y + PANEL.h - 82,
      'ВЫПОЛНИТЕ ЗАДАНИЕ',
      { size: 11, color: COLORS.amber, font: 'display' }
    );
    this.skipBtn = new Button(
      this,
      PANEL.x + PANEL.w - 214,
      PANEL.y + PANEL.h - 58,
      190,
      36,
      'ОТКАЗАТЬСЯ',
      {
        variant: 'ghost',
        size: 8,
        onClick: () => this.finish(false, 'ОТКАЗ'),
      }
    );
    this.skipBtn.setDepth(30);
  }

  drawTimer() {
    this.timerG.clear();
    const ratio = Math.max(0, this.remaining / BALANCE.maintenance.timeout);
    drawBar(this.timerG, PANEL.x + 24, PANEL.y + 150, PANEL.w - 48, 5, ratio * 100,
      this.remaining <= 8 ? COLORS.red : COLORS.amber, { ticks: false });
  }

  tickTimer() {
    if (this.finished) return;
    this.remaining -= 1;
    this.timerText.setText(`${Math.max(0, this.remaining)} С`);
    this.timerText.setColor(this.remaining <= 8 ? COLORS.red : COLORS.amber);
    this.drawTimer();
    if (this.remaining <= 0) this.finish(false, 'ВРЕМЯ ВЫШЛО');
  }

  /* ======================================================================
     Электросеть
     ====================================================================== */

  difficultyLimits() {
    // Чем меньше свободных существ, тем больше проводов и образцов.
    if (this.awayCount === 0) return { wire: [4, 5], sample: [3, 4] };
    if (this.freeCount <= 1) return { wire: [7, 7], sample: [6, 6] };
    if (this.freeCount === 2) return { wire: [6, 6], sample: [5, 5] };
    return { wire: [5, 6], sample: [4, 5] };
  }

  buildWires() {
    const limits = this.difficultyLimits();
    const count = randomInt(limits.wire[0], limits.wire[1]);
    this.wireCount = count;
    this.wireLinks = 0;
    this.selected = null;

    const leftX = 390;
    const rightX = 890;
    const startY = 300;
    const step = count > 5 ? 46 : 54;
    const leftColors = WIRE_COLORS.slice(0, count);
    const rightColors = Phaser.Utils.Array.Shuffle([...leftColors]);
    const wireG = this.add.graphics().setDepth(2);
    this.wireG = wireG;
    this.selectionG = this.add.graphics().setDepth(6);

    // Корпуса источника и щита.
    const boxes = this.add.graphics().setDepth(0);
    drawPanel(boxes, 190, 285, 105, 285, {
      fill: 0x0a1517,
      stroke: COLORS.line,
      alpha: 0.9,
      cornerColor: COLORS.amber,
      cornerSize: 8,
    });
    drawPanel(boxes, 985, 285, 105, 285, {
      fill: 0x0a1517,
      stroke: COLORS.line,
      alpha: 0.9,
      cornerColor: COLORS.cyan,
      cornerSize: 8,
    });
    makeText(this, 242, 300, 'ИСТОЧНИК', {
      size: 8,
      color: COLORS.amber,
      font: 'display',
      origin: [0.5, 0],
    }).setDepth(3);
    makeText(this, 1038, 300, 'ЩИТ', {
      size: 8,
      color: COLORS.cyan,
      font: 'display',
      origin: [0.5, 0],
    }).setDepth(3);
    makeText(this, 242, 548, 'ПИТАНИЕ', {
      size: 7,
      color: COLORS.dimmer,
      font: 'display',
      origin: [0.5, 0],
    }).setDepth(3);
    makeText(this, 1038, 548, 'ОБОРУДОВАНИЕ', {
      size: 7,
      color: COLORS.dimmer,
      font: 'display',
      origin: [0.5, 0],
    }).setDepth(3);

    this.leftNodes = [];
    this.rightNodes = [];
    for (let index = 0; index < count; index += 1) {
      const y = startY + index * step;
      const leftColor = leftColors[index];
      const rightColor = rightColors[index];

      wireG.lineStyle(2, leftColor, 0.28);
      wireG.lineBetween(295, 430, leftX - 18, y);
      wireG.lineStyle(2, rightColor, 0.28);
      wireG.lineBetween(rightX + 18, y, 985, 430);

      const left = this.add
        .circle(leftX, y, 18, leftColor, 0.9)
        .setStrokeStyle(2, 0xffffff, 0.55)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      left.setData('index', index);
      left.setData('color', leftColor);
      left.setData('connected', false);
      left.on('pointerdown', () => this.selectWire(index));
      this.leftNodes.push(left);

      const right = this.add
        .circle(rightX, y, 18, rightColor, 0.9)
        .setStrokeStyle(2, 0xffffff, 0.55)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      right.setData('index', index);
      right.setData('color', rightColor);
      right.setData('connected', false);
      right.on('pointerdown', () => this.selectRightWire(index));
      this.rightNodes.push(right);

      makeText(this, leftX - 42, y - 7, String(index + 1), {
        size: 8,
        color: COLORS.dimmer,
        font: 'display',
        origin: [0.5, 0],
      });
    }

    this.wireCountText = makeText(this, 640, 590, `СОЕДИНЕНО 0 / ${count}`, {
      size: 11,
      color: COLORS.amber,
      font: 'display',
      origin: [0.5, 0],
    });
  }

  selectWire(index) {
    this.selectNode('left', index);
  }

  selectRightWire(index) {
    this.selectNode('right', index);
  }

  /** Совместимость со старыми вызовами: правый провод. */
  connectWire(index) {
    this.selectRightWire(index);
  }

  selectNode(side, index) {
    if (this.finished) return;
    const nodes = side === 'left' ? this.leftNodes : this.rightNodes;
    const node = nodes?.[index];
    if (!node || node.getData('connected')) return;

    if (this.selected && this.selected.side !== side) {
      const leftIndex = side === 'left' ? index : this.selected.index;
      const rightIndex = side === 'right' ? index : this.selected.index;
      this.tryConnect(leftIndex, rightIndex);
      return;
    }

    this.selected = { side, index };
    this.selectionG.clear();
    this.selectionG.lineStyle(3, 0xffffff, 0.9);
    this.selectionG.strokeCircle(node.x, node.y, 26);
    this.statusText.setText('ТЕПЕРЬ ВЫБЕРИТЕ ПРОВОД С ДРУГОЙ СТОРОНЫ ТОГО ЖЕ ЦВЕТА');
    this.statusText.setColor(COLORS.amber);
  }

  tryConnect(leftIndex, rightIndex) {
    if (this.finished) return;
    const left = this.leftNodes[leftIndex];
    const right = this.rightNodes[rightIndex];
    if (!left || !right) return;
    if (left.getData('connected') || right.getData('connected')) {
      this.selected = null;
      this.selectionG.clear();
      return;
    }

    if (left.getData('color') === right.getData('color')) {
      this.wireG.lineStyle(5, right.getData('color'), 0.95);
      this.wireG.lineBetween(left.x + 18, left.y, right.x - 18, right.y);
      left.setData('connected', true);
      right.setData('connected', true);
      left.setAlpha(0.42);
      right.setAlpha(0.42);
      this.selected = null;
      this.selectionG.clear();
      this.wireLinks += 1;
      this.wireCountText.setText(`СОЕДИНЕНО ${this.wireLinks} / ${this.wireCount}`);
      this.statusText.setText('КОНТАКТ ЕСТЬ. ПРОДОЛЖАЙТЕ.');
      this.statusText.setColor(COLORS.green);
      if (this.wireLinks >= this.wireCount) {
        this.statusText.setText('ТОК ДОШЁЛ ДО ОБОРУДОВАНИЯ');
        this.statusText.setColor(COLORS.green);
        this.time.delayedCall(420, () => this.finish(true));
      }
    } else {
      this.selected = null;
      this.selectionG.clear();
      this.statusText.setText('НЕ ТОТ ПРОВОД. ПОПРОБУЙТЕ СНОВА.');
      this.statusText.setColor(COLORS.red);
      this.cameras.main.shake(110, 0.002);
    }
  }

  /* ======================================================================
     Сортировка образцов
     ====================================================================== */

  buildSamples() {
    const limits = this.difficultyLimits();
    const count = randomInt(limits.sample[0], limits.sample[1]);
    const picked = [];
    for (let index = 0; index < Math.min(3, count); index += 1) picked.push(CATEGORIES[index]);
    while (picked.length < count) picked.push(CATEGORIES[randomInt(0, CATEGORIES.length - 1)]);
    Phaser.Utils.Array.Shuffle(picked);

    this.totalSamples = count;
    this.placedSamples = 0;
    this.sampleZones = {};
    this.samples = [];

    const zoneY = 505;
    CATEGORIES.forEach((category, index) => {
      const x = 240 + index * 290;
      const box = this.add
        .rectangle(x + 115, zoneY, 230, 116, category.color, 0.08)
        .setStrokeStyle(2, category.color, 0.6)
        .setDepth(1);
      box.setData('category', category.id);
      makeText(this, x + 115, zoneY - 42, category.label, {
        size: 11,
        color: category.color,
        font: 'display',
        origin: [0.5, 0],
      });
      makeText(this, x + 115, zoneY + 42, 'ПЕРЕТАЩИТЕ СЮДА', {
        size: 7,
        color: COLORS.dimmer,
        font: 'display',
        origin: [0.5, 0],
      });
      const zone = this.add
        .zone(x + 115, zoneY, 230, 116)
        .setRectangleDropZone(230, 116)
        .setDepth(2);
      zone.setData('category', category.id);
      zone.setData('count', 0);
      this.sampleZones[category.id] = zone;
    });

    const startX = 300;
    const gap = count >= 6 ? 130 : 150;
    picked.forEach((category, index) => {
      const x = startX + index * gap;
      const container = this.add.container(x, 330).setDepth(10);
      const card = this.add
        .rectangle(0, 0, 126, 66, category.color, 0.14)
        .setStrokeStyle(2, category.color, 0.8);
      const label = makeText(this, 0, 0, `${category.prefix}-${index + 1}`, {
        size: 12,
        color: category.color,
        font: 'display',
        origin: [0.5, 0.5],
      });
      container.add([card, label]);
      container.setSize(126, 66);
      container.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, 126, 66),
        Phaser.Geom.Rectangle.Contains
      );
      this.input.setDraggable(container);
      container.setData('category', category.id);
      container.setData('startX', x);
      container.setData('startY', 330);
      container.setData('placed', false);
      this.input.setDraggable(container);
      this.samples.push(container);
    });

    this.sampleCountText = makeText(this, 640, 590, `РАЗЛОЖЕНО 0 / ${count}`, {
      size: 11,
      color: COLORS.cyan,
      font: 'display',
      origin: [0.5, 0],
    });

    this.input.on('drag', (pointer, obj, dragX, dragY) => {
      if (this.finished || obj.getData('placed')) return;
      obj.setPosition(dragX, dragY);
      obj.setDepth(20);
    });

    this.input.on('dragend', (pointer, obj, dropped) => {
      if (this.finished || obj.getData('placed')) return;
      obj.setDepth(10);
      if (!dropped) this.returnSample(obj);
    });

    this.input.on('drop', (pointer, obj, zone) => {
      if (this.finished || obj.getData('placed')) return;
      if (obj.getData('category') === zone.getData('category')) {
        this.placeSample(obj, zone);
      } else {
        this.statusText.setText('НЕ ТА КАТЕГОРИЯ. ПРОВЕРЬТЕ ОБРАЗЕЦ.');
        this.statusText.setColor(COLORS.red);
        this.cameras.main.shake(100, 0.002);
        this.returnSample(obj);
      }
    });
  }

  placeSample(obj, zone) {
    obj.setData('placed', true);
    obj.disableInteractive();
    const index = zone.getData('count') || 0;
    zone.setData('count', index + 1);
    const targetX = zone.x - 56 + (index % 3) * 56;
    const targetY = zone.y + 22;
    this.tweens.add({
      targets: obj,
      x: targetX,
      y: targetY,
      scale: 0.56,
      duration: 180,
    });
    this.placedSamples += 1;
    this.sampleCountText.setText(`РАЗЛОЖЕНО ${this.placedSamples} / ${this.totalSamples}`);
    this.statusText.setText('ОБРАЗЕЦ ПРИНЯТ.');
    this.statusText.setColor(COLORS.green);
    if (this.placedSamples >= this.totalSamples) {
      this.statusText.setText('ПАРТИЯ ОБРАЗЦОВ ОБРАБОТАНА');
      this.time.delayedCall(420, () => this.finish(true));
    }
  }

  returnSample(obj) {
    this.tweens.add({
      targets: obj,
      x: obj.getData('startX'),
      y: obj.getData('startY'),
      duration: 180,
    });
  }

  finish(success, reason = '') {
    if (this.finished) return;
    this.finished = true;
    this.timerEvent?.remove();
    this.skipBtn?.setEnabled(false);
    const result = manager.resolveMaintenance(success, this.variant);
    const money = result?.moneyDelta ?? 0;
    const rep = result?.repDelta ?? 0;
    this.statusText.setText(
      success
        ? `ИСПРАВНО. +${money} ₽ · +${rep} РЕП.`
        : `${reason || 'ПРОВАЛ'}. ${money} ₽ · ${rep} РЕП.`
    );
    this.statusText.setColor(success ? COLORS.green : COLORS.red);
    this.titleText.setText(success ? 'ЗАЯВКА ЗАКРЫТА' : 'ЗАЯВКА ПРОВАЛЕНА');
    this.cameras.main.flash(success ? 180 : 120, success ? 40 : 160, success ? 120 : 30, 30);
    if (success) manager.audio?.confirm?.();
    else manager.audio?.error?.();
    this.time.delayedCall(reason === 'ОТКАЗ' ? 260 : 1100, () => this.close());
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.restoreSourceInput();
    this.game.maintenanceController?.onClosed();
    this.scene.stop();
  }
}
