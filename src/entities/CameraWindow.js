/**
 * Окно камеры наблюдения на мониторе оператора.
 * Показывает комнату, существо и сводку характеристик.
 */
import { getCreatureDef } from '../data/creatures.js';
import { COLORS, addScanlines, drawBar, drawPanel, makeText, statColor } from '../ui/theme.js';
import { StatBar } from '../ui/widgets.js';

export const CAM_W = 434;
export const CAM_H = 172;

const BAR_ROWS = [26, 50, 74];
const COL_X = [110, 272];
const BAR_W = 150;

export class CameraWindow extends Phaser.GameObjects.Container {
  constructor(scene, x, y, slot, game) {
    super(scene, x, y);
    this.slot = slot;
    this.game = game;
    this.baseX = x;
    this.baseY = y;
    this.hovered = false;
    this.offline = false;
    this.glitchUntil = 0;
    this.nextGlitch = 0;
    this.onOpen = null;
    this.camDown = 0;

    this.build();
    scene.add.existing(this);
    this.refresh();
  }

  build() {
    const scene = this.scene;

    this.frameG = scene.add.graphics();
    this.add(this.frameG);

    // Видеопоток: фон комнаты.
    this.feed = scene.add.image(0, 0, 'cam_bg').setOrigin(0);
    const feedScale = Math.max(CAM_W / 640, CAM_H / 360);
    this.feed.setScale(feedScale);
    this.feed.setCrop(0, 28, 640, Math.round(CAM_H / feedScale));
    this.feed.setPosition((CAM_W - 640 * feedScale) / 2, (CAM_H - CAM_H) / 2);
    this.feed.setTint(0x93a8a0);
    this.feed.setAlpha(0.72);
    this.add(this.feed);

    this.darken = scene.add.graphics();
    this.darken.fillStyle(0x04080a, 0.5);
    this.darken.fillRect(0, 0, CAM_W, CAM_H);
    this.add(this.darken);

    this.scan = addScanlines(scene, 0, 0, CAM_W, CAM_H, 0.28);
    this.add(this.scan);

    // Подсветка под существом.
    this.floorGlow = scene.add.ellipse(58, 156, 96, 20, 0x9fd3b0, 0.07);
    this.add(this.floorGlow);

    this.sprite = scene.add.image(58, 154, 'bobek_1_thumb').setOrigin(0.5, 1);
    this.add(this.sprite);
    this.spriteBob = scene.tweens.add({
      targets: this.sprite,
      y: 151,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Информационная панель.
    this.infoPanel = scene.add.graphics();
    this.infoPanel.fillStyle(0x050b0d, 0.62);
    this.infoPanel.fillRect(104, 20, 324, 146);
    this.infoPanel.lineStyle(1, COLORS.line, 0.45);
    this.infoPanel.strokeRect(104.5, 20.5, 323, 145);
    this.add(this.infoPanel);

    this.slotText = makeText(scene, 8, 4, '01', {
      size: 11,
      color: COLORS.amber,
      font: 'display',
    });
    this.nameText = makeText(scene, 38, 5, 'БОБЭК', { size: 9, color: COLORS.white, font: 'display' });
    this.levelText = makeText(scene, CAM_W - 8, 6, 'УР.1', {
      size: 8,
      color: COLORS.dim,
      font: 'display',
      origin: [1, 0],
    });
    this.add([this.slotText, this.nameText, this.levelText]);

    this.bars = {
      hunger: new StatBar(scene, COL_X[0], BAR_ROWS[0], BAR_W, 'ГОЛОД', { compact: true }),
      stress: new StatBar(scene, COL_X[1], BAR_ROWS[0], BAR_W, 'СТРЕСС', { compact: true }),
      energy: new StatBar(scene, COL_X[0], BAR_ROWS[1], BAR_W, 'ЭНЕРГИЯ', { compact: true }),
      health: new StatBar(scene, COL_X[1], BAR_ROWS[1], BAR_W, 'ЗДОРОВЬЕ', { compact: true }),
      aggression: new StatBar(scene, COL_X[0], BAR_ROWS[2], BAR_W, 'АГРЕССИЯ', { compact: true }),
      integrity: new StatBar(scene, COL_X[1], BAR_ROWS[2], BAR_W, 'КЛЕТКА', { compact: true }),
    };
    this.add(Object.values(this.bars));

    this.activityText = makeText(scene, 110, 99, '', { size: 13, color: COLORS.dim, wrap: 314 });
    this.add(this.activityText);

    this.readyLabel = makeText(scene, 110, 120, 'ГОТОВНОСТЬ', { size: 11, color: COLORS.dim });
    this.readyValue = makeText(scene, 260, 119, '0', {
      size: 11,
      color: COLORS.text,
      origin: [1, 0],
    });
    this.readyBar = scene.add.graphics();
    this.add([this.readyLabel, this.readyValue, this.readyBar]);

    this.badgeG = scene.add.graphics();
    this.badgeText = makeText(scene, 276, 118, '', { size: 9, color: COLORS.amber, font: 'display' });
    this.add([this.badgeG, this.badgeText]);

    this.footerText = makeText(scene, 110, 148, '', { size: 7, color: COLORS.dimmer, font: 'display' });
    this.add(this.footerText);

    // Служебные оверлеи.
    this.offlineOverlay = scene.add.container(0, 0).setVisible(false);
    const offG = scene.add.graphics();
    offG.fillStyle(0x04080a, 0.88);
    offG.fillRect(0, 0, CAM_W, CAM_H);
    const offNoise = scene.add
      .tileSprite(0, 0, CAM_W, CAM_H, 'noise1')
      .setOrigin(0)
      .setAlpha(0.2);
    const offText = makeText(scene, CAM_W / 2, CAM_H / 2 - 8, 'НЕТ СИГНАЛА', {
      size: 10,
      color: COLORS.red,
      font: 'display',
      origin: [0.5, 0.5],
    });
    const offSub = makeText(scene, CAM_W / 2, CAM_H / 2 + 18, 'КАНАЛ ПРЕРВАН // ПОМЕХИ', {
      size: 12,
      color: COLORS.dimmer,
      origin: [0.5, 0.5],
    });
    this.offlineOverlay.add([offG, offNoise, offText, offSub]);
    this.add(this.offlineOverlay);

    this.emptyOverlay = scene.add.container(0, 0).setVisible(false);
    const emptyG = scene.add.graphics();
    emptyG.fillStyle(0x04080a, 0.82);
    emptyG.fillRect(0, 0, CAM_W, CAM_H);
    this.emptyText = makeText(scene, CAM_W / 2, CAM_H / 2 - 10, 'СЕКТОР НЕ ВВЕДЁН', {
      size: 9,
      color: COLORS.dim,
      font: 'display',
      origin: [0.5, 0.5],
    });
    this.emptySub = makeText(scene, CAM_W / 2, CAM_H / 2 + 16, 'ОЖИДАНИЕ СУБЪЕКТА', {
      size: 12,
      color: COLORS.dimmer,
      origin: [0.5, 0.5],
    });
    this.emptyOverlay.add([emptyG, this.emptyText, this.emptySub]);
    this.add(this.emptyOverlay);

    this.contractOverlay = scene.add.container(0, 0).setVisible(false);
    const contractG = scene.add.graphics();
    contractG.fillStyle(0x04080a, 0.86);
    contractG.fillRect(0, 0, CAM_W, CAM_H);
    drawPanel(contractG, 10, 26, CAM_W - 20, CAM_H - 36, {
      fill: COLORS.panel,
      stroke: COLORS.cyan,
      alpha: 0.94,
      cornerColor: COLORS.cyan,
      cornerSize: 8,
    });
    this.contractTitle = makeText(scene, CAM_W / 2, 46, 'НА КОНТРАКТЕ', {
      size: 9,
      color: COLORS.cyan,
      font: 'display',
      origin: [0.5, 0],
    });
    this.contractJob = makeText(scene, CAM_W / 2, 68, '', {
      size: 14,
      color: COLORS.text,
      align: 'center',
      wrap: CAM_W - 60,
      origin: [0.5, 0],
    });
    this.contractCompany = makeText(scene, CAM_W / 2, 108, '', {
      size: 12,
      color: COLORS.dim,
      origin: [0.5, 0],
    });
    this.contractBar = scene.add.graphics();
    const contractFoot = makeText(scene, CAM_W / 2, 150, 'СВЯЗЬ ТОЛЬКО ЧЕРЕЗ КОРПОРАЦИЮ', {
      size: 10,
      color: COLORS.dimmer,
      origin: [0.5, 0],
    });
    this.contractOverlay.add([
      contractG,
      this.contractTitle,
      this.contractJob,
      this.contractCompany,
      this.contractBar,
      contractFoot,
    ]);
    this.add(this.contractOverlay);

    this.alarmG = scene.add.graphics();
    this.add(this.alarmG);

    this.hoverG = scene.add.graphics().setVisible(false);
    this.hoverG.lineStyle(2, COLORS.yellow, 0.9);
    this.hoverG.strokeRect(1, 1, CAM_W - 2, CAM_H - 2);
    this.add(this.hoverG);

    this.glitchTile = scene.add
      .tileSprite(0, 0, CAM_W, CAM_H, 'noise2')
      .setOrigin(0)
      .setAlpha(0);
    this.add(this.glitchTile);

    const zone = scene.add.zone(0, 0, CAM_W, CAM_H).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      this.hovered = true;
      this.hoverG.setVisible(true);
      this.scene.game.audio?.ui?.();
    });
    zone.on('pointerout', () => {
      this.hovered = false;
      this.hoverG.setVisible(false);
    });
    zone.on('pointerup', () => {
      if (this.onOpen) this.onOpen(this.slot);
    });
    this.add(zone);

    this.redrawFrame();
  }

  redrawFrame() {
    const g = this.frameG;
    g.clear();
    g.fillStyle(0x030708, 0.92);
    g.fillRect(0, 0, CAM_W, CAM_H);
    g.lineStyle(1, this.hovered ? COLORS.yellow : COLORS.line, 0.9);
    g.strokeRect(0.5, 0.5, CAM_W - 1, CAM_H - 1);
    g.fillStyle(COLORS.black, 0.55);
    g.fillRect(0, 0, CAM_W, 20);
    g.lineStyle(1, COLORS.line, 0.7);
    g.lineBetween(0, 20.5, CAM_W, 20.5);
    g.fillStyle(COLORS.amber, 0.75);
    g.fillRect(0, 0, 3, 20);
  }

  setOnOpen(callback) {
    this.onOpen = callback;
  }

  refresh() {
    const state = this.game.state;
    if (!state) return;
    const creature = this.game.get(this.slot);
    if (!creature) return;

    const def = creature.defId ? getCreatureDef(creature.defId) : null;
    const isOffline = Boolean(state.camDown?.[this.slot] > 0 || state.blackout);
    this.offline = Boolean(isOffline);
    const readiness = this.game.readinessOf(this.slot);

    this.slotText.setText(String(this.slot).padStart(2, '0'));
    this.nameText.setText(def ? def.name : 'ПУСТО');
    this.levelText.setText(def ? `УР.${creature.level}` : '—');

    const isEmpty = creature.status === 'empty';
    const isTerminated = creature.status === 'terminated';
    const isContract = creature.status === 'contract';
    const isEscaped = creature.status === 'escaped';
    const isAlarm = state.alarm?.slot === this.slot;

    this.emptyOverlay.setVisible(isEmpty);
    if (isEmpty) {
      const shopSlot = this.slot >= 2 && this.slot <= 4;
      this.emptyText.setText(shopSlot ? 'ПРОТОКОЛ ЗАКРЫТ' : 'СЕКТОР НЕ ВВЕДЁН');
      this.emptySub.setText(shopSlot ? 'КУПИТЬ В ПИТОМНИКЕ' : 'ОЖИДАНИЕ СУБЪЕКТА');
      this.emptySub.setColor(shopSlot ? COLORS.purple : COLORS.dimmer);
    }
    if (isEmpty) {
      this.emptyText.setText('СЕКТОР НЕ ВВЕДЁН');
      this.emptySub.setText('ОЖИДАНИЕ СУБЪЕКТА');
      this.sprite.setVisible(false);
      this.setBarsVisible(false);
      this.contractOverlay.setVisible(false);
      this.offlineOverlay.setVisible(false);
      this.activityText.setText('ПУСТАЯ КОМНАТА');
      this.activityText.setColor(COLORS.dimmer);
      this.readyLabel.setVisible(false);
      this.readyValue.setVisible(false);
      this.readyBar.setVisible(false);
      this.footerText.setText('СЕКТОР ВЫКЛЮЧЕН');
      this.badgeG.clear();
      this.badgeText.setText('');
      this.alarmG.clear();
      this.redrawFrame();
      return;
    }

    this.setBarsVisible(!this.offline);
    this.offlineOverlay.setVisible(this.offline);
    this.contractOverlay.setVisible(isContract);
    this.emptyOverlay.setVisible(isTerminated && !this.offline);
    if (isTerminated) {
      this.emptyText.setText('СУБЪЕКТ УТИЛИЗИРОВАН');
      this.emptySub.setText('КЛЕТКА ПУСТА');
    }

    this.sprite.setVisible(!isContract && !isTerminated && !isEscaped && !this.offline);
    if (def && !isContract && !isTerminated && !isEscaped) {
      const texture = `${def.id}_${creature.stage}_thumb`;
      if (this.scene.textures.exists(texture)) {
        this.sprite.setTexture(texture);
        const frame = this.sprite.frame;
        const scale = Math.min(112 / frame.realHeight, 98 / frame.realWidth);
        this.sprite.setScale(scale);
      }
      this.sprite.setAlpha(creature.status === 'training' ? 0.85 : 1);
    }

    if (!this.offline) {
      const stats = creature.stats;
      this.bars.hunger.setValue(stats.hunger, statColor('hunger', stats.hunger));
      this.bars.stress.setValue(stats.stress, statColor('stress', stats.stress));
      this.bars.energy.setValue(stats.energy, statColor('energy', stats.energy));
      this.bars.health.setValue(stats.health, statColor('health', stats.health));
      this.bars.aggression.setValue(stats.aggression, statColor('aggression', stats.aggression));
      this.bars.integrity.setValue(stats.integrity, statColor('integrity', stats.integrity));

      this.readyLabel.setVisible(true);
      this.readyValue.setVisible(true);
      this.readyBar.setVisible(true);
      this.readyValue.setText(String(readiness));
      this.readyValue.setColor(readiness >= 60 ? COLORS.green : COLORS.dim);
      this.readyBar.clear();
      drawBar(this.readyBar, 110, 136, 150, 5, readiness, readiness >= 60 ? COLORS.green : COLORS.cyan, {
        ticks: true,
      });

      this.footerText.setText(
        `ЧИСТОТА ${Math.round(stats.cleanliness)}  ·  ЛОЯЛЬНОСТЬ ${Math.round(stats.loyalty)}  ·  ${def?.sector || ''}`
      );
    } else {
      this.readyLabel.setVisible(false);
      this.readyValue.setVisible(false);
      this.readyBar.setVisible(false);
      this.footerText.setText('КАНАЛ НЕДОСТУПЕН');
    }

    let activity = this.game.get(this.slot)?.status === 'contract'
      ? 'НА КОНТРАКТЕ'
      : this.game.get(this.slot)?.status === 'escaped'
        ? 'ПОБЕГ'
        : this.game.get(this.slot)?.status === 'terminated'
          ? 'УТИЛИЗИРОВАН'
          : this.game.get(this.slot)?.activity || '—';

    if (isEscaped) {
      this.emptyOverlay.setVisible(true);
      this.emptyText.setText('КАМЕРА ПУСТА');
      this.emptySub.setText('СУБЪЕКТ ПОКИНУЛ КЛЕТКУ');
      this.setBarsVisible(false);
      this.readyLabel.setVisible(false);
      this.readyValue.setVisible(false);
      this.readyBar.setVisible(false);
    }

    this.activityText.setText(String(activity).toUpperCase());
    this.activityText.setColor(
      isAlarm ? COLORS.red : isContract ? COLORS.cyan : isTerminated ? COLORS.dimmer : COLORS.dim
    );

    // Бейдж состояния.
    this.badgeG.clear();
    let badge = '';
    let badgeColor = COLORS.amber;
    if (isAlarm) {
      badge = 'ТРЕВОГА';
      badgeColor = COLORS.red;
    } else if (isContract) {
      badge = 'КОНТРАКТ';
      badgeColor = COLORS.cyan;
    } else if (creature.status === 'training') {
      badge = 'ОБУЧЕНИЕ';
      badgeColor = COLORS.cyan;
    } else if (readiness >= 60) {
      badge = 'ГОТОВ';
      badgeColor = COLORS.green;
    } else if (isTerminated) {
      badge = '—';
      badgeColor = COLORS.dimmer;
    }

    if (badge) {
      this.badgeG.fillStyle(badgeColor, 0.12);
      this.badgeG.fillRect(268, 114, 156, 22);
      this.badgeG.lineStyle(1, badgeColor, 0.8);
      this.badgeG.strokeRect(268.5, 114.5, 155, 21);
      this.badgeText.setText(badge);
      this.badgeText.setColor(badgeColor);
      this.badgeText.setPosition(346, 119);
      this.badgeText.setOrigin(0.5, 0);
    } else {
      this.badgeText.setText('');
    }

    // Контракт.
    if (isContract && creature.contract) {
      this.contractTitle.setText('НА КОНТРАКТЕ');
      this.contractJob.setText(creature.contract.title);
      this.contractCompany.setText(`${creature.contract.companyName} · ${Math.ceil(creature.contract.endIn)} С`);
      const ratio =
        1 - Math.max(0, creature.contract.endIn) / Math.max(1, creature.contract.duration);
      this.contractBar.clear();
      drawBar(this.contractBar, 40, 132, CAM_W - 80, 6, ratio * 100, COLORS.cyan, { ticks: false });
    }

    // Тревога.
    this.alarmG.clear();
    if (isAlarm) {
      const pulse = 0.55 + Math.sin(this.scene.time.now / 180) * 0.35;
      this.alarmG.lineStyle(3, COLORS.red, pulse);
      this.alarmG.strokeRect(1.5, 1.5, CAM_W - 3, CAM_H - 3);
    }

    this.redrawFrame();
  }

  setBarsVisible(visible) {
    for (const bar of Object.values(this.bars)) bar.setVisible(visible);
    this.activityText.setVisible(visible);
    this.footerText.setVisible(visible);
  }

  tickUpdate(time) {
    if (!this.offline && time > this.nextGlitch && Math.random() < 0.08) {
      this.glitchUntil = time + 120 + Math.random() * 160;
      this.nextGlitch = time + 4200 + Math.random() * 6000;
      this.glitchTile.setAlpha(0.2);
      this.glitchTile.tilePositionX = Math.random() * 100;
      this.glitchTile.tilePositionY = Math.random() * 100;
    }
    if (this.glitchUntil && time > this.glitchUntil) {
      this.glitchUntil = 0;
      this.glitchTile.setAlpha(0);
      this.sprite.x = 58;
    }
    if (this.glitchUntil) {
      this.glitchTile.tilePositionX += 6;
      this.sprite.x = 58 + (Math.random() * 6 - 3);
    }
    this.glitchTile.setAlpha(this.glitchUntil ? 0.18 + Math.random() * 0.1 : Math.max(0, this.glitchTile.alpha - 0.02));

    const alarmed = this.game.state?.alarm?.slot === this.slot;
    if (alarmed) {
      this.x = this.baseX + (Math.random() * 3 - 1.5);
      this.y = this.baseY + (Math.random() * 2 - 1);
    } else if (this.x !== this.baseX || this.y !== this.baseY) {
      this.x = this.baseX;
      this.y = this.baseY;
    }

    if (this.offline) {
      this.offlineOverlay.list[1].tilePositionY = (this.offlineOverlay.list[1].tilePositionY + 1) % 96;
    }
  }
}