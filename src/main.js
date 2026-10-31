/**
 * Точка входа: шрифты, конфигурация Phaser и глобальные обработчики.
 */
import { game as manager } from './managers/GameManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { OfficeScene } from './scenes/OfficeScene.js';
import { RoomScene } from './scenes/RoomScene.js';
import { MarketScene } from './scenes/MarketScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { ReportScene } from './scenes/ReportScene.js';
import { HorrorScene } from './scenes/HorrorScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { ModalScene } from './scenes/ModalScene.js';
import { GuideScene } from './scenes/GuideScene.js';
import { MaintenanceScene } from './scenes/MaintenanceScene.js';
import { MaintenanceController } from './systems/maintenance.js';

async function loadFonts() {
  if (!document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('500 16px "Rubik"'),
        document.fonts.load('700 16px "Rubik"'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    await document.fonts.ready;
  } catch (error) {
    console.warn('Fonts failed', error);
  }
}

function boot() {
  const audio = new AudioManager();

  // Phaser ожидает CSS-цвет в Text.setColor; числовые значения приводим сами.
  if (Phaser?.GameObjects?.Text?.prototype?.setColor) {
    const originalSetColor = Phaser.GameObjects.Text.prototype.setColor;
    Phaser.GameObjects.Text.prototype.setColor = function patchedSetColor(color) {
      const normalized =
        typeof color === 'number'
          ? `#${Math.max(0, Math.min(0xffffff, color)).toString(16).padStart(6, '0')}`
          : color;
      return originalSetColor.call(this, normalized);
    };
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 800,
    backgroundColor: '#05080a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 800,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      powerPreference: 'high-performance',
    },
    input: {
      activePointers: 3,
    },
    scene: [
      BootScene,
      MenuScene,
      IntroScene,
      OfficeScene,
      RoomScene,
      MarketScene,
      ShopScene,
      ReportScene,
      HorrorScene,
      EndingScene,
      ModalScene,
      GuideScene,
      MaintenanceScene,
    ],
  };

  const phaserGame = new Phaser.Game(config);
  phaserGame.audio = audio;
  phaserGame.manager = manager;
  manager.audio = audio;

  const maintenance = new MaintenanceController(phaserGame);
  phaserGame.maintenanceController = maintenance;

  // Единый игровой тик для всех экранов, где должен идти день.
  const gameplayKeys = new Set(['Office', 'Room', 'Market', 'Shop', 'Maintenance']);
  phaserGame.events.on('poststep', (time, delta) => {
    if (!manager.state) return;
    const activeKeys = phaserGame.scene.getScenes(true).map((scene) => scene.scene.key);
    if (!activeKeys.some((key) => gameplayKeys.has(key))) return;
    manager.tick(delta);
    maintenance.update(delta, phaserGame, activeKeys);
  });

  const activeKeysNow = () =>
    phaserGame.scene.getScenes(true).map((scene) => scene.scene.key);

  // Тревога должна быть слышна на любом экране, а не только в активной камере.
  manager.bus.on('alarm', () => {
    audio.init();
    audio.resume();
    audio.startAlarm();
  });
  manager.bus.on('alarm-cleared', () => audio.stopAlarm());
  manager.bus.on('escape', () => audio.stopAlarm());
  manager.bus.on('shift-end', () => audio.stopAlarm());

  // Магазин и рынок не имеют собственных обработчиков завершения смены/побега,
  // но теперь время в них идёт.
  manager.bus.on('shift-end', () => {
    const keys = activeKeysNow();
    if (keys.includes('Office') || keys.includes('Room')) return;
    const key = keys.includes('Shop') ? 'Shop' : keys.includes('Market') ? 'Market' : null;
    if (!key) return;
    phaserGame.scene.getScene(key)?.scene.start('Report');
  });

  manager.bus.on('escape', (escape) => {
    const keys = activeKeysNow();
    if (keys.includes('Office') || keys.includes('Room') || keys.includes('Horror')) return;
    const key = keys.includes('Shop') ? 'Shop' : keys.includes('Market') ? 'Market' : null;
    if (!key) return;
    phaserGame.scene.getScene(key)?.scene.start('Horror', escape);
  });

  window.__ATD__ = { game: phaserGame, manager, audio, maintenance };

  const unlockAudio = () => {
    audio.init();
    audio.resume();
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) manager.save(true);
  });
  window.addEventListener('beforeunload', () => manager.save(true));

  phaserGame.events.once('ready', () => {
    setTimeout(() => {
      const bootScreen = document.getElementById('boot');
      if (bootScreen) bootScreen.classList.add('hidden');
    }, 600);
  });

  return phaserGame;
}

loadFonts().then(boot).catch((error) => {
  console.error(error);
  window.__ATD_SHOW_ERROR__?.(error.message || String(error));
});
