/**
 * Полноценное руководство оператора: разделы, навигация, быстрый старт.
 */
import { game as manager } from '../managers/GameManager.js';
import { GUIDE_PAGES } from '../data/guide.js';
import { addCoverImage, addDarkness } from '../ui/backdrop.js';
import {
  COLORS,
  addScanlines,
  drawPanel,
  makeText,
} from '../ui/theme.js';
import { Button } from '../ui/widgets.js';

const PANEL = { x: 28, y: 22, w: 1224, h: 756 };
const CONTENT = { x: 366, y: 112, w: 862 };
const TABS = { x: 52, y: 112, w: 286, h: 40, gap: 5 };

export class GuideScene extends Phaser.Scene {
  constructor() {
    super('Guide');
  }

  init(data) {
    this.from = data?.from || 'Menu';
    this.slot = data?.slot || 1;
    this.firstRun = Boolean(data?.firstRun);
    this.pageIndex = 0;
  }

  create() {
    this.state = manager.state;

    addCoverImage(this, 'office_bg', 1280, 800, { tint: 0x46585c, alpha: 1 });
    addDarkness(this, 1280, 800, 0.6, -15);

    const panel = this.add.graphics();
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h, {
      fill: 0x070d0f,
      stroke: COLORS.amber,
      alpha: 0.97,
      cornerColor: COLORS.amber,
      cornerSize: 18,
    });
    panel.fillStyle(COLORS.amber, 0.06);
    panel.fillRect(PANEL.x + 2, PANEL.y + 2, PANEL.w - 4, 54);
    panel.lineStyle(1, COLORS.amber, 0.45);
    panel.lineBetween(56, 82, 1224, 82);
    panel.lineStyle(1, COLORS.line, 0.9);
    panel.lineBetween(56, 96, 1224, 96);

    makeText(this, 56, 38, 'ИНСТРУКЦИЯ ОПЕРАТОРА', {
      size: 14,
      color: COLORS.text,
      font: 'display',
    });
    makeText(this, 56, 62, 'РУКОВОДСТВО ПО ВЫЖИВАНИЮ В БУНКЕРЕ АТД-67', {
      size: 11,
      color: COLORS.dim,
      font: 'display',
    });
    makeText(this, 1224, 46, 'АТД-67 // КАНАЛ ОБУЧЕНИЯ', {
      size: 7,
      color: COLORS.dimmer,
      font: 'display',
      origin: [1, 0],
    });

    this.backBtn = new Button(
      this,
      1024,
      38,
      196,
      40,
      this.firstRun ? 'НАЧАТЬ СМЕНУ' : 'ВЕРНУТЬСЯ',
      {
        variant: this.firstRun ? 'primary' : 'default',
        size: 8,
        onClick: () => this.goBack(),
      }
    );

    this.buildTabs();
    this.buildContent();
    this.buildFooter();

    this.showPage(0);

    this.input.keyboard?.on('keydown-ESC', () => this.goBack());
    this.input.keyboard?.on('keydown-LEFT', () => this.showPage(this.pageIndex - 1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.showPage(this.pageIndex + 1));

    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  buildTabs() {
    this.tabs = GUIDE_PAGES.map((page, index) => {
      const button = new Button(
        this,
        TABS.x,
        TABS.y + index * (TABS.h + TABS.gap),
        TABS.w,
        TABS.h,
        `${String(index + 1).padStart(2, '0')}   ${page.tab}`,
        {
          variant: 'ghost',
          size: 8,
          onClick: () => this.showPage(index),
        }
      );
      return button;
    });
  }

  buildContent() {
    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.line, 0.9);
    divider.lineBetween(CONTENT.x, 162, 1224, 162);

    this.pageTitle = makeText(this, CONTENT.x, CONTENT.y, '', {
      size: 14,
      color: COLORS.amber,
      font: 'display',
    });
    this.pageSubtitle = makeText(this, CONTENT.x, CONTENT.y + 28, '', {
      size: 14,
      color: COLORS.dim,
      font: 'body',
    });
    this.content = this.add.container(0, 0);
  }

  buildFooter() {
    this.pageLabel = makeText(this, CONTENT.x, 700, '', {
      size: 8,
      color: COLORS.dimmer,
      font: 'display',
    });

    this.prevBtn = new Button(this, 1004, 688, 92, 34, 'НАЗАД', {
      variant: 'ghost',
      size: 7,
      icon: 'back',
      onClick: () => this.showPage(this.pageIndex - 1),
    });
    this.nextBtn = new Button(this, 1104, 688, 120, 34, 'ДАЛЬШЕ', {
      variant: 'ghost',
      size: 7,
      onClick: () => this.showPage(this.pageIndex + 1),
    });

    makeText(this, 1224, 742, 'ESC — ВЫЙТИ · ← → — СТРАНИЦЫ', {
      size: 7,
      color: COLORS.dimmer,
      font: 'display',
      origin: [1, 0],
    });

    addScanlines(this, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0.08, 20);
  }

  showPage(index) {
    const clamped = Math.max(0, Math.min(GUIDE_PAGES.length - 1, index));
    this.pageIndex = clamped;
    const page = GUIDE_PAGES[clamped];

    this.tabs.forEach((tab, tabIndex) => {
      tab.setVariant(tabIndex === clamped ? 'amber' : 'ghost');
    });

    this.pageTitle.setText(page.title);
    this.pageSubtitle.setText(page.subtitle);
    this.content.removeAll(true);

    let y = 182;
    const x = CONTENT.x;
    const width = CONTENT.w;

    for (const block of page.blocks) {
      if (y > 700) break;

      if (block.type === 'lead') {
        const text = makeText(this, x, y, block.text, {
          size: 17,
          color: COLORS.text,
          font: 'body',
          wrap: width,
          lineSpacing: 4,
        });
        this.content.add(text);
        y += text.height + 12;
        continue;
      }

      if (block.type === 'h') {
        const text = makeText(this, x, y + 4, block.text, {
          size: 9,
          color: COLORS.amber,
          font: 'display',
        });
        this.content.add(text);
        y += text.height + 10;
        continue;
      }

      if (block.type === 'p') {
        const text = makeText(this, x, y, block.text, {
          size: 14,
          color: COLORS.dim,
          font: 'body',
          wrap: width,
          lineSpacing: 3,
        });
        this.content.add(text);
        y += text.height + 10;
        continue;
      }

      if (block.type === 'list') {
        for (const item of block.items) {
          const dot = makeText(this, x + 2, y, '•', {
            size: 16,
            color: COLORS.amber,
            font: 'body',
          });
          const text = makeText(this, x + 22, y, item, {
            size: 14,
            color: COLORS.text,
            font: 'body',
            wrap: width - 26,
            lineSpacing: 3,
          });
          this.content.add([dot, text]);
          y += Math.max(text.height, 20) + 7;
        }
        y += 4;
        continue;
      }

      if (block.type === 'steps') {
        block.items.forEach((item, index) => {
          const number = makeText(this, x, y + 1, String(index + 1).padStart(2, '0'), {
            size: 9,
            color: COLORS.amber,
            font: 'display',
          });
          const text = makeText(this, x + 34, y, item, {
            size: 14,
            color: COLORS.text,
            font: 'body',
            wrap: width - 40,
            lineSpacing: 3,
          });
          this.content.add([number, text]);
          y += Math.max(text.height, 20) + 8;
        });
        y += 4;
        continue;
      }

      if (block.type === 'kv') {
        for (const item of block.items) {
          const key = makeText(this, x, y + 2, item.k, {
            size: 8,
            color: COLORS.amber,
            font: 'display',
            wrap: 150,
          });
          const value = makeText(this, x + 168, y, item.v, {
            size: 14,
            color: COLORS.text,
            font: 'body',
            wrap: width - 172,
            lineSpacing: 3,
          });
          this.content.add([key, value]);
          y += Math.max(value.height, 20) + 7;
        }
        y += 4;
        continue;
      }

      if (block.type === 'tip' || block.type === 'note' || block.type === 'warn') {
        const palette =
          block.type === 'tip'
            ? { color: COLORS.green, label: 'СОВЕТ' }
            : block.type === 'warn'
              ? { color: COLORS.red, label: 'ВАЖНО' }
              : { color: COLORS.cyan, label: 'ПРИМЕЧАНИЕ' };

        const label = makeText(this, x, y + 1, palette.label, {
          size: 8,
          color: palette.color,
          font: 'display',
        });
        const text = makeText(this, x + 112, y, block.text, {
          size: 14,
          color: COLORS.text,
          font: 'body',
          wrap: width - 116,
          lineSpacing: 3,
        });
        const bar = this.add.graphics();
        bar.fillStyle(palette.color, 0.9);
        bar.fillRect(x - 12, y + 1, 3, Math.max(18, text.height - 2));
        this.content.add([bar, label, text]);
        y += text.height + 12;
      }
    }

    this.pageLabel.setText(
      `${String(clamped + 1).padStart(2, '0')} / ${String(GUIDE_PAGES.length).padStart(2, '0')}`
    );
    this.prevBtn.setEnabled(clamped > 0);
    this.nextBtn.setEnabled(clamped < GUIDE_PAGES.length - 1);
    this.pageTitle.setY(CONTENT.y);
    this.pageSubtitle.setY(CONTENT.y + 28);
  }

  goBack() {
    manager.audio?.ui?.();
    if (this.from === 'Room') {
      this.scene.start('Room', { slot: this.slot });
    } else if (this.from === 'Office') {
      this.scene.start('Office');
    } else {
      this.scene.start('Menu');
    }
  }
}
