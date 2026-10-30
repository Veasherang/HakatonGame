/**
 * Фоны и общие CRT-эффекты сцен.
 */
import { addScanlines, addVignette, ensureFxTextures } from './theme.js';

export function addCoverImage(scene, key, width = 1280, height = 800, options = {}) {
  const source = scene.textures.get(key)?.getSourceImage?.();
  if (!source) return null;
  const image = scene.add.image(width / 2, height / 2, key);
  const scale = Math.max(width / source.width, height / source.height) * (options.zoom || 1);
  image.setScale(scale);
  image.setPosition(width / 2 + (options.offsetX || 0), height / 2 + (options.offsetY || 0));
  if (options.tint !== undefined) image.setTint(options.tint);
  image.setAlpha(options.alpha ?? 1);
  image.setDepth(options.depth ?? -20);
  return image;
}

export function addDarkness(scene, width = 1280, height = 800, alpha = 0.5, depth = -15) {
  const graphics = scene.add.graphics().setDepth(depth);
  graphics.fillStyle(0x030708, alpha);
  graphics.fillRect(0, 0, width, height);
  return graphics;
}

export function addCrt(scene, width = 1280, height = 800, options = {}) {
  ensureFxTextures(scene);
  const scan = addScanlines(scene, 0, 0, width, height, options.scanAlpha ?? 0.3, options.depth ?? 60);
  const vignette = addVignette(scene, 0, 0, width, height, options.vignetteAlpha ?? 0.75, options.depth ?? 61);
  return { scan, vignette };
}
