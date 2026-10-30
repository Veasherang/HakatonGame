/**
 * Хоррор-сцена побега. Без графического насилия: только силуэт,
 * помехи, звук и короткие сообщения.
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
    addCoverImage(this, 'room_bg', 1280, 800, { tint: 0x3a1c18, alpha: 0.18 });

    this.noise = this.add
      .tileSprite(0, 0, 1280, 800, 'noise0')
      .setOrigin(0)
      .setAlpha(0.1)
      .setDepth(30);

    const texture = `${defId}_${stage}`;
    const key = this.textures.exists(texture) ? texture : `${defId}_1`;
    this.monster = this.add.image(640, 810, key).setOrigin(0.5, 1).setDepth(10);
    const frame = this.monster.frame;
    const baseScale = Math.min(460 / frame.realHeight, 780 / frame.realWidth);
    this.monster.setScale(baseScale * 0.55);
    this.monster.setAlpha(0.08);
    this.tweens.add({
      targets: this.monster,
      scaleX: baseScale * 1.7,
      scaleY: baseScale * 1.7,
      alpha: 0.92,
      duration: 6000,
      ease: 'Sine.in',
    });

    this.add
      .text(640, 48, 'СМЕНА ПРЕРВАНА', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '16px',
        color: '#d8503f',
      })
      .setOrigin(0.5, 0)
      .setDepth(31)
      .setAlpha(0.9);

    const lines = [
      HORROR_LINES[0],
      `${name} УЖЕ ЗДЕСЬ.`,
      HORROR_LINES[2],
      'НЕ ОБОРАЧИВАЙСЯ.',
    ];
    lines.forEach((line, index) => {
      this.time.delayedCall(500 + index * 1350, () => {
        if (!this.scene.isActive()) return;
        const text = makeText(this, 640, 120 + index * 54, line, {
          size: 13,
          color: index % 2 === 0 ? COLORS.red : COLORS.text,
          font: 'display',
          origin: [0.5, 0],
        }).setDepth(32).setAlpha(0);
        this.tweens.add({ targets: text, alpha: 1, duration: 420 });
        manager.audio?.heartbeat?.();
      });
    });

    addScanlines(this, 0, 0, 1280, 800, 0.45, 40);
    this.add
      .rectangle(0, 0, 1280, 800, 0xd8503f, 0.04)
      .setOrigin(0)
      .setDepth(35);

    manager.audio?.stopAlarm?.();
    manager.audio?.escape?.();
    this.cameras.main.shake(6000, 0.0022);

    this.time.addEvent({
      delay: 1050,
      repeat: 4,
      callback: () => manager.audio?.heartbeat?.(),
    });

    this.time.delayedCall(2400, () => {
      if (!this.scene.isActive()) return;
      new Button(this, 1030, 730, 220, 42, 'ПРОДОЛЖИТЬ', {
        variant: 'danger',
        size: 8,
        onClick: () => this.complete(),
      }).setDepth(50);
    });

    this.time.delayedCall(6400, () => this.complete());
  }

  update(time) {
    if (!this.noise) return;
    this.noise.tilePositionX = (time / 12) % 96;
    this.noise.tilePositionY = (time / 20) % 96;
    this.noise.setAlpha(0.06 + Math.random() * 0.1);
    if (this.monster && !this.finished) {
      this.monster.x = 640 + (Math.random() * 10 - 5);
    }
  }

  complete() {
    if (this.finished) return;
    this.finished = true;
    manager.audio?.stopAlarm?.();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const report = manager.completeEscape();
      if (report) this.scene.start('Report');
      else this.scene.start('Menu');
    });
  }
}
