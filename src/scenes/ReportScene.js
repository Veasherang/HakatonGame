/**
 * Отчёт по завершённой смене.
 */
import { game as manager } from '../managers/GameManager.js';
import { NOTES } from '../data/plot.js';
import { addCoverImage, addCrt, addDarkness } from '../ui/backdrop.js';
import { COLORS, drawBar, drawPanel, makeText } from '../ui/theme.js';
import { Button } from '../ui/widgets.js';
import { formatMoney } from '../utils/format.js';

const OUTCOME_LABEL = {
  critical: 'СВЕРХ ПЛАНА',
  success: 'УСПЕХ',
  partial: 'ЧАСТИЧНО',
  fail: 'ПРОВАЛ',
  incident: 'ПОТЕРЯ СВЯЗИ',
};

const OUTCOME_COLOR = {
  critical: COLORS.green,
  success: COLORS.green,
  partial: COLORS.amber,
  fail: COLORS.red,
  incident: COLORS.red,
};

export class ReportScene extends Phaser.Scene {
  constructor() {
    super('Report');
  }

  create() {
    this.state = manager.state;
    this.report = this.state?.report;

    if (!this.state || !this.report) {
      this.scene.start('Menu');
      return;
    }

    addCoverImage(this, 'office_bg', 1280, 800, { tint: 0x39494d, alpha: 1 });
    addDarkness(this, 1280, 800, 0.62, -15);
    addCrt(this, 1280, 800, { scanAlpha: 0.22, vignetteAlpha: 0.72 });

    const panel = this.add.graphics();
    drawPanel(panel, 90, 38, 1100, 724, {
      fill: 0x070d0f,
      stroke: COLORS.amber,
      alpha: 0.97,
      cornerColor: COLORS.amber,
      cornerSize: 18,
    });
    panel.fillStyle(COLORS.amber, 0.06);
    panel.fillRect(92, 40, 1096, 56);
    panel.lineStyle(1, COLORS.amber, 0.5);
    panel.lineBetween(112, 96, 1168, 96);

    makeText(this, 116, 52, 'ОТЧЁТ ПО СМЕНЕ', {
      size: 16,
      color: COLORS.amber,
      font: 'display',
    });
    makeText(this, 1164, 54, `ДЕНЬ ${String(this.report.day).padStart(2, '0')} · СМЕНА ${String(this.report.shift).padStart(2, '0')}`, {
      size: 10,
      color: COLORS.dim,
      font: 'display',
      origin: [1, 0],
    });
    makeText(this, 116, 72, this.report.reasonText, {
      size: 13,
      color: this.report.reason === 'escape' ? COLORS.red : COLORS.dim,
      font: 'body',
    });

    this.buildFinance();
    this.buildContracts();
    this.buildIncidents();
    this.buildCreatures();
    this.buildSummary();
    this.buildButtons();

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  buildFinance() {
    const report = this.report;
    const contractsIncome = report.contracts.reduce((sum, item) => sum + (item.payout || 0), 0);
    const other = Math.max(0, report.earned - report.salary - contractsIncome);
    const rows = [
      ['ЖАЛОВАНИЕ', report.salary, COLORS.green],
      ['КОНТРАКТЫ', contractsIncome, COLORS.green],
      ['ПРОЧИЕ ПОСТУПЛЕНИЯ', other, COLORS.cyan],
      ['РАСХОДЫ', -report.spent, COLORS.amber],
      ['ШТРАФЫ И ПОТЕРИ', -report.penalties, COLORS.red],
    ];

    makeText(this, 116, 116, 'ФИНАНСЫ', { size: 9, color: COLORS.dim, font: 'display' });

    rows.forEach(([label, value, color], index) => {
      const y = 142 + index * 27;
      makeText(this, 116, y, label, { size: 13, color: COLORS.text, font: 'body' });
      makeText(this, 620, y, `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(value))} ₽`, {
        size: 12,
        color,
        font: 'display',
        origin: [1, 0],
      });
    });

    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.line, 0.7);
    divider.lineBetween(116, 286, 620, 286);

    makeText(this, 116, 300, 'ИТОГО ЗА СМЕНУ', { size: 10, color: COLORS.text, font: 'display' });
    makeText(this, 620, 296, `${report.net >= 0 ? '+' : '−'}${formatMoney(Math.abs(report.net))} ₽`, {
      size: 14,
      color: report.net >= 0 ? COLORS.green : COLORS.red,
      font: 'display',
      origin: [1, 0],
    });

    makeText(this, 116, 326, 'ТЕКУЩИЙ БАЛАНС', { size: 11, color: COLORS.text, font: 'body' });
    makeText(this, 620, 322, `${formatMoney(report.money)} ₽`, {
      size: 12,
      color: COLORS.amber,
      font: 'display',
      origin: [1, 0],
    });

    makeText(this, 116, 354, 'РЕПУТАЦИЯ ОФИСА', { size: 11, color: COLORS.text, font: 'body' });
    const repDelta = Math.round(report.repAfter - report.repBefore);
    makeText(
      this,
      620,
      350,
      `${report.repBefore} → ${report.repAfter} (${repDelta >= 0 ? '+' : ''}${repDelta})`,
      {
        size: 11,
        color: repDelta >= 0 ? COLORS.green : COLORS.red,
        font: 'display',
        origin: [1, 0],
      }
    );
  }

  buildContracts() {
    makeText(this, 116, 386, 'КОНТРАКТЫ', { size: 8, color: COLORS.dim, font: 'display' });
    const contracts = this.report.contracts || [];
    if (!contracts.length) {
      makeText(this, 116, 410, 'Контрактов не было. Смена прошла без внешних заказов.', {
        size: 12,
        color: COLORS.dimmer,
        font: 'body',
        wrap: 500,
      });
      return;
    }
    contracts.slice(0, 4).forEach((contract, index) => {
      const y = 410 + index * 46;
      makeText(this, 116, y, `${contract.name} · ${contract.company}`, {
        size: 12,
        color: COLORS.text,
        font: 'body',
      });
      makeText(this, 116, y + 20, contract.title, {
        size: 11,
        color: COLORS.dimmer,
        font: 'body',
      });
      makeText(this, 620, y + 2, OUTCOME_LABEL[contract.outcome] || contract.outcome, {
        size: 8,
        color: OUTCOME_COLOR[contract.outcome] || COLORS.dim,
        font: 'display',
        origin: [1, 0],
      });
      makeText(this, 620, y + 20, `${formatMoney(contract.payout || 0)} ₽`, {
        size: 10,
        color: COLORS.amber,
        font: 'display',
        origin: [1, 0],
      });
    });
  }

  buildIncidents() {
    const contracts = Math.min(4, (this.report.contracts || []).length);
    const startY = Math.max(462, 410 + contracts * 46 + 24);
    makeText(this, 116, startY, 'ПРОИСШЕСТВИЯ', { size: 9, color: COLORS.red, font: 'display' });
    const incidents = this.report.incidents || [];
    if (!incidents.length) {
      makeText(this, 116, startY + 24, 'Без происшествий. Система стабильна.', {
        size: 13,
        color: COLORS.dim,
        font: 'body',
      });
      return;
    }
    incidents.slice(0, 3).forEach((incident, index) => {
      makeText(this, 116, startY + 24 + index * 24, `· ${incident.text}`, {
        size: 13,
        color: incident.type === 'escape' ? COLORS.red : COLORS.amber,
        font: 'body',
        wrap: 500,
      });
    });
  }

  buildCreatures() {
    makeText(this, 690, 116, 'СОСТОЯНИЕ СУБЪЕКТОВ', {
      size: 8,
      color: COLORS.dim,
      font: 'display',
    });

    this.report.creatureStates.forEach((creature, index) => {
      const y = 146 + index * 92;
      const g = this.add.graphics();
      drawPanel(g, 686, y - 6, 480, 82, {
        fill: 0x0a1214,
        stroke: creature.status === 'escaped' ? COLORS.red : COLORS.line,
        alpha: 0.9,
        inner: false,
        cornerSize: 4,
      });
      makeText(this, 698, y, `СЕКТОР ${creature.slot} · ${creature.name}`, {
        size: 8,
        color: COLORS.text,
        font: 'display',
      });
      makeText(this, 1154, y, creature.status === 'escaped' ? 'ПОБЕГ' : creature.status === 'contract' ? 'КОНТРАКТ' : 'В КЛЕТКЕ', {
        size: 7,
        color: creature.status === 'escaped' ? COLORS.red : COLORS.dim,
        font: 'display',
        origin: [1, 0],
      });
      makeText(this, 698, y + 20, `УР.${creature.level} · СТАДИЯ ${creature.stage} · ЗДОРОВЬЕ ${creature.health} · СТРЕСС ${creature.stress} · КЛЕТКА ${creature.integrity}`, {
        size: 11,
        color: COLORS.dim,
        font: 'body',
        wrap: 450,
      });

      const barY = y + 44;
      const barW = 140;
      const barG = this.add.graphics();
      drawBar(barG, 698, barY, barW, 5, creature.health, creature.health < 40 ? COLORS.red : COLORS.green, { ticks: false });
      drawBar(barG, 850, barY, barW, 5, creature.stress, creature.stress > 65 ? COLORS.red : COLORS.cyan, { ticks: false });
      drawBar(barG, 1002, barY, barW, 5, creature.integrity, creature.integrity < 40 ? COLORS.red : COLORS.amber, { ticks: false });
      makeText(this, 698, barY + 8, 'ЗДОР', { size: 10, color: COLORS.dim, font: 'body' });
      makeText(this, 850, barY + 8, 'СТРЕСС', { size: 10, color: COLORS.dim, font: 'body' });
      makeText(this, 1002, barY + 8, 'КЛЕТКА', { size: 9, color: COLORS.dimmer, font: 'body' });
    });
  }

  buildSummary() {
    const notes = this.report.notes || [];
    const noteTitles = notes
      .map((id) => NOTES.find((note) => note.id === id)?.title)
      .filter(Boolean);

    makeText(this, 690, 530, 'БИОМАССА', { size: 8, color: COLORS.green, font: 'display' });
    makeText(this, 1154, 528, `+${this.report.biomass}`, {
      size: 12,
      color: COLORS.green,
      font: 'display',
      origin: [1, 0],
    });
    makeText(this, 690, 550, `ПРОИЗВОДСТВО ${this.report.production} · КОНТРАКТЫ ${Math.round((this.report.biomass - this.report.production) * 10) / 10}`, {
      size: 10,
      color: COLORS.dimmer,
      font: 'body',
    });

    makeText(this, 690, 578, 'НОВЫЕ ЗАПИСИ', { size: 8, color: COLORS.purple, font: 'display' });
    if (!noteTitles.length) {
      makeText(this, 690, 598, 'Новых записей нет.', {
        size: 11,
        color: COLORS.dimmer,
        font: 'body',
      });
    } else {
      makeText(this, 690, 598, noteTitles.map((title) => `· ${title}`).join('\n'), {
        size: 11,
        color: COLORS.purple,
        font: 'body',
        wrap: 470,
        lineSpacing: 2,
      });
    }

    if (this.state.ending?.final) {
      const box = this.add.graphics();
      drawPanel(box, 690, 626, 478, 48, {
        fill: 0x1e0c09,
        stroke: COLORS.red,
        alpha: 0.95,
        cornerColor: COLORS.red,
        cornerSize: 6,
      });
      makeText(this, 706, 634, 'КОНТРАКТ ИСТЁК · НАДЗОР ОЖИДАЕТ РЕШЕНИЯ', {
        size: 8,
        color: COLORS.red,
        font: 'display',
      });
      makeText(this, 706, 650, 'СЛЕДУЮЩАЯ СМЕНА БУДЕТ ПОСЛЕДНЕЙ.', {
        size: 10,
        color: COLORS.amber,
        font: 'body',
      });
    }
  }

  buildButtons() {
    const menuBtn = new Button(this, 116, 686, 180, 44, 'В МЕНЮ', {
      variant: 'ghost',
      size: 8,
      icon: 'back',
      onClick: () => {
        manager.save(true);
        this.scene.start('Menu');
      },
    });

    if (this.state.ending?.final) {
      new Button(this, 936, 686, 240, 44, 'ПОСЛЕДНЯЯ СМЕНА', {
        variant: 'danger',
        size: 9,
        icon: 'skull',
        onClick: () => {
          manager.save(true);
          this.scene.start('Ending');
        },
      });
    } else {
      new Button(this, 916, 686, 260, 44, 'СЛЕДУЮЩАЯ СМЕНА', {
        variant: 'primary',
        size: 9,
        icon: 'contract',
        onClick: () => {
          const ok = manager.nextShift();
          if (ok) this.scene.start('Office');
        },
      });
    }
  }
}
