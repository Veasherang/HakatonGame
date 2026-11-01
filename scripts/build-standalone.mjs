/**
 * Сборка автономного HTML: игра открывается двойным щелчком по файлу,
 * без локального сервера. Все модули, картинки и шрифты упаковываются внутрь.
 *
 * Запуск: node scripts/build-standalone.mjs
 * Результат: bunker-atd-67.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'bunker-atd-67.html');
const CREATURE_INDEX = { bobek: 1, pamydsa: 2, mishutka: 3, vodolazik: 4 };

const read = (relative) => fs.readFileSync(path.join(ROOT, relative));
const readText = (relative) => read(relative).toString('utf8');

const mimeFor = (file) => {
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.woff2')) return 'font/woff2';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.mp3')) return 'audio/mpeg';
  if (file.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
};

const dataUri = (relative) =>
  `data:${mimeFor(relative)};base64,${read(relative).toString('base64')}`;

/** Все изображения, которые BootScene загружает по ключам. */
function collectAssets() {
  const manifest = {
    office_bg: dataUri('assets/office_bg.png'),
    room_bg: dataUri('assets/room_bg.png'),
    cam_bg: dataUri('assets/cam_bg.png'),
  };

  for (let index = 1; index <= 3; index += 1) {
    manifest[`pumpkin_${index}`] = dataUri(`assets/pumpkins/pump${index}.png`);
  }

  for (const [id, index] of Object.entries(CREATURE_INDEX)) {
    for (let stage = 1; stage <= 3; stage += 1) {
      manifest[`${id}_${stage}`] = dataUri(`assets/creatures/m${index}_s${stage}.png`);
      manifest[`${id}_${stage}_thumb`] = dataUri(
        `assets/creatures/m${index}_s${stage}_thumb.png`
      );
    }
  }
  return manifest;
}

/** Все звуки, которые AudioManager берёт из sounds/. */
function collectSounds() {
  const manifest = {};
  const dirs = [
    'sounds/StartScreen',
    'sounds/TheEnd',
    'sounds/CreepySounds',
    'sounds/Jumpscares',
    'sounds/Siren',
    'sounds/VoicesOfCreatures',
    'sounds/Ambient',
    'sounds/processed',
  ];
  for (const dir of dirs) {
    const absolute = path.join(ROOT, dir);
    if (!fs.existsSync(absolute)) continue;
    for (const file of fs.readdirSync(absolute)) {
      if (!/\.(mp3|wav)$/i.test(file)) continue;
      // Из Ambient в сборку попадает только mp3: оригинальные WAV уже
      // сжаты в sounds/processed и не должны раздувать standalone.
      if (dir === 'sounds/Ambient' && !/\.mp3$/i.test(file)) continue;
      const relative = `${dir}/${file}`.replaceAll('\\', '/');
      manifest[relative] = dataUri(relative);
    }
  }
  return manifest;
}

function inlineCss() {
  let css = readText('style.css');
  css = css.replace(/url\('([^']+)'\)/g, (match, relative) => {
    if (!relative.startsWith('assets/')) return match;
    return `url('${dataUri(relative)}')`;
  });
  return css;
}

function stripMarkedBlock(html, start, end) {
  const pattern = new RegExp(`[ \\t]*${start}[\\s\\S]*?${end}[ \\t]*\\n?`, 'g');
  return html.replace(pattern, '');
}

async function buildBundle() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/main.js')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    legalComments: 'none',
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

function safeInline(code) {
  return code.replace(/<\/script/gi, '<\\/script');
}

async function main() {
  const manifest = collectAssets();
  const sounds = collectSounds();
  const bundle = safeInline(await buildBundle());
  const phaser = safeInline(readText('vendor/phaser.min.js').replace(/\/\/# sourceMappingURL=.*$/m, ''));
  const css = inlineCss();

  let html = readText('index.html');
  html = stripMarkedBlock(html, '// STANDALONE_REDIRECT_START', '// STANDALONE_REDIRECT_END');
  html = stripMarkedBlock(html, '// FILE_HINT_START', '// FILE_HINT_END');

  html = html.replace(
    '<link rel="icon" href="favicon.png" type="image/png" />',
    `<link rel="icon" href="${dataUri('favicon.png')}" type="image/png" />`
  );
  html = html.replace(
    '<link rel="stylesheet" href="style.css" />',
    `<style>\n${css}\n</style>`
  );
  html = html.replace(
    '<script src="vendor/phaser.min.js"></script>',
    `<script>${phaser}</script>`
  );
  html = html.replace(
    '<script type="module" src="src/main.js"></script>',
    `<script>\nwindow.ATD_ASSETS = ${JSON.stringify(manifest)};\nwindow.ATD_SOUNDS = ${JSON.stringify(sounds)};\n${bundle}\n</script>`
  );

  if (/<script[^>]+src=|<link[^>]+href="(?!data:)/.test(html)) {
    throw new Error('В автономной сборке остались внешние ссылки');
  }

  fs.writeFileSync(OUTPUT, html, 'utf8');
  const sizeMb = fs.statSync(OUTPUT).size / (1024 * 1024);
  console.log(`Готово: ${OUTPUT}`);
  console.log(
    `Размер: ${sizeMb.toFixed(2)} МБ · изображений: ${Object.keys(manifest).length} · звуков: ${Object.keys(sounds).length} · JS: ${(bundle.length / 1024).toFixed(1)} КБ`
  );
}

main().catch((error) => {
  console.error('BUILD_FAILED', error);
  process.exit(1);
});
