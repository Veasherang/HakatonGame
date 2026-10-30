/**
 * Рынок контрактов: предложения компаний и назначение существ.
 */
import { game as manager } from '../managers/GameManager.js';
import { professionLabel } from '../data/companies.js';
import { addCoverImage, addCrt, addDarkness } from '../ui/backdrop.js';
import { COLORS, drawBar, drawPanel, makeText } from '../ui/theme.js';
import { Button, showToast } from '../ui/widgets.js';
import { formatMoney, formatTime } from '../utils/format.js';

export class MarketScene extends Phaser.Scene {
  constructor() {
    super('Market');
  }

  create() {
    this.state = manager.state;
    if (!this.state) {
      this.scene.start('Menu');
      return;
    }
    this.picker = null;

    addCoverImage(this, 'office_bg', 1280, 800, { tint: 0x44565b, alpha: 1 });
    addDarkness(this, 1280, 800, 0.55, -15);
    addCrt(this, 1280, 800, { scanAlpha: 0.2, vignetteAlpha: 0.7 });

    this.buildHeader();
    this.buildOffers();
    this.buildSidebar();

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.picker) this.closePicker();
      else this.goBack();
    });

    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  buildHeader() {
    this.backBtn = new Button(this, 24, 20, 120, 38, 'НАЗАД', {
      variant: 'ghost',
      size: 8,
      icon: 'back',
      onClick: () => this.goBack(),
    });

    makeText(this, 160, 14, 'РЫНОК КОНТРАКТОВ', {
      size: 14,
      color: COLORS.amber,
      font: 'display',
    });
    makeText(this, 160, 40, `КОРПОРАТИВНЫЕ ЗАКАЗЫ · ДЕНЬ ${this.state.day} · СМЕНА ${this.state.shift}`, {
      size: 12,
      color: COLORS.dim,
      font: 'body',
    });

    const money = makeText(this, 1256, 12, `${formatMoney(this.state.money)} ₽`, {
      size: 12,
      color: COLORS.amber,
      font: 'display',
      origin: [1, 0],
    });
    makeText(this, 1256, 36, 'ВРЕМЯ СМЕНЫ ПРИОСТАНОВЛЕНО', {
      size: 10,
      color: COLORS.dimmer,
      font: 'body',
      origin: [1, 0],
    });
    makeText(this, 1040, 14, 'БЮДЖЕТ', {
      size: 7,
      color: COLORS.dim,
      font: 'display',
      origin: [1, 0],
    }).setPosition(1150, 14);
    this.moneyText = money;
  }

  buildOffers() {
    const panel = this.add.graphics();
    drawPanel(panel, 16, 84, 860, 700, {
      fill: 0x070d0f,
      stroke: COLORS.line,
      alpha: 0.95,
      cornerColor: COLORS.lineBright,
      cornerSize: 12,
    });

    makeText(this, 32, 94, `ПРЕДЛОЖЕНИЯ КОМПАНИЙ · ${this.state.offers.length}`, {
      size: 9,
      color: COLORS.cyan,
      font: 'display',
    });

    if (!this.state.offers.length) {
      makeText(
        this,
        52,
        160,
        'НОВЫХ ПРЕДЛОЖЕНИЙ НЕТ.\n\nВсе контракты распределены. Вернитесь к камерам, дождитесь следующей смены или завершите смену.',
        { size: 15, color: COLORS.dim, font: 'body', wrap: 760, lineSpacing: 7 }
      );
      return;
    }

    this.state.offers.forEach((offer, index) => {
      const x = 28;
      const y = 116 + index * 162;
      const w = 836;
      const h = 150;
      const g = this.add.graphics();
      drawPanel(g, x, y, w, h, {
        fill: 0x0b1416,
        stroke: COLORS.line,
        alpha: 0.97,
        cornerSize: 8,
      });
      g.fillStyle(offer.color || COLORS.amber, 0.9);
      g.fillRect(x, y, 5, h);
      this.add
        .rectangle(x + 5, y, 1, h, offer.color || COLORS.amber, 0.25)
        .setOrigin(0);

      makeText(this, x + 18, y + 8, offer.companyName, {
        size: 9,
        color: COLORS.text,
        font: 'display',
      });
      makeText(this, x + 18, y + 26, offer.specialization, {
        size: 11,
        color: COLORS.dimmer,
        font: 'body',
      });
      makeText(this, x + 18, y + 44, offer.title, {
        size: 18,
        color: COLORS.text,
        font: 'body',
      });
      makeText(
        this,
        x + 18,
        y + 72,
        `${professionLabel[offer.profession] || offer.profession}  ·  РИСК ${'★'.repeat(offer.risk)}${'☆'.repeat(3 - offer.risk)}  ·  ${Math.round((offer.duration / 60) * 10) / 10} МИН`,
        { size: 11, color: COLORS.dim, font: 'body' }
      );

      const ready = manager.state.creatures.filter(
        (creature) =>
          creature.defId &&
          creature.status === 'idle' &&
          manager.readinessOf(creature.slot) >= offer.reqReadiness
      ).length;
      makeText(
        this,
        x + 18,
        y + 94,
        `ГОТОВНОСТЬ ${offer.reqReadiness}/100 · ПОДХОДЯЩИХ: ${ready}`,
        { size: 8, color: ready ? COLORS.green : COLORS.red, font: 'display' }
      );
      makeText(this, x + 18, y + 114, offer.flavor, {
        size: 11,
        color: COLORS.dimmer,
        font: 'body',
        wrap: 550,
      });

      makeText(this, x + w - 30, y + 10, `${formatMoney(offer.pay)} ₽`, {
        size: 16,
        color: COLORS.amber,
        font: 'display',
        origin: [1, 0],
      });

      const button = new Button(this, x + w - 250, y + h - 44, 220, 34, ready ? 'ВЫБРАТЬ ИСПОЛНИТЕЛЯ' : 'НЕТ ГОТОВЫХ', {
        variant: ready ? 'amber' : 'ghost',
        size: 7,
        enabled: ready > 0,
        onClick: () => this.openPicker(offer),
      });
    });
  }

  buildSidebar() {
    const panel = this.add.graphics();
    drawPanel(panel, 892, 84, 372, 700, {
      fill: 0x070d0f,
      stroke: COLORS.line,
      alpha: 0.95,
      cornerColor: COLORS.lineBright,
      cornerSize: 12,
    });

    makeText(this, 912, 96, 'СУБЪЕКТЫ В БУНКЕРЕ', {
      size: 8,
      color: COLORS.cyan,
      font: 'display',
    });

    this.state.creatures.forEach((creature, index) => {
      const y = 122 + index * 70;
      if (!creature.defId) {
        makeText(this, 912, y, `СЕКТОР 0${creature.slot} · ПУСТО`, {
          size: 10,
          color: COLORS.dimmer,
          font: 'display',
        });
        return;
      }
      const readiness = manager.readinessOf(creature.slot);
      const g = this.add.graphics();
      drawPanel(g, 908, y - 4, 340, 62, {
        fill: 0x0a1214,
        stroke: COLORS.line,
        alpha: 0.9,
        inner: false,
        cornerSize: 4,
      });
      makeText(this, 918, y + 2, creature.name, {
        size: 8,
        color: COLORS.text,
        font: 'display',
      });
      makeText(this, 918, y + 20, `СЕКТОР ${creature.slot} · УР.${creature.level} · СТАДИЯ ${creature.stage}`, {
        size: 10,
        color: COLORS.dimmer,
        font: 'body',
      });
      makeText(this, 1236, y + 2, `${readiness}`, {
        size: 10,
        color: readiness >= 60 ? COLORS.green : COLORS.amber,
        font: 'display',
        origin: [1, 0],
      });
      const bar = this.add.graphics();
      drawBar(bar, 918, y + 42, 316, 5, readiness, readiness >= 60 ? COLORS.green : COLORS.cyan, {
        ticks: false,
      });
      makeText(this, 918, y + 48, creature.status === 'contract' ? 'НА КОНТРАКТЕ' : creature.activity || '', {
        size: 9,
        color: creature.status === 'contract' ? COLORS.cyan : COLORS.dimmer,
        font: 'body',
      });
    });

    makeText(this, 912, 550, 'АКТИВНЫЕ КОНТРАКТЫ', {
      size: 8,
      color: COLORS.amber,
      font: 'display',
    });

    const active = this.state.creatures.filter((creature) => creature.status === 'contract' && creature.contract);
    if (!active.length) {
      makeText(this, 912, 574, 'НЕТ АКТИВНЫХ КОНТРАКТОВ', {
        size: 11,
        color: COLORS.dimmer,
        font: 'body',
      });
    } else {
      active.forEach((creature, index) => {
        const y = 574 + index * 48;
        const contract = creature.contract;
        makeText(this, 912, y, `${creature.name} → ${contract.companyName}`, {
          size: 10,
          color: COLORS.text,
          font: 'body',
        });
        makeText(this, 1248, y, formatTime(contract.endIn), {
          size: 9,
          color: COLORS.cyan,
          font: 'display',
          origin: [1, 0],
        });
        const barG = this.add.graphics();
        const ratio = 1 - contract.endIn / Math.max(1, contract.duration);
        drawBar(barG, 912, y + 20, 336, 5, ratio * 100, COLORS.cyan, { ticks: false });
      });
    }

    makeText(
      this,
      912,
      744,
      'КОНТРАКТ НЕЛЬЗЯ ОТМЕНИТЬ. ЕСЛИ СУЩЕСТВО НЕ ВЕРНЁТСЯ — ЭТО ПОСЛЕДСТВИЯ.',
      { size: 10, color: COLORS.dimmer, font: 'body', wrap: 336, lineSpacing: 2 }
    );
  }

  openPicker(offer) {
    if (this.picker) return;
    if (!this.state.offers.find((item) => item.id === offer.id)) {
      showToast(this, 'ПРЕДЛОЖЕНИЕ УСТАРЕЛО', { kind: 'danger', y: 740 });
      return;
    }

    const container = this.add.container(0, 0).setDepth(200);
    const dim = this.add
      .rectangle(0, 0, 1280, 800, 0x020506, 0.7)
      .setOrigin(0)
      .setInteractive();
    container.add(dim);

    const px = 230;
    const py = 150;
    const width = 820;
    const height = 500;
    const g = this.add.graphics();
    drawPanel(g, px, py, width, height, {
      fill: 0x070d0f,
      stroke: COLORS.amber,
      alpha: 0.98,
      cornerColor: COLORS.amber,
      cornerSize: 14,
    });
    g.fillStyle(COLORS.amber, 0.07);
    g.fillRect(px + 2, py + 2, width - 4, 48);
    container.add(g);

    container.add(
      makeText(this, px + 22, py + 15, 'НАЗНАЧЕНИЕ ИСПОЛНИТЕЛЯ', {
        size: 10,
        color: COLORS.amber,
        font: 'display',
      })
    );
    container.add(
      makeText(this, px + 22, py + 58, `${offer.companyName} · ${offer.title}`, {
        size: 14,
        color: COLORS.text,
        font: 'body',
      })
    );
    container.add(
      makeText(this, px + width - 22, py + 58, `ТРЕБУЕТСЯ ${offer.reqReadiness}/100`, {
        size: 10,
        color: COLORS.amber,
        font: 'body',
        origin: [1, 0],
      })
    );

    this.state.creatures
      .filter((creature) => creature.defId)
      .forEach((creature, index) => {
        const y = py + 96 + index * 86;
        const readiness = manager.readinessOf(creature.slot);
        const def = manager.def(creature.slot);
        const eligible = readiness >= offer.reqReadiness && creature.status === 'idle';
        const professionMatch = def?.professions.includes(offer.profession);

        const rowG = this.add.graphics();
        drawPanel(rowG, px + 22, y, width - 44, 74, {
          fill: eligible ? 0x0e1a1a : 0x0a1113,
          stroke: eligible ? COLORS.green : COLORS.line,
          alpha: 0.95,
          inner: false,
          cornerSize: 5,
        });
        container.add(rowG);

        container.add(
          makeText(this, px + 36, y + 8, def?.name || 'ПУСТО', {
            size: 9,
            color: eligible ? COLORS.text : COLORS.dim,
            font: 'display',
          })
        );
        container.add(
          makeText(
            this,
            px + 36,
            y + 28,
            `СЕКТОР ${creature.slot} · ${professionMatch ? 'ПРОФЕССИЯ ПОДХОДИТ' : 'ПРОФЕССИЯ НЕ СОВПАДАЕТ'} · ${creature.activity || ''}`,
            { size: 11, color: professionMatch ? COLORS.green : COLORS.dimmer, font: 'body' }
          )
        );
        container.add(
          makeText(this, px + 36, y + 48, `ГОТОВНОСТЬ ${readiness}/100`, {
            size: 8,
            color: readiness >= offer.reqReadiness ? COLORS.green : COLORS.red,
            font: 'display',
          })
        );

        const barG = this.add.graphics();
        drawBar(barG, px + 230, y + 48, 200, 5, readiness, readiness >= offer.reqReadiness ? COLORS.green : COLORS.red, { ticks: false });
        container.add(barG);

        const button = new Button(this, px + width - 220, y + 18, 184, 36, eligible ? 'НАЗНАЧИТЬ' : 'НЕДОСТУПЕН', {
          variant: eligible ? 'amber' : 'ghost',
          size: 7,
          enabled: eligible,
          onClick: () => this.assign(offer, creature.slot),
        });
        container.add(button);
      });

    const close = new Button(this, px + width - 46, py + 12, 30, 26, 'X', {
      variant: 'ghost',
      size: 8,
      onClick: () => this.closePicker(),
    });
    container.add(close);

    this.picker = container;
  }

  assign(offer, slot) {
    const result = manager.acceptOffer(offer.id, slot);
    if (result.ok) {
      manager.audio?.confirm?.();
      this.closePicker();
      showToast(this, 'КОНТРАКТ ПРИНЯТ. СУЩЕСТВО ОТПРАВЛЕНО НА ОБЪЕКТ.', {
        kind: 'good',
        y: 740,
      });
      this.time.delayedCall(280, () => this.scene.restart());
    } else {
      showToast(this, result.reason || 'НЕ УДАЛОСЬ НАЗНАЧИТЬ', { kind: 'danger', y: 740 });
      manager.audio?.error?.();
    }
  }

  closePicker() {
    if (!this.picker) return;
    this.picker.destroy(true);
    this.picker = null;
  }

  goBack() {
    manager.audio?.ui?.();
    this.cameras.main.fadeOut(140, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Office');
    });
  }
}
