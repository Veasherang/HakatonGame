/**
 * Финальные развилки и концовки.
 */
import { game as manager } from '../managers/GameManager.js';
import { ENDINGS } from '../data/plot.js';
import { buildChoices, averageLoyalty } from '../systems/plot.js';
import { addCoverImage, addCrt, addDarkness } from '../ui/backdrop.js';
import { COLORS, drawPanel, makeText } from '../ui/theme.js';
import { Button } from '../ui/widgets.js';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create() {
    this.state = manager.state;
    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    if (this.state.phase === 'ended' && this.state.endingResult) {
      this.showEnding(this.state.endingResult);
      return;
    }

    if (this.state.ending?.forced) {
      this.showForced();
      return;
    }

    this.showChoices();
  }

  resetScene() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.cameras.main.resetFX();
  }

  baseBackdrop(tint = 0x2e3c40, darkness = 0.62) {
    addCoverImage(this, 'room_bg', 1280, 800, { tint, alpha: 0.55 });
    addDarkness(this, 1280, 800, darkness, -15);
    addCrt(this, 1280, 800, { scanAlpha: 0.2, vignetteAlpha: 0.75 });
  }

  showChoices() {
    this.baseBackdrop(0x3a3430, 0.6);

    const panel = this.add.graphics();
    drawPanel(panel, 100, 46, 1080, 708, {
      fill: 0x070d0f,
      stroke: COLORS.amber,
      alpha: 0.96,
      cornerColor: COLORS.amber,
      cornerSize: 18,
    });
    panel.fillStyle(COLORS.amber, 0.06);
    panel.fillRect(102, 48, 1076, 52);
    panel.lineStyle(1, COLORS.amber, 0.45);
    panel.lineBetween(120, 100, 1160, 100);

    makeText(this, 122, 60, 'КОНЕЦ КОНТРАКТА', {
      size: 15,
      color: COLORS.amber,
      font: 'display',
    });
    makeText(this, 1158, 62, `ДЕНЬ ${this.state.day} · РЕШЕНИЕ ОПЕРАТОРА`, {
      size: 9,
      color: COLORS.dim,
      font: 'display',
      origin: [1, 0],
    });
    makeText(
      this,
      122,
      112,
      this.state.ending?.reason || 'Контракт истёк. НАДЗОР ожидает решения.',
      { size: 14, color: COLORS.text, font: 'body', wrap: 1000 }
    );

    const notes = this.state.plot.notes.length;
    const loyalty = Math.round(averageLoyalty(this.state));
    const evidence = this.state.plot.evidence;
    makeText(
      this,
      122,
      138,
      `ЛОЯЛЬНОСТЬ СУБЪЕКТОВ: ${loyalty}  ·  ЗАПИСОК: ${notes}/8  ·  ДОКАЗАТЕЛЬСТВ: ${evidence}  ·  ПОБЕГОВ: ${this.state.stats.escapes}`,
      { size: 11, color: COLORS.dimmer, font: 'body', wrap: 1000 }
    );

    const choices = this.state.ending?.choices?.length
      ? this.state.ending.choices
      : buildChoices(this.state);

    choices.forEach((choice, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 130 + col * 510;
      const y = 186 + row * 248;
      const color = choice.enabled ? COLORS.amber : COLORS.line;

      const g = this.add.graphics();
      drawPanel(g, x, y, 480, 224, {
        fill: choice.enabled ? 0x0d1618 : 0x080e10,
        stroke: color,
        alpha: 0.97,
        cornerSize: 10,
      });
      g.fillStyle(choice.enabled ? COLORS.amber : COLORS.dimmer, 0.9);
      g.fillRect(x, y, 4, 224);

      makeText(this, x + 20, y + 16, choice.label, {
        size: 10,
        color: choice.enabled ? COLORS.text : COLORS.dimmer,
        font: 'display',
        wrap: 430,
      });
      makeText(this, x + 20, y + 50, choice.desc, {
        size: 13,
        color: choice.enabled ? COLORS.dim : COLORS.dimmer,
        font: 'body',
        wrap: 430,
        lineSpacing: 3,
      });
      makeText(this, x + 20, y + 128, choice.hint, {
        size: 11,
        color: choice.enabled ? COLORS.cyan : COLORS.dimmer,
        font: 'body',
        wrap: 430,
        lineSpacing: 2,
      });

      const button = new Button(this, x + 20, y + 174, 200, 36, choice.enabled ? 'ВЫБРАТЬ' : 'НЕДОСТУПНО', {
        variant: choice.enabled ? 'primary' : 'ghost',
        size: 8,
        enabled: choice.enabled,
        onClick: () => {
          const result = manager.finishEnding(choice.id);
          if (result) {
            manager.audio?.confirm?.();
            this.scene.restart();
          }
        },
      });
    });

    new Button(this, 930, 700, 220, 36, 'В МЕНЮ', {
      variant: 'ghost',
      size: 8,
      icon: 'back',
      onClick: () => {
        manager.save(true);
        this.scene.start('Menu');
      },
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      manager.save(true);
      this.scene.start('Menu');
    });

    this.cameras.main.fadeIn(260, 0, 0, 0);
  }

  showForced() {
    this.baseBackdrop(0x3a1a16, 0.7);
    const panel = this.add.graphics();
    drawPanel(panel, 300, 210, 680, 380, {
      fill: 0x0d0707,
      stroke: COLORS.red,
      alpha: 0.98,
      cornerColor: COLORS.red,
      cornerSize: 16,
    });

    makeText(this, 640, 240, 'ЗАМЕНА ОПЕРАТОРА', {
      size: 16,
      color: COLORS.red,
      font: 'display',
      origin: [0.5, 0],
    });
    makeText(this, 640, 300, this.state.ending?.reason || 'НАДЗОР инициировал замену.', {
      size: 16,
      color: COLORS.text,
      font: 'body',
      align: 'center',
      wrap: 580,
      origin: [0.5, 0],
      lineSpacing: 6,
    });
    makeText(this, 640, 400, 'ТЫ БОЛЬШЕ НЕ ОПЕРАТОР.', {
      size: 12,
      color: COLORS.amber,
      font: 'display',
      origin: [0.5, 0],
    });

    new Button(this, 490, 480, 300, 46, 'ПРИНЯТЬ', {
      variant: 'danger',
      size: 9,
      onClick: () => {
        manager.finishEnding('servant');
        this.scene.restart();
      },
    });

    this.cameras.main.fadeIn(260, 0, 0, 0);
  }

  showEnding(result) {
    this.resetScene();
    const toneColor =
      result.tone === 'bad' ? COLORS.red : result.tone === 'good' ? COLORS.green : COLORS.cyan;
    const tint = result.tone === 'bad' ? 0x3d1c18 : result.tone === 'good' ? 0x1d3428 : 0x22323a;

    this.baseBackdrop(tint, 0.72);

    const endingIds = Object.keys(ENDINGS);
    const number = Math.max(1, endingIds.indexOf(result.id) + 1);

    makeText(this, 640, 92, `КОНЦОВКА ${number}/${endingIds.length}`, {
      size: 9,
      color: COLORS.dimmer,
      font: 'display',
      origin: [0.5, 0],
    });
    makeText(this, 640, 128, result.title, {
      size: 24,
      color: toneColor,
      font: 'display',
      align: 'center',
      origin: [0.5, 0],
    });

    const line = this.add.graphics();
    line.fillStyle(toneColor, 0.7);
    line.fillRect(440, 176, 400, 2);

    this.bodyText = makeText(this, 640, 210, '', {
      size: 18,
      color: COLORS.text,
      font: 'body',
      align: 'center',
      wrap: 860,
      origin: [0.5, 0],
      lineSpacing: 8,
    });

    this.fullText = result.text;
    this.revealed = 0;
    this.done = false;
    this.typeEvent = this.time.addEvent({
      delay: 14,
      loop: true,
      callback: () => {
        this.revealed = Math.min(this.fullText.length, this.revealed + 2);
        this.bodyText.setText(this.fullText.slice(0, this.revealed));
        if (this.revealed >= this.fullText.length) {
          this.typeEvent.remove();
          this.done = true;
        }
      },
    });

    this.input.on('pointerdown', () => {
      if (!this.done) {
        this.done = true;
        this.typeEvent?.remove();
        this.bodyText.setText(this.fullText);
      }
    });

    new Button(this, 360, 690, 260, 46, 'В МЕНЮ', {
      variant: 'primary',
      size: 9,
      icon: 'back',
      onClick: () => {
        manager.save(true);
        this.scene.start('Menu');
      },
    });

    new Button(this, 650, 690, 280, 46, 'НОВАЯ ПАРТИЯ', {
      variant: 'ghost',
      size: 8,
      icon: 'contract',
      onClick: () => {
        manager.newGame();
        this.scene.start('Intro');
      },
    });

    makeText(this, 640, 756, `ДЕНЬ ${result.day} · ОТКРЫТО КОНЦОВОК: ${this.state.meta.unlockedEndings.length}/5`, {
      size: 8,
      color: COLORS.dimmer,
      font: 'display',
      origin: [0.5, 0],
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      manager.save(true);
      this.scene.start('Menu');
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }
}
