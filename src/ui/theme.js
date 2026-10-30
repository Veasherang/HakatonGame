/**
 * Визуальная тема: палитра, шрифты, панели, иконки и CRT-текстуры.
 */
export const COLORS = {
  black: 0x05080a,
  bg: 0x070d0f,
  panel: 0x0a1417,
  panel2: 0x0e1b1f,
  panel3: 0x132328,
  line: 0x284347,
  lineBright: 0x3d6767,
  text: 0xe8f2ec,
  dim: 0xa7bcb4,
  dimmer: 0x7d948d,
  green: 0x6ad48a,
  greenDark: 0x2c5a42,
  amber: 0xf0c24a,
  yellow: 0xffd75e,
  red: 0xd8503f,
  redDark: 0x5c211a,
  cyan: 0x6fc7c9,
  blue: 0x6fa8d8,
  purple: 0xb58ed8,
  white: 0xe9f3ec,
  brown: 0xa8896a,
};

export const FONT = {
  display: '"Press Start 2P", monospace',
  body: '"Pixelify Sans", "Courier New", monospace',
};

export const hexCss = (color) => `#${Number(color).toString(16).padStart(6, '0')}`;

/** Цвет индикатора в зависимости от характеристики и значения. */
export function statColor(key, value) {
  const v = Math.max(0, Math.min(100, value));
  switch (key) {
    case 'hunger':
      return v >= 85 ? COLORS.red : v >= 65 ? COLORS.amber : COLORS.green;
    case 'stress':
      return v >= 85 ? COLORS.red : v >= 60 ? COLORS.amber : COLORS.green;
    case 'energy':
      return v <= 20 ? COLORS.red : v <= 40 ? COLORS.amber : COLORS.cyan;
    case 'health':
      return v <= 25 ? COLORS.red : v <= 50 ? COLORS.amber : COLORS.green;
    case 'aggression':
      return v >= 75 ? COLORS.red : v >= 50 ? COLORS.amber : COLORS.green;
    case 'cleanliness':
      return v <= 30 ? COLORS.red : v <= 50 ? COLORS.amber : COLORS.cyan;
    case 'integrity':
      return v <= 30 ? COLORS.red : v <= 55 ? COLORS.amber : COLORS.green;
    case 'loyalty':
      return v >= 60 ? COLORS.green : v >= 35 ? COLORS.cyan : COLORS.amber;
    default:
      return COLORS.text;
  }
}

export function textStyle(size = 16, color = COLORS.text, options = {}) {
  const isDisplay = options.font === 'display';
  return {
    fontFamily: isDisplay ? FONT.display : FONT.body,
    fontSize: `${size}px`,
    fontStyle: options.fontStyle || (isDisplay ? 'normal' : '600'),
    color: hexCss(color),
    align: options.align || 'left',
    ...(options.wrap ? { wordWrap: { width: options.wrap, useAdvancedWrap: true } } : {}),
    ...(options.lineSpacing ? { lineSpacing: options.lineSpacing } : {}),
  };
}

/** Текст с пиксельным шрифтом и сглаживанием под DPR. */
export function makeText(scene, x, y, value, options = {}) {
  const style = textStyle(options.size || 15, options.color ?? COLORS.text, options);
  const object = scene.add.text(x, y, value, style);
  object.setResolution(1);
  if (options.origin) object.setOrigin(...options.origin);
  if (options.lineSpacing) object.setLineSpacing(options.lineSpacing);
  return object;
}

/** Панель с рамкой и уголками. */
export function drawPanel(g, x, y, w, h, options = {}) {
  const fill = options.fill ?? COLORS.panel;
  const stroke = options.stroke ?? COLORS.line;
  const alpha = options.alpha ?? 0.94;

  g.fillStyle(fill, alpha);
  g.fillRect(x, y, w, h);

  if (options.inner !== false) {
    g.fillStyle(options.innerFill ?? COLORS.panel2, options.innerAlpha ?? 0.55);
    g.fillRect(x + 2, y + 2, w - 4, h - 4);
  }

  g.lineStyle(1, stroke, options.strokeAlpha ?? 0.9);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  if (options.corners) {
    drawCorners(g, x, y, w, h, options.cornerColor ?? COLORS.lineBright, options.cornerSize ?? 10);
  }
  return g;
}

export function drawCorners(g, x, y, w, h, color = COLORS.lineBright, size = 10, alpha = 0.9) {
  g.lineStyle(2, color, alpha);
  g.lineBetween(x, y + size, x, y);
  g.lineBetween(x, y, x + size, y);
  g.lineBetween(x + w - size, y, x + w, y);
  g.lineBetween(x + w, y, x + w, y + size);
  g.lineBetween(x, y + h - size, x, y + h);
  g.lineBetween(x, y + h, x + size, y + h);
  g.lineBetween(x + w - size, y + h, x + w, y + h);
  g.lineBetween(x + w, y + h - size, x + w, y + h);
}

/** Полоса индикатора. */
export function drawBar(g, x, y, w, h, value, color, options = {}) {
  const clamped = Math.max(0, Math.min(100, value));
  g.fillStyle(options.bg ?? COLORS.black, options.alpha ?? 0.85);
  g.fillRect(x, y, w, h);

  g.fillStyle(color, 1);
  g.fillRect(x + 1, y + 1, Math.max(0, ((w - 2) * clamped) / 100), h - 2);

  g.lineStyle(1, options.stroke ?? COLORS.line, 0.9);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  if (options.ticks !== false) {
    g.lineStyle(1, COLORS.black, 0.45);
    for (let i = 1; i < 10; i += 1) {
      const tx = Math.round(x + (w * i) / 10);
      g.lineBetween(tx, y + 1, tx, y + h - 1);
    }
  }
}

/** Пиксельные иконки. */
export function drawIcon(g, name, x, y, size, color = COLORS.text) {
  const u = size / 10;
  const px = (dx, dy, w, h) => g.fillRect(x + dx * u, y + dy * u, w * u, h * u);
  g.fillStyle(color, 1);

  switch (name) {
    case 'money':
      g.fillCircle(x + size / 2, y + size / 2, size * 0.34);
      g.fillStyle(COLORS.black, 1);
      g.fillRect(x + size * 0.46, y + size * 0.28, size * 0.08, size * 0.44);
      break;
    case 'biomass':
      g.fillTriangle(x + 2 * u, y + 9 * u, x + 8 * u, y + 9 * u, x + 5 * u, y + 3 * u);
      g.fillRect(x + 4 * u, y + 1 * u, 2 * u, 2 * u);
      break;
    case 'rep':
      g.fillTriangle(x + 5 * u, y, x + 10 * u, y + 5 * u, x + 5 * u, y + 10 * u);
      g.fillTriangle(x + 5 * u, y, x, y + 5 * u, x + 5 * u, y + 10 * u);
      break;
    case 'energy':
      g.fillTriangle(x + 6 * u, y, x + 2 * u, y + 6 * u, x + 5 * u, y + 6 * u);
      g.fillTriangle(x + 4 * u, y + 10 * u, x + 8 * u, y + 4 * u, x + 5 * u, y + 4 * u);
      break;
    case 'power':
      g.fillRect(x + 1 * u, y + 6 * u, 2 * u, 3 * u);
      g.fillRect(x + 3 * u, y + 4 * u, 5 * u, 5 * u);
      g.fillRect(x + 8 * u, y + 6 * u, 1 * u, 1 * u);
      break;
    case 'alert':
      g.fillTriangle(x + 5 * u, y + 1 * u, x + 10 * u, y + 9 * u, x, y + 9 * u);
      g.fillStyle(COLORS.black, 1);
      g.fillRect(x + 4.5 * u, y + 3.5 * u, 1 * u, 3 * u);
      g.fillRect(x + 4.5 * u, y + 7 * u, 1 * u, 1 * u);
      break;
    case 'clock':
      g.lineStyle(size * 0.12, color, 1);
      g.strokeCircle(x + size / 2, y + size / 2, size * 0.36);
      g.lineBetween(x + size / 2, y + size / 2, x + size / 2, y + size * 0.24);
      g.lineBetween(x + size / 2, y + size / 2, x + size * 0.72, y + size / 2);
      break;
    case 'feed':
      g.fillRect(x + 2 * u, y + 6 * u, 6 * u, 1 * u);
      g.fillTriangle(x + 2 * u, y + 7 * u, x + 8 * u, y + 7 * u, x + 7 * u, y + 9 * u);
      g.fillTriangle(x + 2 * u, y + 7 * u, x + 7 * u, y + 9 * u, x + 3 * u, y + 9 * u);
      break;
    case 'train':
      g.fillRect(x + 2 * u, y + 2 * u, 6 * u, 1 * u);
      g.fillRect(x + 2 * u, y + 5 * u, 6 * u, 1 * u);
      g.fillRect(x + 2 * u, y + 8 * u, 4 * u, 1 * u);
      break;
    case 'calm':
      g.lineStyle(size * 0.1, color, 1);
      g.lineBetween(x + 1 * u, y + 4 * u, x + 5 * u, y + 2 * u);
      g.lineBetween(x + 5 * u, y + 2 * u, x + 9 * u, y + 4 * u);
      g.lineBetween(x + 1 * u, y + 8 * u, x + 5 * u, y + 6 * u);
      g.lineBetween(x + 5 * u, y + 6 * u, x + 9 * u, y + 8 * u);
      break;
    case 'cell':
      g.fillRect(x + 1 * u, y + 1 * u, 8 * u, 1 * u);
      g.fillRect(x + 1 * u, y + 9 * u, 8 * u, 1 * u);
      g.fillRect(x + 1 * u, y + 1 * u, 1 * u, 8 * u);
      g.fillRect(x + 8 * u, y + 1 * u, 1 * u, 8 * u);
      g.fillRect(x + 4.5 * u, y + 1 * u, 1 * u, 8 * u);
      break;
    case 'contract':
      g.fillRect(x + 2 * u, y + 1 * u, 6 * u, 8 * u);
      g.fillStyle(COLORS.black, 1);
      g.fillRect(x + 3 * u, y + 3 * u, 4 * u, 1 * u);
      g.fillRect(x + 3 * u, y + 5 * u, 4 * u, 1 * u);
      g.fillRect(x + 3 * u, y + 7 * u, 2 * u, 1 * u);
      break;
    case 'mutate':
      g.lineStyle(size * 0.1, color, 1);
      g.lineBetween(x + 3 * u, y + 1 * u, x + 7 * u, y + 9 * u);
      g.lineBetween(x + 7 * u, y + 1 * u, x + 3 * u, y + 9 * u);
      g.fillRect(x + 4.5 * u, y + 4 * u, 1 * u, 1 * u);
      g.fillRect(x + 4.5 * u, y + 6 * u, 1 * u, 1 * u);
      break;
    case 'back':
      g.fillTriangle(x + 2 * u, y + 5 * u, x + 6 * u, y + 2 * u, x + 6 * u, y + 8 * u);
      g.fillRect(x + 6 * u, y + 4 * u, 3 * u, 2 * u);
      break;
    case 'close':
      g.lineStyle(size * 0.12, color, 1);
      g.lineBetween(x + 2 * u, y + 2 * u, x + 8 * u, y + 8 * u);
      g.lineBetween(x + 8 * u, y + 2 * u, x + 2 * u, y + 8 * u);
      break;
    case 'lock':
      g.fillRect(x + 2 * u, y + 4 * u, 6 * u, 5 * u);
      g.lineStyle(size * 0.12, color, 1);
      g.beginPath();
      g.arc(x + 5 * u, y + 4 * u, 2 * u, Math.PI, 0, false);
      g.strokePath();
      g.fillStyle(COLORS.black, 1);
      g.fillRect(x + 4.5 * u, y + 6 * u, 1 * u, 2 * u);
      break;
    case 'lamp':
      g.fillCircle(x + 5 * u, y + 4 * u, 2.5 * u);
      g.fillRect(x + 4 * u, y + 7 * u, 2 * u, 2 * u);
      g.fillRect(x + 3.5 * u, y + 9 * u, 3 * u, 0.8 * u);
      break;
    case 'vent':
      g.lineStyle(size * 0.1, color, 1);
      for (let i = 0; i < 3; i += 1) {
        g.lineBetween(x + (2 + i * 2.4) * u, y + 2 * u, x + (1 + i * 2.4) * u, y + 8 * u);
      }
      break;
    case 'speaker':
      g.fillRect(x + 1 * u, y + 4 * u, 2 * u, 2 * u);
      g.fillTriangle(x + 3 * u, y + 4 * u, x + 3 * u, y + 6 * u, x + 6 * u, y + 2 * u);
      g.fillTriangle(x + 3 * u, y + 4 * u, x + 6 * u, y + 8 * u, x + 3 * u, y + 6 * u);
      g.lineStyle(size * 0.08, color, 1);
      g.arc(x + 6 * u, y + 5 * u, 2 * u, -0.7, 0.7, false);
      break;
    case 'shield':
      g.fillTriangle(x + 5 * u, y, x + 9 * u, y + 3 * u, x + 5 * u, y + 10 * u);
      g.fillTriangle(x + 5 * u, y, x, y + 3 * u, x + 5 * u, y + 10 * u);
      break;
    case 'sensor':
      g.lineStyle(size * 0.1, color, 1);
      g.strokeCircle(x + 5 * u, y + 5 * u, 1 * u);
      g.arc(x + 5 * u, y + 5 * u, 3 * u, -0.9, 0.9, false);
      g.arc(x + 5 * u, y + 5 * u, 4.5 * u, -0.9, 0.9, false);
      break;
    case 'armor':
      g.fillTriangle(x + 5 * u, y, x + 9 * u, y + 2 * u, x + 5 * u, y + 9 * u);
      g.fillTriangle(x + 5 * u, y, x, y + 2 * u, x + 5 * u, y + 9 * u);
      g.fillStyle(COLORS.black, 1);
      g.fillRect(x + 4.5 * u, y + 2 * u, 1 * u, 4 * u);
      g.fillRect(x + 3 * u, y + 3.5 * u, 4 * u, 1 * u);
      break;
    case 'bowl':
      g.fillRect(x + 1 * u, y + 5 * u, 8 * u, 1 * u);
      g.fillRect(x + 2 * u, y + 6 * u, 6 * u, 2 * u);
      g.fillRect(x + 3 * u, y + 8 * u, 4 * u, 1 * u);
      break;
    case 'wrench':
      g.lineStyle(size * 0.14, color, 1);
      g.lineBetween(x + 3 * u, y + 8 * u, x + 8 * u, y + 3 * u);
      g.strokeCircle(x + 2.5 * u, y + 8.5 * u, 1.2 * u);
      break;
    case 'coffee':
      g.fillRect(x + 2 * u, y + 4 * u, 5 * u, 4 * u);
      g.fillRect(x + 7 * u, y + 5 * u, 1 * u, 2 * u);
      g.fillRect(x + 2 * u, y + 9 * u, 6 * u, 0.8 * u);
      g.fillRect(x + 3 * u, y + 1 * u, 0.7 * u, 2 * u);
      g.fillRect(x + 5 * u, y + 0.5 * u, 0.7 * u, 2.5 * u);
      break;
    case 'camera':
      g.fillRect(x + 1 * u, y + 3 * u, 8 * u, 5 * u);
      g.fillStyle(COLORS.black, 1);
      g.fillCircle(x + 5 * u, y + 5.5 * u, 1.6 * u);
      g.fillStyle(color, 1);
      g.fillRect(x + 3 * u, y + 1.5 * u, 3 * u, 1 * u);
      break;
    case 'note':
      g.fillRect(x + 2 * u, y + 1 * u, 6 * u, 8 * u);
      g.fillStyle(COLORS.black, 1);
      g.fillRect(x + 3 * u, y + 3 * u, 4 * u, 0.8 * u);
      g.fillRect(x + 3 * u, y + 5 * u, 4 * u, 0.8 * u);
      g.fillRect(x + 3 * u, y + 7 * u, 2 * u, 0.8 * u);
      break;
    case 'sound':
      g.fillRect(x + 1 * u, y + 4 * u, 2 * u, 2 * u);
      g.fillTriangle(x + 3 * u, y + 4 * u, x + 6 * u, y + 1.5 * u, x + 6 * u, y + 8.5 * u);
      break;
    case 'mute':
      g.fillRect(x + 1 * u, y + 4 * u, 2 * u, 2 * u);
      g.fillTriangle(x + 3 * u, y + 4 * u, x + 6 * u, y + 1.5 * u, x + 6 * u, y + 8.5 * u);
      g.lineStyle(size * 0.1, color, 1);
      g.lineBetween(x + 7 * u, y + 3 * u, x + 9 * u, y + 7 * u);
      g.lineBetween(x + 9 * u, y + 3 * u, x + 7 * u, y + 7 * u);
      break;
    case 'eye':
      g.lineStyle(size * 0.1, color, 1);
      g.strokeEllipse(x + 5 * u, y + 5 * u, 8 * u, 5 * u);
      g.fillCircle(x + 5 * u, y + 5 * u, 1.5 * u);
      break;
    case 'skull':
      g.fillCircle(x + 5 * u, y + 4 * u, 3.4 * u);
      g.fillRect(x + 3.5 * u, y + 6 * u, 3 * u, 3 * u);
      g.fillStyle(COLORS.black, 1);
      g.fillRect(x + 3.5 * u, y + 3.5 * u, 1 * u, 1.5 * u);
      g.fillRect(x + 5.5 * u, y + 3.5 * u, 1 * u, 1.5 * u);
      break;
    default:
      g.fillRect(x + 3 * u, y + 3 * u, 4 * u, 4 * u);
      break;
  }
}

/** Текстуры шума и скан-линий для CRT-эффектов. */
export function ensureFxTextures(scene) {
  if (!scene.textures.exists('scanlines')) {
    const canvas = scene.textures.createCanvas('scanlines', 4, 4);
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 4, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 2, 4, 1);
    canvas.refresh();
  }
  for (let index = 0; index < 3; index += 1) {
    const key = `noise${index}`;
    if (!scene.textures.exists(key)) {
      const size = 96;
      const canvas = scene.textures.createCanvas(key, size, size);
      const ctx = canvas.getContext();
      const image = ctx.createImageData(size, size);
      for (let i = 0; i < image.data.length; i += 4) {
        const value = Math.random() * 255;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = Math.random() < 0.55 ? 120 : 0;
      }
      ctx.putImageData(image, 0, 0);
      canvas.refresh();
    }
  }
  if (!scene.textures.exists('vignette')) {
    const size = 256;
    const canvas = scene.textures.createCanvas('vignette', size, size);
    const ctx = canvas.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.62);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.35)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}

export function addScanlines(scene, x, y, w, h, alpha = 0.35, depth = 1) {
  ensureFxTextures(scene);
  return scene.add
    .tileSprite(x, y, w, h, 'scanlines')
    .setOrigin(0)
    .setAlpha(alpha)
    .setDepth(depth);
}

export function addVignette(scene, x, y, w, h, alpha = 0.8, depth = 2) {
  ensureFxTextures(scene);
  return scene.add.image(x + w / 2, y + h / 2, 'vignette')
    .setDisplaySize(w, h)
    .setAlpha(alpha)
    .setDepth(depth);
}
