/**
 * Главное меню: новая смена, продолжение, архив концовок.
 */
import { game as manager } from '../managers/GameManager.js';
import { CREATURE_DEFS } from '../data/creatures.js';
import { ENDINGS } from '../data/plot.js';
import { addCoverImage, addCrt, addDarkness } from '../ui/backdrop.js';
import { COLORS, addScanlines, drawPanel, makeText } from '../ui/theme.js';
import { Button, showToast } from '../ui/widgets.js';

const PREVIEW_SLOTS = [
  { slot: 1, defId: 'bobek' },
  { slot: 2, defId: 'pamydsa' },
  { slot: 3, defId: 'mishutka' },
  { slot: 4, defId: 'vodolazik' },
  { slot: 5, defId: null },
  { slot: 6, defId: null },
];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fresh') === '1') manager.reset();

    if (params.get('screen')) {
      this.debugRedirect(params.get('screen'), params.get('seed'));
      return;
    }

    this.saveResult = manager.saveManager.load();
    this.saveInfo = this.saveResult.ok ? this.saveResult.state : null;
    this.soundOn = this.loadSoundSetting();

    addCoverImage(this, 'office_bg', 1280, 800, { tint: 0x6e8288, alpha: 1, depth: -30 });
    addDarkness(this, 1280, 800, 0.4, -25);
    this.drawGradient();
    addCrt(this, 1280, 800, { scanAlpha: 0.18, vignetteAlpha: 0.55 });

    this.buildTitle();
    this.buildPreview();
    this.buildButtons();
    this.buildFooter();

    this.titleGlow = this.add
      .ellipse(280, 236, 460, 160, 0x6ad48a, 0.045)
      .setDepth(-5);
    this.tweens.add({
      targets: this.titleGlow,
      alpha: 0.015,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    if (this.saveResult.corrupted) {
      showToast(this, 'СОХРАНЕНИЕ ПОВРЕЖДЕНО. СОЗДАНА РЕЗЕРВНАЯ КОПИЯ.', { kind: 'danger' });
    } else if (this.saveResult.incompatible) {
      showToast(this, this.saveResult.error, { kind: 'danger' });
    }

    manager.gameplayStop?.();
  }

  loadSoundSetting() {
    try {
      const value = window.localStorage.getItem('atd67_sound');
      return value !== '0';
    } catch {
      return true;
    }
  }

  saveSoundSetting(value) {
    try {
      window.localStorage.setItem('atd67_sound', value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  debugRedirect(screen, seed) {
    manager.newGame(Number(seed) || 20261030);
    if (screen === 'office') {
      this.scene.start('Office');
    } else if (screen === 'room') {
      this.scene.start('Room', { slot: 1 });
    } else if (screen === 'market') {
      this.scene.start('Market');
    } else if (screen === 'intro') {
      this.scene.start('Intro');
    } else if (screen === 'guide') {
      this.scene.start('Guide', { from: 'Menu' });
    } else if (screen === 'horror') {
      manager.state.phase = 'escaping';
      manager.state.escape = { slot: 1, defId: 'vodolazik', name: 'ВОДОЛАЗИК', stage: 2, count: 1 };
      this.scene.start('Horror', manager.state.escape);
    } else if (screen === 'report') {
      manager.endShift('manual');
      this.scene.start('Report');
    } else if (screen === 'ending') {
      manager.state.day = 10;
      manager.state.plot.notes = ['note_01', 'note_02', 'note_03', 'note_04', 'note_05', 'note_06', 'note_07'];
      manager.state.stats.escapes = 0;
      manager.endShift('manual');
      this.scene.start('Ending');
    } else {
      this.scene.start('Office');
    }
  }

  drawGradient() {
    const g = this.add.graphics().setDepth(-20);
    for (let i = 0; i < 20; i += 1) {
      g.fillStyle(0x030708, 0.035 * i);
      g.fillRect(0, 520 + i * 14, 1280, 14);
    }
    g.fillStyle(0x030708, 0.55);
    g.fillRect(0, 0, 1280, 90);
  }

  buildTitle() {
    makeText(this, 88, 96, 'ОБЪЕКТ 67  //  ГЛУБИНА 214 М', {
      size: 8,
      color: COLORS.dimmer,
      font: 'display',
    });

    const bunker = makeText(this, 86, 136, 'БУНКЕР', {
      size: 30,
      color: COLORS.text,
      font: 'display',
    });
    bunker.setShadow(3, 3, '#020506', 0, true, true);

    const atd = makeText(this, 82, 188, 'АТД-67', {
      size: 58,
      color: COLORS.amber,
      font: 'display',
    });
    atd.setShadow(4, 4, '#1a1004', 0, true, true);

    const line = this.add.graphics();
    line.fillStyle(COLORS.lineBright, 0.65);
    line.fillRect(88, 268, 420, 2);
    line.fillStyle(COLORS.amber, 0.8);
    line.fillRect(88, 268, 96, 2);

    makeText(this, 88, 292, 'СИМУЛЯТОР ОПЕРАТОРА ПОДЗЕМНОЙ ЛАБОРАТОРИИ', {
      size: 15,
      color: COLORS.dim,
      font: 'body',
    });

    makeText(
      this,
      88,
      318,
      'Шесть камер. Четыре существа. Восемь минут.\nКорми. Успокаивай. Отправляй на работу.\nИ не задавай лишних вопросов.',
      { size: 17, color: COLORS.text, font: 'body', wrap: 430, lineSpacing: 5 }
    );
  }

  buildPreview() {
    const x = 620;
    const y = 128;
    const w = 580;
    const h = 532;
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h, {
      fill: 0x070e10,
      stroke: COLORS.line,
      alpha: 0.92,
      cornerColor: COLORS.lineBright,
      cornerSize: 14,
    });
    this.add
      .rectangle(x + w / 2, y + h / 2, w - 8, h - 8, 0x000000, 0)
      .setStrokeStyle(1, 0x14272b, 0.8);

    makeText(this, x + 16, y + 10, 'ПРЯМАЯ ТРАНСЛЯЦИЯ // 6 КАНАЛОВ', {
      size: 8,
      color: COLORS.green,
      font: 'display',
    });
    makeText(this, x + w - 16, y + 10, 'ЗАПИСЬ', {
      size: 8,
      color: COLORS.red,
      font: 'display',
      origin: [1, 0],
    });

    const rec = this.add.circle(x + w - 64, y + 15, 4, COLORS.red, 1);
    this.tweens.add({ targets: rec, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });

    const innerX = x + 14;
    const innerY = y + 36;
    const cellW = 268;
    const cellH = 138;
    const gapX = 10;
    const gapY = 8;

    PREVIEW_SLOTS.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      this.buildPreviewCell(
        innerX + col * (cellW + gapX),
        innerY + row * (cellH + gapY),
        cellW,
        cellH,
        item,
        index
      );
    });

    makeText(
      this,
      x + 16,
      y + h - 24,
      'СИГНАЛ 4/6  ·  ПИТАНИЕ 82%  ·  НАДЗОР-7 АКТИВЕН',
      { size: 7, color: COLORS.dimmer, font: 'display' }
    );
  }

  buildPreviewCell(x, y, w, h, item, index) {
    const def = item.defId ? CREATURE_DEFS[item.defId] : null;
    const cell = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x050b0d, 1).fillRect(0, 0, w, h);
    bg.lineStyle(1, COLORS.line, 0.7).strokeRect(0.5, 0.5, w - 1, h - 1);
    cell.add(bg);

    if (def) {
      const feed = this.add
        .image(0, 0, 'cam_bg')
        .setOrigin(0)
        .setDisplaySize(w, h)
        .setTint(0x7d948c)
        .setAlpha(0.55);
      cell.add(feed);
      const dark = this.add.graphics();
      dark.fillStyle(0x04080a, 0.42).fillRect(0, 0, w, h);
      cell.add(dark);

      const sprite = this.add.image(w / 2, h - 10, `${def.id}_1_thumb`).setOrigin(0.5, 1);
      const scale = Math.min(100 / sprite.frame.realHeight, w * 0.58 / sprite.frame.realWidth);
      sprite.setScale(scale);
      sprite.setAlpha(0.92);
      cell.add(sprite);
      this.tweens.add({
        targets: sprite,
        y: h - 13,
        duration: 1800 + index * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });

      const subj = makeText(this, 8, 7, def.subject, {
        size: 8,
        color: COLORS.amber,
        font: 'display',
      });
      const status = makeText(this, 20, h - 21, 'СОДЕРЖИТСЯ', {
        size: 11,
        color: COLORS.green,
        font: 'body',
      });
      const dot = this.add.circle(10, h - 14, 2, COLORS.green, 1);
      cell.add([subj, status, dot]);
      this.tweens.add({ targets: dot, alpha: 0.2, duration: 1200 + index * 130, yoyo: true, repeat: -1 });
    } else {
      const noise = this.add
        .tileSprite(0, 0, w, h, 'noise0')
        .setOrigin(0)
        .setAlpha(0.12);
      cell.add(noise);
      const label = makeText(this, w / 2, h / 2 - 8, `СЕКТОР 0${item.slot}`, {
        size: 9,
        color: COLORS.dimmer,
        font: 'display',
        origin: [0.5, 0.5],
      });
      const sub = makeText(this, w / 2, h / 2 + 14, 'НЕТ СИГНАЛА', {
        size: 12,
        color: COLORS.red,
        font: 'body',
        origin: [0.5, 0.5],
      });
      cell.add([label, sub]);
    }

    const scan = addScanlines(this, 0, 0, w, h, 0.22);
    cell.add(scan);
    const edge = this.add.graphics();
    edge.fillStyle(COLORS.amber, 0.6).fillRect(0, 0, 2, h);
    edge.fillStyle(COLORS.black, 0.4).fillRect(0, 0, w, 18);
    cell.add(edge);

    this.previewCells = this.previewCells || [];
    this.previewCells.push(cell);
    return cell;
  }

  buildButtons() {
    const x = 88;
    const width = 360;

    this.newGameBtn = new Button(this, x, 438, width, 54, 'НОВАЯ СМЕНА', {
      variant: 'primary',
      size: 11,
      icon: 'contract',
      sub: 'СМЕНА 01',
      onClick: () => this.requestNewGame(),
    });

    this.continueBtn = new Button(this, x, 502, width, 54, 'ПРОДОЛЖИТЬ', {
      variant: 'default',
      size: 11,
      sub: this.saveInfo ? `ДЕНЬ ${this.saveInfo.day} · СМЕНА ${this.saveInfo.shift}` : 'НЕТ ДАННЫХ',
      onClick: () => this.continueGame(),
    });
    this.continueBtn.setEnabled(Boolean(this.saveInfo));

    const endings = this.saveInfo?.meta?.unlockedEndings || [];
    this.archiveBtn = new Button(this, x, 566, width, 42, `АРХИВ КОНЦОВОК [${endings.length}/5]`, {
      variant: 'ghost',
      size: 9,
      onClick: () => this.showArchive(endings),
    });
    this.archiveBtn.setEnabled(endings.length > 0);

    this.guideBtn = new Button(this, x, 620, width, 42, 'КАК ИГРАТЬ', {
      variant: 'amber',
      size: 9,
      icon: 'note',
      onClick: () => this.openGuide(),
    });

    const sound = this.loadSoundSetting();
    manager.audio?.setMuted(!sound);
    this.soundBtn = new Button(this, 1136, 24, 136, 34, sound ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ', {
      variant: 'ghost',
      size: 8,
      icon: sound ? 'sound' : 'mute',
      onClick: () => this.toggleSound(),
    });

    if (!this.saveInfo) {
      makeText(this, x + 2, 676, 'Сохранение не найдено. Начните новую смену.', {
        size: 13,
        color: COLORS.dimmer,
        font: 'body',
      });
    }
  }

  openGuide() {
    manager.audio?.ui?.();
    this.scene.start('Guide', { from: 'Menu' });
  }

  buildFooter() {
    makeText(this, 88, 764, 'ВЕРСИЯ 1.0  ·  СБОРКА ATD67-1987  ·  ВСЕ СМЕНЫ ЗАПИСЫВАЮТСЯ', {
      size: 7,
      color: COLORS.dimmer,
      font: 'display',
    });
    const led = this.add.circle(1206, 764, 3, COLORS.green, 1);
    this.tweens.add({ targets: led, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1 });
    makeText(this, 1216, 758, 'ONLINE', {
      size: 7,
      color: COLORS.dimmer,
      font: 'display',
      origin: [1, 0],
    });
  }

  toggleSound() {
    this.soundOn = !this.soundOn;
    manager.audio?.init();
    manager.audio?.resume();
    manager.audio?.setMuted(!this.soundOn);
    this.saveSoundSetting(this.soundOn);
    this.soundBtn.setLabel(this.soundOn ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ');
    this.soundBtn.setVariant(this.soundOn ? 'ghost' : 'danger');
  }

  requestNewGame() {
    if (this.saveInfo) {
      this.scene.launch('Modal', {
        title: 'НОВАЯ ПАРТИЯ',
        body:
          'Текущее сохранение будет стёрто. Все смены, контракты и мутации будут потеряны.\n\n' +
          'Продолжить?',
        accent: COLORS.red,
        pause: false,
        buttons: [
          {
            label: 'СТЕРЕТЬ И НАЧАТЬ',
            variant: 'danger',
            onClick: () => this.startNewGame(),
          },
          { label: 'ОТМЕНА', variant: 'ghost' },
        ],
      });
    } else {
      this.startNewGame();
    }
  }

  startNewGame() {
    manager.audio?.init();
    manager.audio?.resume();
    manager.newGame();
    if (manager.state?.settings) {
      manager.state.settings.sound = this.soundOn;
      manager.save(true);
    }
    this.scene.start('Intro');
  }

  continueGame() {
    const result = manager.load();
    if (!result.ok) {
      showToast(this, result.error || 'Не удалось загрузить сохранение', { kind: 'danger' });
      return;
    }
    manager.audio?.init();
    manager.audio?.resume();
    const state = manager.state;
    manager.gameplayStart?.();
    if (state.phase === 'report') this.scene.start('Report');
    else if (state.phase === 'ended') this.scene.start('Ending');
    else this.scene.start('Office');
  }

  showArchive(endings) {
    const lines = endings
      .map((id) => {
        const ending = ENDINGS[id];
        return ending ? `· ${ending.title}` : null;
      })
      .filter(Boolean);
    this.scene.launch('Modal', {
      title: 'АРХИВ КОНЦОВОК',
      body:
        `ОТКРЫТО ${endings.length} ИЗ 5\n\n${lines.join('\n')}\n\n` +
        'Остальные записи повреждены или ещё не созданы.',
      accent: COLORS.purple,
      pause: false,
      buttons: [{ label: 'ЗАКРЫТЬ', variant: 'ghost' }],
    });
  }

  update(time) {
    if (!this.previewCells) return;
    if (time % 400 < 20) {
      const cell = Phaser.Utils.Array.GetRandom(this.previewCells);
      if (cell?.list?.[3]) {
        cell.list[3].x += Math.random() * 2 - 1;
      }
    }
  }
}
