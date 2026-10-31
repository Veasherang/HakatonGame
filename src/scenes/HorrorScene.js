/**
 * Хоррор-сцена побега: резкий скример без насилия — только свет, шум и звук.
 */
import { game as manager } from '../managers/GameManager.js';
import { HORROR_LINES } from '../data/plot.js';
import { addCoverImage } from '../ui/backdrop.js';
import { COLORS, addScanlines, makeText } from '../ui/theme.js';
import { Button } from '../ui/widgets.js';

export class HorrorScene extends Phaser.Scene {
  constructor() {
    super('Horror');
  }

  init(data) {
    this.escape = data || {};
  }

  create() {
    this.finished = false;
    const escape = this.escape || {};
    const stage = escape.stage || 1;
    const defId = escape.defId || 'bobek';
    const name = escape.name || 'СУБЪЕКТ';

    this.cameras.main.setBackgroundColor('#020304');
    this.add.rectangle(0, 0, 1280, 800, 0x020304, 1).setOrigin(0);
    addCoverImage(this, 'room_bg', 1280, 800, { tint: 0x3a1c18, alpha: 0.14 });

    this.noise = this.add
      .tileSprite(0, 0, 1280, 800, 'noise0')
      .setOrigin(0)
      .setAlpha(0.3)
      .setDepth(30);

    const texture = `${defId}_${stage}`;
    const key = this.textures.exists(texture) ? texture : `${defId}_1`;
    this.monster = this.add.image(640, 780, key).setOrigin(0.5, 1).setDepth(10);
    const frame = this.monster.frame;
    const baseScale = Math.min(620 / frame.realHeight, 920 / frame.realWidth);
    this.monster.setScale(baseScale * 1.25);
    this.monster.setAlpha(1);

    // Никакого медленного приближения: резкий удар в первом кадре.
    this.cameras.main.flash(110, 255, 235, 220);
    this.cameras.main.shake(520, 0.016);
    this.time.delayedCall(90, () => {
      this.cameras.main.flash(140, 160, 20, 10);
      this.cameras.main.shake(420, 0.01);
    });

    this.add
      .text(640, 36, 'ОН УЖЕ ЗДЕСЬ', {
        fontFamily: '"Rubik", "Segoe UI", sans-serif',
        fontWeight: '700',
        fontSize: '30px',
        color: '#e8503f',
        stroke: '#1a0202',
        strokeThickness: 8,
      })
      .setOrigin(0.5, 0)
      .setDepth(31);

    const lines = [
      HORROR_LINES[0],
      `${name} УЖЕ ЗДЕСЬ.`,
      HORROR_LINES[3],
    ];
    lines.forEach((line, index) => {
      this.time.delayedCall(120 + index * 420, () => {
        if (!this.scene.isActive()) return;
        const text = makeText(this, 640, 100 + index * 48, line, {
          size: 14,
          color: index === 1 ? COLORS.red : COLORS.text,
          font: 'display',
          origin: [0.5, 0],
        }).setDepth(32).setAlpha(0);
        this.tweens.add({ targets: text, alpha: 1, duration: 120 });
      });
    });

    addScanlines(this, 0, 0, 1280, 800, 0.5, 40);
    this.add.rectangle(0, 0, 1280, 800, 0xd8503f, 0.1).setOrigin(0).setDepth(35);

    manager.audio?.stopAlarm?.();
    manager.audio?.scream?.();
    manager.audio?.heartbeat?.();
    this.time.addEvent({
      delay: 520,
      repeat: 5,
      callback: () => manager.audio?.heartbeat?.(),
    });

    this.time.delayedCall(1300, () => {
      if (!this.scene.isActive()) return;
      new Button(this, 1030, 726, 220, 44, 'ПРОДОЛЖИТЬ', {
        variant: 'danger',
        size: 8,
        onClick: () => this.complete(),
      }).setDepth(50);
    });

    this.time.delayedCall(3600, () => this.complete());
  }

  update(time) {
    if (!this.noise) return;
    this.noise.tilePositionX = (time / 4) % 96;
    this.noise.tilePositionY = (time / 7) % 96;
    this.noise.setAlpha(0.18 + Math.random() * 0.2);
    if (this.monster && !this.finished) {
      this.monster.x = 640 + (Math.random() * 26 - 13);
      this.monster.y = 780 + (Math.random() * 8 - 4);
    }
  }

  complete() {
    if (this.finished) return;
    this.finished = true;
    manager.audio?.stopAlarm?.();
    // Без fadeOut: после крика сразу переходим к отчёту, чтобы не оставалось
    // чёрного кадра, если событие завершения анимации потеряется.
    const report = manager.completeEscape();
    if (report) this.scene.start('Report');
    else this.scene.start('Menu');
  }
}
