/**
 * Базовые элементы интерфейса: кнопки, индикаторы, журнал, уведомления.
 */
import { COLORS, drawBar, drawIcon, drawPanel, makeText } from './theme.js';

const VARIANTS = {
  default: {
    fill: 0x0e1b1f,
    hover: 0x16292e,
    border: 0x284347,
    hoverBorder: 0x4e7d7a,
    accent: 0x3d6767,
    text: COLORS.text,
  },
  primary: {
    fill: 0x10241c,
    hover: 0x173628,
    border: 0x2c5a42,
    hoverBorder: 0x6ad48a,
    accent: 0x6ad48a,
    text: 0xb8ecc8,
  },
  amber: {
    fill: 0x241f10,
    hover: 0x322a16,
    border: 0x5c4a1c,
    hoverBorder: 0xf0c24a,
    accent: 0xf0c24a,
    text: 0xf2d789,
  },
  danger: {
    fill: 0x24100d,
    hover: 0x351814,
    border: 0x5c211a,
    hoverBorder: 0xd8503f,
    accent: 0xd8503f,
    text: 0xea9d8f,
  },
  ghost: {
    fill: 0x060c0e,
    hover: 0x0e1b1f,
    border: 0x22383b,
    hoverBorder: 0x3d6767,
    accent: 0x22383b,
    text: COLORS.dim,
  },
  purple: {
    fill: 0x1b1424,
    hover: 0x271c33,
    border: 0x46305c,
    hoverBorder: 0xb58ed8,
    accent: 0xb58ed8,
    text: 0xd2b8ea,
  },
};

export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width, height, label, options = {}) {
    super(scene, x, y);
    this.w = width;
    this.h = height;
    this.options = options;
    this.variant = options.variant || 'default';
    this.enabled = options.enabled !== false;
    this.hovered = false;
    this.pressed = false;
    this.onClick = options.onClick || null;
    this.labelText = label;
    this.subText = options.sub || '';
    this.iconName = options.icon || null;

    this.bg = scene.add.graphics();
    this.labelObj = makeText(scene, 0, 0, label, {
      size: options.size || 10,
      color: COLORS.text,
      font: options.font || 'display',
    });
    this.subObj = options.sub
      ? makeText(scene, 0, 0, options.sub, {
          size: options.subSize || 9,
          color: COLORS.dim,
          font: 'display',
          origin: [1, 0.5],
        })
      : null;

    this.add([this.bg, this.labelObj]);
    if (this.subObj) this.add(this.subObj);

    this.setSize(width, height);

    // Отдельная зона ввода: контейнеры Phaser иногда некорректно считают hitArea.
    this.zone = scene.add
      .zone(0, 0, width, height)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.add(this.zone);

    this.zone.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
    });
    this.zone.on('pointerout', () => {
      this.hovered = false;
      this.pressed = false;
      this.redraw();
    });
    this.zone.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation?.();
      if (!this.enabled) return;
      this.pressed = true;
      this.redraw();
    });
    this.zone.on('pointerup', (pointer, localX, localY, event) => {
      event?.stopPropagation?.();
      if (!this.enabled) return;
      const wasPressed = this.pressed;
      this.pressed = false;
      this.redraw();
      if (wasPressed) {
        scene.game.audio?.ui?.();
        this.onClick?.();
      }
    });

    this.redraw();
    scene.add.existing(this);
  }

  setLabel(label) {
    this.labelText = label;
    this.labelObj.setText(label);
    this.layout();
  }

  setSub(sub) {
    this.subText = sub || '';
    if (this.subObj) this.subObj.setText(this.subText);
    else if (sub) {
      this.subObj = makeText(this.scene, 0, 0, sub, {
        size: this.options.subSize || 9,
        color: COLORS.dim,
        font: 'display',
        origin: [1, 0.5],
      });
      this.add(this.subObj);
    }
    this.layout();
  }

  setVariant(variant) {
    this.variant = variant;
    this.redraw();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.zone?.input) this.zone.input.enabled = this.enabled;
    if (this.zone) this.zone.setVisible(true);
    this.setAlpha(this.enabled ? 1 : 0.42);
    if (!this.enabled) {
      this.hovered = false;
      this.pressed = false;
    }
    this.redraw();
  }

  layout() {
    const font = this.options.font || 'display';
    const hasIcon = Boolean(this.iconName);
    const left = hasIcon ? 34 : 14;
    if (this.subObj) {
      this.labelObj.setOrigin(0, 0.5);
      this.labelObj.setPosition(left, this.h / 2);
      this.subObj.setOrigin(1, 0.5);
      this.subObj.setPosition(this.w - 14, this.h / 2);
    } else {
      this.labelObj.setOrigin(0.5, 0.5);
      this.labelObj.setPosition(this.w / 2, this.h / 2);
    }
    if (font === 'display') this.labelObj.setFontSize(this.options.size || 10);
  }

  redraw() {
    const theme = VARIANTS[this.variant] || VARIANTS.default;
    const g = this.bg;
    g.clear();

    g.fillStyle(0x000000, 0.45);
    g.fillRect(3, 3, this.w, this.h);

    const fill = this.hovered && this.enabled ? theme.hover : theme.fill;
    g.fillStyle(fill, 0.97);
    g.fillRect(0, 0, this.w, this.h);

    if (this.hovered && this.enabled) {
      g.fillStyle(theme.accent, 0.08);
      g.fillRect(0, 0, this.w, this.h);
    }

    g.lineStyle(1, this.hovered && this.enabled ? theme.hoverBorder : theme.border, 1);
    g.strokeRect(0.5, 0.5, this.w - 1, this.h - 1);

    g.fillStyle(theme.accent, this.enabled ? 1 : 0.4);
    g.fillRect(0, 0, 3, this.h);

    if (this.pressed && this.enabled) {
      g.fillStyle(0x000000, 0.25);
      g.fillRect(0, 0, this.w, this.h);
    }

    if (this.iconName) {
      drawIcon(g, this.iconName, 12, (this.h - 16) / 2, 16, theme.accent);
    }

    this.labelObj.setColor(theme.text);
    if (this.subObj) this.subObj.setColor(this.hovered ? COLORS.text : COLORS.dim);
    this.layout();
  }

  destroy(fromScene) {
    super.destroy(fromScene);
  }
}

export class StatBar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width, label, options = {}) {
    super(scene, x, y);
    this.w = width;
    this.options = options;
    this.value = 0;
    this.color = options.color || COLORS.green;
    this.height = options.height || (options.compact ? 19 : 26);

    const labelSize = options.labelSize || (options.compact ? 11 : 13);
    this.labelObj = makeText(scene, 0, 0, label, {
      size: labelSize,
      color: options.labelColor || COLORS.dim,
      font: 'body',
    });
    this.valueObj = makeText(scene, width, 0, '0', {
      size: options.valueSize || (options.compact ? 8 : 9),
      color: options.valueColor || COLORS.text,
      font: 'display',
      origin: [1, 0],
    });

    this.barGraphics = scene.add.graphics();
    this.add([this.barGraphics, this.labelObj, this.valueObj]);
    this.setSize(width, this.height);
    scene.add.existing(this);
    this.redraw();
  }

  setValue(value, color = null, displayValue = null) {
    this.value = Math.max(0, Math.min(100, value));
    if (color) this.color = color;
    this.valueObj.setText(displayValue ?? String(Math.round(this.value)));
    this.redraw();
  }

  setColor(color) {
    this.color = color;
    this.redraw();
  }

  redraw() {
    const barY = this.options.compact ? 13 : 17;
    const barH = this.options.barHeight || (this.options.compact ? 4 : 7);
    drawBar(this.barGraphics, 0, barY, this.w, barH, this.value, this.color, {
      ticks: this.options.ticks !== false,
    });
  }
}

export class ResourceRow extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width, icon, label, color, options = {}) {
    super(scene, x, y);
    this.w = width;
    this.iconName = icon;
    this.color = color;
    this.iconGraphics = scene.add.graphics();
    this.labelObj = makeText(scene, 28, 0, label, {
      size: options.labelSize || 11,
      color: COLORS.dim,
      font: 'body',
    });
    this.valueObj = makeText(scene, width, 0, '—', {
      size: options.valueSize || 15,
      color: COLORS.text,
      font: 'display',
      origin: [1, 0],
    });
    this.add([this.iconGraphics, this.labelObj, this.valueObj]);
    this.setSize(width, 20);
    scene.add.existing(this);
    this.renderIcon();
  }

  renderIcon() {
    this.iconGraphics.clear();
    drawIcon(this.iconGraphics, this.iconName, 0, 0, 18, this.color);
  }

  setValue(value) {
    this.valueObj.setText(String(value));
  }
}

export class LogList extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width, height, options = {}) {
    super(scene, x, y);
    this.w = width;
    this.h = height;
    this.maxLines = options.maxLines || 11;
    this.lineSize = options.size || 13;
    this.entries = [];
    this.lines = [];

    // Жёстко обрезаем журнал по высоте, чтобы длинные строки не залезали
    // на заголовок «ЖУРНАЛ».
    const maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(x, y, width, height);
    this.logMask = maskShape.createGeometryMask();
    this.setMask(this.logMask);

    scene.add.existing(this);
  }

  setEntries(entries) {
    this.entries = entries || [];
    this.rebuild();
  }

  rebuild() {
    for (const line of this.lines) line.destroy();
    this.lines = [];

    const recent = this.entries.slice(-this.maxLines);
    let y = this.h;
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      const entry = recent[i];
      const color =
        entry.kind === 'danger'
          ? COLORS.red
          : entry.kind === 'warning'
            ? COLORS.amber
            : entry.kind === 'good'
              ? COLORS.green
              : entry.kind === 'money'
                ? COLORS.yellow
                : entry.kind === 'plot'
                  ? COLORS.purple
                  : COLORS.dim;
      const time = `${String(Math.floor(entry.time / 60)).padStart(2, '0')}:${String(entry.time % 60).padStart(2, '0')}`;
      const text = String(entry.text || '').slice(0, 180);
      const line = makeText(this.scene, 0, y, `${time}  ${text}`, {
        size: this.lineSize,
        color,
        font: 'body',
        wrap: this.w,
        origin: [0, 1],
        lineSpacing: 1,
      });
      this.add(line);
      this.lines.push(line);
      y -= line.height + 3;
      if (y < -this.h) break;
    }
  }
}

/** Всплывающее уведомление. */
export function showToast(scene, message, options = {}) {
  const width = Math.min(560, Math.max(240, message.length * 8.2 + 56));
  const x = 640 - width / 2;
  const y = options.y || 706;
  const container = scene.add.container(0, 0).setDepth(options.depth || 900);
  const g = scene.add.graphics();
  const color =
    options.kind === 'danger'
      ? COLORS.red
      : options.kind === 'good'
        ? COLORS.green
        : options.kind === 'plot'
          ? COLORS.purple
          : COLORS.amber;
  drawPanel(g, x, y, width, 42, {
    fill: COLORS.black,
    stroke: color,
    alpha: 0.94,
    cornerColor: color,
    cornerSize: 7,
  });
  const label = makeText(scene, 640, y + 21, message, {
    size: 14,
    color: COLORS.text,
    font: 'body',
    origin: [0.5, 0.5],
  });
  container.add([g, label]);
  container.setAlpha(0);
  container.y = 8;
  scene.tweens.add({
    targets: container,
    alpha: 1,
    y: 0,
    duration: 160,
    ease: 'Quad.out',
    onComplete: () => {
      scene.tweens.add({
        targets: container,
        alpha: 0,
        y: -6,
        delay: options.duration || 2600,
        duration: 260,
        onComplete: () => container.destroy(),
      });
    },
  });
  return container;
}

/** Полоска прогресса (для обучения/контракта). */
export class ProgressBar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width, color = COLORS.green) {
    super(scene, x, y);
    this.w = width;
    this.color = color;
    this.graphics = scene.add.graphics();
    this.add(this.graphics);
    scene.add.existing(this);
    this.setProgress(0);
  }

  setProgress(ratio) {
    const value = Math.max(0, Math.min(1, ratio)) * 100;
    this.graphics.clear();
    drawBar(this.graphics, 0, 0, this.w, 5, value, this.color, { ticks: false });
  }
}

export { COLORS, drawPanel, drawIcon, makeText };
