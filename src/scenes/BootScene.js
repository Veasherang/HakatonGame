/**
 * Загрузка ресурсов, генерация служебных текстур и переход в меню.
 */
import { CREATURE_DEFS } from '../data/creatures.js';
import { ensureFxTextures } from '../ui/theme.js';

const CREATURE_INDEX = { bobek: 1, pamydsa: 2, mishutka: 3, vodolazik: 4 };

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const progressBar = document.getElementById('boot-progress');
    const status = document.getElementById('boot-status');

    this.load.on('progress', (value) => {
      if (progressBar) progressBar.style.width = `${Math.max(4, Math.round(value * 100))}%`;
      if (status) status.textContent = `ЗАГРУЗКА СЕКТОРОВ… ${Math.round(value * 100)}%`;
    });
    this.load.on('fileprogress', (file) => {
      if (status && file?.key) status.textContent = `ЗАГРУЗКА: ${String(file.key).toUpperCase()}`;
    });
    this.load.on('loaderror', (file) => {
      console.warn('[Boot] Не удалось загрузить', file?.src);
    });

    this.load.image('office_bg', this.assetSource('office_bg', 'assets/office_bg.png'));
    this.load.image('room_bg', this.assetSource('room_bg', 'assets/room_bg.png'));
    this.load.image('cam_bg', this.assetSource('cam_bg', 'assets/cam_bg.png'));

    for (const [id, index] of Object.entries(CREATURE_INDEX)) {
      for (let stage = 1; stage <= 3; stage += 1) {
        const key = `${id}_${stage}`;
        if (!this.textures.exists(key)) {
          this.load.image(
            key,
            this.assetSource(key, `assets/creatures/m${index}_s${stage}.png`)
          );
        }
        const thumbKey = `${key}_thumb`;
        if (!this.textures.exists(thumbKey)) {
          this.load.image(
            thumbKey,
            this.assetSource(thumbKey, `assets/creatures/m${index}_s${stage}_thumb.png`)
          );
        }
      }
    }
  }

  /**
   * В автономной сборке ресурсы передаются как data:URI через window.ATD_ASSETS.
   * При запуске с сервера используется обычный путь к файлу.
   */
  assetSource(key, fallback) {
    const assets = typeof window !== 'undefined' ? window.ATD_ASSETS : null;
    return (assets && assets[key]) || fallback;
  }

  create() {
    ensureFxTextures(this);
    this.createFallbacks();
    const status = document.getElementById('boot-status');
    if (status) status.textContent = 'СИСТЕМА ГОТОВА. ДОБРО ПОЖАЛОВАТЬ.';

    this.time.delayedCall(420, () => {
      const bootScreen = document.getElementById('boot');
      if (bootScreen) bootScreen.classList.add('hidden');
      this.scene.start('Menu');
    });
  }

  /** Если файл не загрузился — рисуем заменяемый силуэт, игра не падает. */
  createFallbacks() {
    if (!this.textures.exists('office_bg') || !this.textures.exists('room_bg')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x0a1417, 1);
      g.fillRect(0, 0, 1280, 800);
      g.lineStyle(1, 0x1c3438, 1);
      for (let x = 0; x < 1280; x += 64) g.lineBetween(x, 0, x, 800);
      for (let y = 0; y < 800; y += 64) g.lineBetween(0, y, 1280, y);
      g.generateTexture('office_bg', 1280, 800);
      g.generateTexture('room_bg', 1280, 800);
      g.destroy();
    }
    if (!this.textures.exists('cam_bg')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x111b1c, 1).fillRect(0, 0, 640, 360);
      g.fillStyle(0x0a1213, 1).fillRect(20, 40, 600, 280);
      g.generateTexture('cam_bg', 640, 360);
      g.destroy();
    }

    for (const [id] of Object.entries(CREATURE_INDEX)) {
      for (let stage = 1; stage <= 3; stage += 1) {
        const key = `${id}_${stage}`;
        if (!this.textures.exists(key)) this.makeSilhouette(key, CREATURE_DEFS[id]?.color || 0x6a8f7a, 260, 380);
        const thumbKey = `${key}_thumb`;
        if (!this.textures.exists(thumbKey)) this.makeSilhouette(thumbKey, CREATURE_DEFS[id]?.color || 0x6a8f7a, 100, 150);
      }
    }
  }

  makeSilhouette(key, color, width, height) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 0.85);
    g.fillEllipse(width / 2, height * 0.62, width * 0.66, height * 0.66);
    g.fillCircle(width / 2, height * 0.24, width * 0.2);
    g.fillStyle(0x05080a, 1);
    g.fillCircle(width * 0.43, height * 0.22, width * 0.035);
    g.fillCircle(width * 0.57, height * 0.22, width * 0.035);
    g.generateTexture(key, width, height);
    g.destroy();
  }
}
