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
    ],
  };

  const phaserGame = new Phaser.Game(config);
  phaserGame.audio = audio;
  phaserGame.manager = manager;
  manager.audio = audio;

  window.__ATD__ = { game: phaserGame, manager, audio };

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
