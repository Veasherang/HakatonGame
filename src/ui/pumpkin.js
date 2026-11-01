/**
 * Декоративная тыква: случайный вариант, одинаковый визуальный размер
 * независимо от исходного разрешения спрайта.
 */
export function addPumpkin(scene, options = {}) {
  if (!scene.textures.exists('pumpkin_1')) return null;
  const variant = Phaser.Math.Between(1, 3);
  const key = `pumpkin_${variant}`;
  if (!scene.textures.exists(key)) return null;

  const image = scene.add.image(options.x ?? 0, options.y ?? 0, key);
  image.setOrigin(options.originX ?? 0.5, options.originY ?? 1);
  image.setDepth(options.depth ?? 0);
  image.setAlpha(options.alpha ?? 0.92);
  const targetHeight = Phaser.Math.Between(options.minHeight ?? 95, options.maxHeight ?? 120);
  image.setScale(targetHeight / image.height);
  if (options.flip ?? Math.random() < 0.5) image.setFlipX(true);
  return image;
}
