/**
 * Питомник: покупка новых субъектов по мере открытия протоколов.
 */
import { game as manager } from '../managers/GameManager.js';
import { addCoverImage, addCrt, addDarkness } from '../ui/backdrop.js';
import { COLORS, drawPanel, makeText } from '../ui/theme.js';
import { Button, showToast } from '../ui/widgets.js';
import { formatMoney } from '../utils/format.js';

const CARD = { w: 286, h: 556, gap: 16, x: 34, y: 132 };

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    this.state = manager.state;
    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    addCoverImage(this, 'office_bg', 1280, 800, { tint: 0x44565b, alpha: 1 });
    addDarkness(this, 1280, 800, 0.58, -15);
    addCrt(this, 1280, 800, { scanAlpha: 0.18, vignetteAlpha: 0.6 });

    this.buildHeader();
    this.buildCards();

    this.input.keyboard?.on('keydown-ESC', () => this.goBack());
    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  buildHeader() {
    new Button(this, 24, 20, 120, 38, 'НАЗАД', {
      variant: 'ghost',
      size: 8,
      icon: 'back',
      onClick: () => this.goBack(),
    });

    makeText(this, 160, 12, 'ПИТОМНИК СУБЪЕКТОВ', {
      size: 15,
      color: COLORS.purple,
      font: 'display',
    });
    makeText(this, 160, 38, `ДЕНЬ ${this.state.day} · ПРОТОКОЛЫ ОТКРЫВАЮТСЯ ПОСТЕПЕННО`, {
      size: 12,
      color: COLORS.dim,
      font: 'body',
    });

    makeText(this, 1256, 12, `${formatMoney(this.state.money)} ₽`, {
      size: 14,
      color: COLORS.amber,
      font: 'display',
      origin: [1, 0],
    });
    makeText(this, 1256, 36, `БИОМАССА ${Math.round(this.state.biomass)}`, {
      size: 10,
      color: COLORS.green,
      font: 'display',
      origin: [1, 0],
    });
  }

  buildCards() {
    const shop = manager.shopState();
    shop.forEach((offer, index) => {
      const x = CARD.x + index * (CARD.w + CARD.gap);
      const y = CARD.y;
      const def = offer.def;
      const secretLocked = offer.secret && !offer.unlocked;
      const accent = offer.owned
        ? COLORS.green
        : secretLocked
          ? COLORS.red
          : offer.unlocked
            ? COLORS.purple
            : COLORS.line;

      const g = this.add.graphics();
      drawPanel(g, x, y, CARD.w, CARD.h, {
        fill: 0x0a1214,
        stroke: accent,
        alpha: 0.97,
        cornerSize: 8,
      });
      g.fillStyle(accent, 0.06);
      g.fillRect(x + 2, y + 2, CARD.w - 4, 62);

      makeText(this, x + 14, y + 10, offer.tag, {
        size: 8,
        color: accent,
        font: 'display',
      });
      makeText(this, x + 14, y + 32, secretLocked ? 'СУБЪЕКТ 07' : def.name, {
        size: 16,
        color: secretLocked ? COLORS.red : COLORS.text,
        font: 'display',
      });

      const textureKey = `${offer.id}_1_thumb`;
      if (this.textures.exists(textureKey)) {
        const image = this.add.image(x + CARD.w / 2, y + 292, textureKey).setOrigin(0.5, 1);
        const scale = Math.min(190 / image.height, 240 / image.width);
        image.setScale(scale);
        if (secretLocked) image.setTint(0x351d1d).setAlpha(0.55);
      }

      const species = secretLocked ? 'ИНФОРМАЦИЯ ЗАКРЫТА' : def.species;
      makeText(this, x + 14, y + 304, species, {
        size: 10,
        color: secretLocked ? COLORS.red : COLORS.dim,
        font: 'display',
        wrap: CARD.w - 28,
      });

      const blurb = secretLocked
        ? `Протокол откроется в день ${offer.unlockDay}. До этого сведения о субъекте недоступны.`
        : offer.blurb;
      makeText(this, x + 14, y + 332, blurb, {
        size: 12,
        color: COLORS.dim,
        font: 'body',
        wrap: CARD.w - 28,
        lineSpacing: 3,
      });

      if (!secretLocked) {
        makeText(
          this,
          x + 14,
          y + 396,
          `МОЖЕТ: ${(def.professionNames || []).join(' · ')}`,
          { size: 9, color: COLORS.cyan, font: 'display', wrap: CARD.w - 28 }
        );
      } else {
        makeText(this, x + 14, y + 396, 'ПРОФЕССИИ: СКРЫТЫ', {
          size: 9,
          color: COLORS.dimmer,
          font: 'display',
        });
      }

      if (offer.id === 'vodolazik' && !secretLocked) {
        makeText(this, x + 14, y + 420, 'ЭТО ЧЕЛОВЕК. ПОДОПЫТНЫМ МОЖЕТ СТАТЬ ЛЮБОЙ.', {
          size: 9,
          color: COLORS.red,
          font: 'display',
          wrap: CARD.w - 28,
        });
      }

      const price = offer.start
        ? 'В БУНКЕРЕ'
        : offer.owned
          ? 'КУПЛЕН'
          : `${formatMoney(offer.price)} ₽`;
      makeText(this, x + 14, y + 476, price, {
        size: 15,
        color: offer.owned ? COLORS.green : COLORS.amber,
        font: 'display',
      });

      let label = 'КУПИТЬ';
      let enabled = offer.unlocked && !offer.owned && offer.affordable;
      if (offer.start || offer.owned) {
        label = 'УЖЕ В БУНКЕРЕ';
        enabled = false;
      } else if (!offer.unlocked) {
        label = `ОТКРОЕТСЯ В ДЕНЬ ${offer.unlockDay}`;
        enabled = false;
      } else if (!offer.affordable) {
        label = 'НЕ ХВАТАЕТ ДЕНЕГ';
        enabled = false;
      }

      const button = new Button(this, x + 14, y + CARD.h - 50, CARD.w - 28, 36, label, {
        variant: enabled ? 'purple' : 'ghost',
        size: 7,
        enabled,
        onClick: () => this.confirmBuy(offer),
      });
      if (enabled) button.setVariant('purple');
    });
  }

  confirmBuy(offer) {
    const rest = this.state.money - offer.price;
    this.scene.launch('Modal', {
      title: 'ПОКУПКА СУБЪЕКТА',
      body:
        `${offer.def.name} будет принят в сектор ${offer.slot}.\n\n` +
        `ЦЕНА: ${formatMoney(offer.price)} ₽\n` +
        `БАЛАНС: ${formatMoney(this.state.money)} ₽\n` +
        `ОСТАНЕТСЯ: ${formatMoney(Math.max(0, rest))} ₽\n\n` +
        (offer.id === 'vodolazik'
          ? 'В документах указано: «МУТИРОВАВШИЙ ЧЕЛОВЕК». Это не животное.'
          : 'После покупки субъект появится в камере и сможет выполнять свои контракты.'),
      accent: offer.id === 'vodolazik' ? COLORS.red : COLORS.purple,
      typewriter: false,
      buttons: [
        {
          label: 'КУПИТЬ',
          variant: offer.id === 'vodolazik' ? 'danger' : 'purple',
          onClick: () => {
            const result = manager.buyCreature(offer.id);
            if (result.ok) {
              manager.audio?.buy?.();
              this.scene.restart();
            } else {
              showToast(this, result.reason || 'НЕ УДАЛОСЬ', { kind: 'danger', y: 740 });
            }
          },
        },
        { label: 'ОТМЕНА', variant: 'ghost' },
      ],
    });
  }

  goBack() {
    manager.audio?.ui?.();
    this.scene.start('Office');
  }
}
