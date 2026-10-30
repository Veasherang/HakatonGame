/**
 * Оборудование клетки. Три уровня на каждый модуль.
 * Все эффекты читаются системами и отображаются в интерфейсе.
 */
export const UPGRADE_MAX_LEVEL = 3;

export const UPGRADES = {
  armor: {
    id: 'armor',
    name: 'БРОНЯ КЛЕТКИ',
    short: 'БРОНЯ',
    icon: 'armor',
    costs: [300, 640, 1200],
    color: 0x8a9aa8,
    effect: 'Замедляет разрушение клетки.',
    effectText: (level) => `Целостность падает на ${Math.round(level * 14)}% медленнее.`,
  },
  sensors: {
    id: 'sensors',
    name: 'ДАТЧИКИ',
    short: 'ДАТЧИКИ',
    icon: 'sensor',
    costs: [260, 540, 980],
    color: 0x6fc7c9,
    effect: 'Раннее предупреждение о побеге.',
    effectText: (level) => `+${(level * 1.1).toFixed(1)} с на реакцию и меньше лжи НАДЗОРА.`,
  },
  light: {
    id: 'light',
    name: 'ОСВЕЩЕНИЕ',
    short: 'СВЕТ',
    icon: 'lamp',
    costs: [220, 460, 860],
    color: 0xf0c24a,
    effect: 'Стабильный свет. Не всем существам нравится.',
    effectText: (level) => `Стресс −${(level * 0.18).toFixed(2)}/мин, но светочувствительные страдают (+${(level * 0.3).toFixed(2)}/мин).`,
  },
  feeder: {
    id: 'feeder',
    name: 'КОРМУШКА',
    short: 'КОРМ',
    icon: 'bowl',
    costs: [240, 480, 900],
    color: 0xd9a04a,
    effect: 'Автоматическая подкормка и меньше отходов.',
    effectText: (level) => `Голод растёт на ${level * 9}% медленнее; чистота падает на ${level * 6}% медленнее.`,
  },
  vent: {
    id: 'vent',
    name: 'ВЕНТИЛЯЦИЯ',
    short: 'ВЕНТ',
    icon: 'vent',
    costs: [280, 520, 940],
    color: 0x6fa8b8,
    effect: 'Свежий воздух и контроль влажности.',
    effectText: (level) => `Стресс −${(level * 0.22).toFixed(2)}/мин; для чувствительных к воздуху — сильнее.`,
  },
  security: {
    id: 'security',
    name: 'СДЕРЖИВАНИЕ',
    short: 'СДЕРЖ',
    icon: 'shield',
    costs: [380, 720, 1250],
    color: 0xb58ed8,
    effect: 'Двери, замки и аварийные протоколы.',
    effectText: (level) => `+${(level * 3.4).toFixed(1)} с на реакцию при тревоге, клетка прочнее.`,
  },
};

export const UPGRADE_KEYS = Object.keys(UPGRADES);
export const getUpgrade = (key) => UPGRADES[key] || null;

export const upgradeCost = (key, level) => {
  const def = UPGRADES[key];
  if (!def) return Infinity;
  return level >= UPGRADE_MAX_LEVEL ? Infinity : def.costs[level];
};

export const maxIntegrity = (creature) =>
  Math.min(100, 100 + (creature?.upgrades?.armor || 0) * 2);
