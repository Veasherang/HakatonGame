/**
 * Глобальные параметры баланса.
 * Все скорости указаны в единицах за минуту реального времени смены.
 * Значения можно менять без правки логики — системы читают их отсюда.
 */
export const BALANCE = {
  design: { width: 1280, height: 800 },

  shift: {
    durationSec: 480,          // 8 минут; максимум по концепции — 10 минут
    energyMax: 100,
    energyRegenPerMin: 2.4,
    lowEnergy: 25,
    coffee: { cost: 70, energy: 24, limitPerShift: 3 },
    speeds: [1, 2],
  },

  economy: {
    startMoney: 1500,
    startBiomass: 15,
    startReputation: 50,
    baseSalary: 240,
    salaryPerReputation: 2.4,
    replacementCost: 900,
    generatorCost: 120,
    generatorPower: 45,
    emergencyCost: 0,
    maxReputation: 100,
  },

  power: {
    max: 100,
    drainBasePerMin: 0.8,
    drainPerUpgradePerMin: 0.06,
    blackoutStressPerMin: 0.9,
    blackoutIntegrityPerMin: 0.5,
    restartPower: 45,
  },

  creature: {
    hungerRate: 3.3,
    cleanlinessRate: 2.3,
    stressBase: 1.15,
    energyRate: 1.7,
    aggressionBase: 0.35,
    healthRegen: 0.75,
    healthDecay: 0.9,
    integrityBaseDecay: 0.15,
    loyaltyGain: 0.25,
    loyaltyLoss: 0.5,
    // Пороговые значения, после которых начинаются проблемы.
    hungerBad: 70,
    hungerCritical: 85,
    stressBad: 65,
    stressCritical: 85,
    cleanBad: 40,
    aggressionBad: 60,
    integrityBad: 55,
    integrityCritical: 30,
    energyLow: 22,
    starvationDamage: 0.9,
    stressDamage: 0.7,
    // Пассивное производство биомассы существом (единиц за смену).
    biomassPerShift: 1.2,
    maxLevel: 12,
    xpPerLevel: 120,
  },

  training: {
    energyCost: 8,
    baseTime: 26,
    levelXp: 24,
  },

  contract: {
    minDuration: 70,
    maxDuration: 190,
    minReadiness: 30,
    offersPerShift: 4,
    payScalePerDay: 0.06,
    payScalePerRep: 0.008,
    mutationPayBonus: 0.35,
    fatigueStress: 16,
    unseenRisk: 0.08,
  },

  threat: {
    alarmThreshold: 74,
    alarmCooldown: 40,       // секунд спокойствия после отбоя
    countdownBase: 26,
    countdownPerAdaptation: 3.2,
    countdownPerSecurity: 3.4,
    countdownPerSensor: 1.1,
    effectiveToolStress: 18,
    effectiveToolAggression: 22,
    wrongToolStress: 9,
    wrongToolAggression: 12,
    escapeRepPenalty: 8,
    escapeMoneyPenalty: 160,
    escapeAdaptation: 1,
    escapeLoyaltyPenalty: 8,
    recaptureIntegrity: 38,
  },

  events: {
    firstDelay: 42,
    intervalMin: 46,
    intervalMax: 82,
    aiIntervalMin: 38,
    aiIntervalMax: 66,
  },

  save: {
    key: 'atd67_save_v1',
    version: 3,
    autosaveSec: 15,
    legacyKeys: ['atd67_save'],
  },

  plot: {
    finalDay: 10,
    maxEscapesBeforeForcedEnding: 4,
    minReputationBeforeForcedEnding: 8,
  },
};

export const STAT_KEYS = [
  'hunger',
  'stress',
  'energy',
  'health',
  'aggression',
  'cleanliness',
  'integrity',
  'loyalty',
];

export const STAT_META = {
  hunger: { label: 'ГОЛОД', short: 'ГОЛ', color: 0xd9a04a, invert: true, icon: 'hunger' },
  stress: { label: 'СТРЕСС', short: 'СТР', color: 0xd8664a, invert: true, icon: 'stress' },
  energy: { label: 'ЭНЕРГИЯ', short: 'ЭН', color: 0x6fc7c9, invert: false, icon: 'energy' },
  health: { label: 'ЗДОРОВЬЕ', short: 'ЗДР', color: 0x6ad48a, invert: false, icon: 'health' },
  aggression: { label: 'АГРЕССИЯ', short: 'АГР', color: 0xd8503f, invert: true, icon: 'aggression' },
  cleanliness: { label: 'ЧИСТОТА', short: 'ЧИС', color: 0x9aa7b8, invert: false, icon: 'clean' },
  integrity: { label: 'КЛЕТКА', short: 'КЛТ', color: 0xf0c24a, invert: false, icon: 'cell' },
  loyalty: { label: 'ЛОЯЛЬНОСТЬ', short: 'ЛОЯ', color: 0xb58ed8, invert: false, icon: 'loyalty' },
};

export const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
