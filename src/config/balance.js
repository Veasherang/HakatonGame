/**
 * Глобальные параметры баланса.
 * Все скорости указаны в единицах за минуту реального времени смены.
 * Значения можно менять без правки логики — системы читают их отсюда.
 */
export const BALANCE = {
  design: { width: 1280, height: 800 },

  shift: {
    durationSec: 360,          // 6 минут на день
    energyMax: 100,
    energyRegenPerMin: 3.0,
    lowEnergy: 30,
    coffee: { cost: 200, energy: 24, limitPerShift: 3 },
    speeds: [1, 2],
  },

  economy: {
    startMoney: 1600,
    startBiomass: 18,
    startReputation: 50,
    baseSalary: 600,
    salaryPerReputation: 4,
    replacementCost: 2600,
    generatorCost: 1000,
    generatorPower: 45,
    emergencyCost: 0,
    maxReputation: 100,
  },

  power: {
    max: 100,
    drainBasePerMin: 2.0,
    drainPerUpgradePerMin: 0.1,
    blackoutStressPerMin: 1.4,
    blackoutIntegrityPerMin: 0.8,
    restartPower: 45,
  },

  creature: {
    hungerRate: 4.8,
    cleanlinessRate: 3.6,
    stressBase: 1.7,
    energyRate: 2.5,
    aggressionBase: 0.55,
    healthRegen: 0.9,
    healthDecay: 1.4,
    integrityBaseDecay: 0.28,
    loyaltyGain: 0.2,
    loyaltyLoss: 0.7,
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
    starvationDamage: 1.3,
    stressDamage: 1.1,
    // Пассивное производство биомассы существом (единиц за день).
    biomassPerShift: 1.2,
    maxLevel: 12,
    xpPerLevel: 120,
    rateChangeMin: 12,
    rateChangeMax: 24,
    slowChance: 0.08,
    fastMin: 1.35,
    fastMax: 1.95,
    slowModifier: 0.3,
    statSpeedMultiplier: 1.4,
  },

  difficulty: {
    perDay: 0.15,
    eventSpeedPerDay: 0.06,
    threatPerDay: 1.6,
    contractPerDay: 1.8,
    minIntervalScale: 0.4,
  },

  interference: {
    baseSeconds: 16,
  },

  maintenance: {
    normalMin: 90,
    normalMax: 120,
    halfInterval: 60,
    fastMin: 15,
    fastMax: 30,
    singleMin: 10,
    singleMax: 20,
    normalFactor: 0.78,
    timeout: 28,
    rewardMoney: 150,
    rewardRep: 2,
    penaltyMoney: 80,
    penaltyRep: 2,
    wireMin: 4,
    wireMax: 7,
    sampleMin: 3,
    sampleMax: 6,
  },

  training: {
    energyCost: 10,
    baseTime: 26,
    levelXp: 24,
    priceScale: 2.7,
  },

  cleaning: {
    cost: 80,
    energy: 6,
    amount: 30,
    stress: 2,
  },

  mutation: {
    // Сколько нажатий нужно до следующей стадии.
    clickTargets: [15, 28],
    energyCost: 12,
    stressPerClick: 0.45,
    aggressionPerClick: 0.25,
  },

  contract: {
    minDuration: 55,
    maxDuration: 150,
    minReadiness: 30,
    offersPerShift: 5,
    payScalePerDay: 0.08,
    payScalePerRep: 0.008,
    mutationPayBonus: 0.35,
    fatigueStress: 18,
    unseenRisk: 0.1,
  },

  threat: {
    alarmThreshold: 55,
    alarmCooldown: 12,
    countdownBase: 15,
    countdownPerAdaptation: 2.2,
    countdownPerSecurity: 2.2,
    countdownPerSensor: 0.9,
    effectiveToolStress: 20,
    effectiveToolAggression: 24,
    wrongToolStress: 12,
    wrongToolAggression: 15,
    escapeRepPenalty: 15,
    escapeMoneyPenalty: 500,
    escapeAdaptation: 1,
    escapeLoyaltyPenalty: 12,
    recaptureIntegrity: 25,
  },

  events: {
    firstDelay: 10,
    intervalMin: 14,
    intervalMax: 26,
    aiIntervalMin: 7,
    aiIntervalMax: 16,
  },

  save: {
    key: 'atd67_save_v1',
    version: 4,
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

/** Во сколько раз день сложнее первого. */
export const difficultyForDay = (day) =>
  1 + Math.max(0, (Number(day) || 1) - 1) * BALANCE.difficulty.perDay;

/** Ускорение таймеров событий/ИИ с каждым днём. */
export const intervalScaleForDay = (day) =>
  Math.max(
    BALANCE.difficulty.minIntervalScale,
    1 - Math.max(0, (Number(day) || 1) - 1) * BALANCE.difficulty.eventSpeedPerDay
  );

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
