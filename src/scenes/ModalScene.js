/**
 * Универсальное модальное окно: записки, подтверждения, архив.
 */
import { game as manager } from '../managers/GameManager.js';
import { COLORS, addScanlines, drawPanel, makeText } from '../ui/theme.js';
import { Button } from '../ui/widgets.js';

export class ModalScene extends Phaser.Scene {
  constructor() {
    super('Modal');
  }

  init(data) {
    this.modalData = data || {};
  }

  create() {
    const data = this.modalData;
    const width = data.width || 760;
    const height = data.height || 520;
    const x = (1280 - width) / 2;
    const y = (800 - height) / 2;
    const accent = data.accent || COLORS.amber;
    const pause = data.pause !== false;

    this.pauseManager = pause;
    if (pause) manager.setPaused(true);

    this.dim = this.add
      .rectangle(0, 0, 1280, 800, 0x020506, 0.72)
      .setOrigin(0)
      .setInteractive();

    const g = this.add.graphics();
    drawPanel(g, x, y, width, height, {
      fill: 0x070d0f,
      stroke: accent,
      alpha: 0.98,
      cornerColor: accent,
      cornerSize: 16,
    });
    g.fillStyle(accent, 0.08);
    g.fillRect(x + 2, y + 2, width - 4, 44);
    g.lineStyle(1, accent, 0.5);
    g.lineBetween(x + 16, y + 46, x + width - 16, y + 46);

    makeText(this, x + 22, y + 14, data.title || 'СИСТЕМА', {
      size: 11,
      color: accent,
      font: 'display',
    });

    if (data.code) {
      makeText(this, x + width - 70, y + 16, data.code, {
        size: 8,
        color: COLORS.dimmer,
        font: 'display',
        origin: [1, 0],
      });
    }

    const closeBtn = new Button(this, x + width - 46, y + 10, 32, 26, 'X', {
      variant: 'ghost',
      size: 8,
      onClick: () => this.close(),
    });
    closeBtn.setDepth(5);

    const bodyWidth = width - 80;
    this.bodyText = makeText(this, x + 40, y + 72, '', {
      size: data.bodySize || 17,
      color: COLORS.text,
      font: 'body',
      wrap: bodyWidth,
      lineSpacing: data.lineSpacing ?? 6,
    });

    const fullBody = data.body || '';
    this.fullBody = fullBody;
    this.revealed = 0;
    this.typewriterDone = false;

    if (data.typewriter === false) {
      this.bodyText.setText(fullBody);
      this.typewriterDone = true;
    } else {
      this.typeEvent = this.time.addEvent({
        delay: 12,
        loop: true,
        callback: () => this.stepTypewriter(),
      });
    }

    this.input.on('pointerdown', (pointer, targets) => {
      if (!this.typewriterDone) this.finishTypewriter();
    });

    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!this.typewriterDone) this.finishTypewriter();
    });

    const buttons = data.buttons?.length
      ? data.buttons
      : [{ label: 'ЗАКРЫТЬ', variant: 'ghost' }];

    const buttonWidth = Math.min(260, (width - 80 - (buttons.length - 1) * 14) / buttons.length);
    const total = buttons.length * buttonWidth + (buttons.length - 1) * 14;
    let bx = x + (width - total) / 2;
    const by = y + height - 74;

    buttons.forEach((item) => {
      const button = new Button(this, bx, by, buttonWidth, 46, item.label, {
        variant: item.variant || 'ghost',
        size: item.size || 9,
        icon: item.icon,
        onClick: () => {
          if (item.onClick) item.onClick();
          if (item.keepOpen !== true) this.close();
        },
      });
      if (item.disabled) button.setEnabled(false);
      bx += buttonWidth + 14;
    });

    addScanlines(this, x, y, width, height, 0.12, 30);

    this.cameras.main.fadeIn(160, 0, 0, 0);
    this.events.once('shutdown', () => {
      if (this.pauseManager) manager.setPaused(false);
      this.modalData?.onClose?.();
    });
  }

  stepTypewriter() {
    if (this.typewriterDone) return;
    this.revealed = Math.min(this.fullBody.length, this.revealed + 2);
    this.bodyText.setText(this.fullBody.slice(0, this.revealed));
    if (this.revealed >= this.fullBody.length) this.finishTypewriter();
  }

  finishTypewriter() {
    if (this.typewriterDone) return;
    this.typewriterDone = true;
    this.typeEvent?.remove();
    this.bodyText.setText(this.fullBody);
  }

  close() {
    if (!this.scene.isActive()) return;
    this.scene.stop();
  }
}
