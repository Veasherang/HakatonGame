/**
 * Вступительный экран: трудовой договор и подпись оператора.
 */
import { game as manager } from '../managers/GameManager.js';
import { INTRO_TEXT } from '../data/plot.js';
import { addCoverImage, addCrt, addDarkness } from '../ui/backdrop.js';
import { COLORS, drawPanel, makeText } from '../ui/theme.js';
import { Button } from '../ui/widgets.js';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    addCoverImage(this, 'office_bg', 1280, 800, { tint: 0x4c5c60, alpha: 0.9 });
    addDarkness(this, 1280, 800, 0.55, -15);
    addCrt(this, 1280, 800, { scanAlpha: 0.22, vignetteAlpha: 0.7 });

    const x = 190;
    const y = 90;
    const w = 900;
    const h = 620;
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h, {
      fill: 0x070d0f,
      stroke: COLORS.amber,
      alpha: 0.97,
      cornerColor: COLORS.amber,
      cornerSize: 18,
    });
    g.fillStyle(COLORS.amber, 0.07);
    g.fillRect(x + 2, y + 2, w - 4, 52);
    g.lineStyle(1, COLORS.amber, 0.55);
    g.lineBetween(x + 20, y + 54, x + w - 20, y + 54);

    makeText(this, x + 24, y + 16, 'ТРУДОВОЙ ДОГОВОР № 67-А', {
      size: 12,
      color: COLORS.amber,
      font: 'display',
    });
    makeText(this, x + w - 24, y + 18, 'КОНФИДЕНЦИАЛЬНО', {
      size: 8,
      color: COLORS.red,
      font: 'display',
      origin: [1, 0],
    });

    this.body = makeText(this, x + 36, y + 78, '', {
      size: 16,
      color: COLORS.text,
      font: 'body',
      wrap: w - 72,
      lineSpacing: 7,
    });

    this.fullText = INTRO_TEXT;
    this.revealed = 0;
    this.done = false;

    this.typeEvent = this.time.addEvent({
      delay: 9,
      loop: true,
      callback: () => this.step(),
    });

    this.signBtn = new Button(this, x + w / 2 - 170, y + h - 82, 340, 50, 'ПОДПИСАТЬ', {
      variant: 'primary',
      size: 11,
      icon: 'contract',
      sub: 'НАЧАТЬ СМЕНУ',
      onClick: () => this.startGame(),
    });
    this.signBtn.setEnabled(false);

    this.skipBtn = new Button(this, x + w - 132, y + h - 40, 104, 26, 'ПРОПУСТИТЬ', {
      variant: 'ghost',
      size: 7,
      onClick: () => this.complete(),
    });

    makeText(this, 640, 758, 'НАЖМИТЕ В ЛЮБОМ МЕСТЕ, ЧТОБЫ ПРОПУСТИТЬ ПЕЧАТЬ', {
      size: 7,
      color: COLORS.dimmer,
      font: 'display',
      origin: [0.5, 0],
    });

    this.input.on('pointerdown', () => {
      if (!this.done) this.complete();
    });

    // Надёжный запуск после подписания: работает даже если клик пришёлся мимо кнопки.
    this.input.on('pointerup', () => {
      if (this.done) this.startGame();
    });

    const advance = () => {
      if (!this.done) this.complete();
      else this.startGame();
    };
    this.input.keyboard?.on('keydown-ENTER', advance);
    this.input.keyboard?.on('keydown-SPACE', advance);

    this.tweens.add({
      targets: this.signBtn,
      alpha: 0.85,
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });
  }

  step() {
    if (this.done) return;
    this.revealed = Math.min(this.fullText.length, this.revealed + 3);
    this.body.setText(this.fullText.slice(0, this.revealed));
    if (this.revealed >= this.fullText.length) this.complete();
  }

  complete() {
    if (this.done) return;
    this.done = true;
    this.typeEvent?.remove();
    this.body.setText(this.fullText);
    this.signBtn.setEnabled(true);
    this.signBtn.setAlpha(1);
    this.tweens.killTweensOf(this.signBtn);
    this.skipBtn.setVisible(false);
  }

  startGame() {
    manager.audio?.confirm?.();
    manager.addLog('ТРУДОВОЙ ДОГОВОР ПОДПИСАН. СМЕНА НАЧАЛАСЬ.', 'sys');
    manager.addLog('ОПЕРАТОР: НАЗНАЧЕН. ПРЕДЫДУЩИЙ ОПЕРАТОР: НЕ НАЙДЕН.', 'plot');
    manager.save(true);
    this.scene.start('Guide', { from: 'Office', firstRun: true });
  }
}
