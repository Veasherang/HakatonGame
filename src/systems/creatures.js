/**
 * Система существ: создание, характеристики, обучение, кормление,
 * успокоение и мутации. Не зависит от Phaser и DOM.
 */
import { BALANCE, clamp, STAT_KEYS } from '../config/balance.js';
import {
  getCreatureDef,
  getMutation,
  getSkillNode,
  previousSkillNode,
  skillNodes,
} from '../data/creatures.js';
import { maxIntegrity } from '../data/upgrades.js';

export const UPGRADE_DEFAULT = {
  armor: 0,
  sensors: 0,
  light: 0,
  feeder: 0,
  vent: 0,
  security: 0,
};

/** Создание существа по шаблону. */
export function createCreature(defId, slotOverride = null) {
  const def = getCreatureDef(defId);
  if (!def) throw new Error(`Неизвестное существо: ${defId}`);
  return {
    slot: slotOverride ?? def.slot,
    defId: def.id,
    name: def.name,
    stage: 1,
    level: 1,
    xp: 0,
    mutationProgress: 0,
    mutationClicks: 0,
    stats: { ...def.base },
    upgrades: { ...UPGRADE_DEFAULT },
    skills: {},
    status: 'idle',
    training: null,
    contract: null,
    adaptation: 0,
    escapedCount: 0,
    lastFood: null,
    lastResult: null,
    calmHistory: {},
    restCooldown: 0,
    flags: {},
    activity: 'НАБЛЮДАЕТ',
  };
}

/** Пустой сектор (предусмотрен под будущих существ). */
export function createEmptySlot(slot, sector, note) {
  return {
    slot,
    defId: null,
    name: 'ПУСТО',
    sector,
    note,
    status: 'empty',
    stats: {},
    upgrades: { ...UPGRADE_DEFAULT },
    skills: {},
    stage: 0,
    level: 0,
    adaptation: 0,
  };
}

export const creatureDef = (creature) => (creature?.defId ? getCreatureDef(creature.defId) : null);

/** Суммарные эффекты выученных навыков. */
export function aggregateSkills(creature) {
  const mods = {
    contract: 0,
    income: 0,
    stressRate: 0,
    hungerRate: 0,
    cleanRate: 0,
    healthRegen: 0,
    integrityRate: 0,
    biomass: 0,
    readiness: 0,
    powerUse: 0,
    learned: 0,
  };
  const def = creatureDef(creature);
  if (!def) return mods;

  const nodes = skillNodes(def);
  for (const [nodeId, learned] of Object.entries(creature.skills || {})) {
    if (!learned) continue;
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) continue;
    mods.learned += 1;
    for (const [key, value] of Object.entries(node.effect || {})) {
      if (key in mods) mods[key] += Number(value) || 0;
    }
  }
  return mods;
}

export function learnedCount(creature) {
  return Object.values(creature.skills || {}).filter(Boolean).length;
}

/** Готовность к контракту (0–100). */
export function readiness(creature) {
  const def = creatureDef(creature);
  if (!def || !creature.stats) return 0;
  const mods = aggregateSkills(creature);
  const s = creature.stats;
  const value =
    s.health * 0.2 +
    s.energy * 0.1 +
    (100 - s.stress) * 0.17 +
    (100 - s.aggression) * 0.12 +
    s.loyalty * 0.13 +
    mods.readiness +
    learnedCount(creature) * 2.5 +
    (creature.stage - 1) * 4 +
    (creature.level - 1) * 2;
  return Math.round(clamp(value, 0, 100));
}

export const isReadyForContract = (creature) => readiness(creature) >= 60;

/** Общий бонус к контрактам от стадии и навыков. */
export function contractBonus(creature) {
  const mods = aggregateSkills(creature);
  return (
    Math.round(mods.contract) +
    (creature.stage - 1) * 4 +
    (creature.level - 1) * 2
  );
}

/** Множитель оплаты от мутаций и навыков. */
export function incomeMultiplier(creature) {
  const def = creatureDef(creature);
  const mods = aggregateSkills(creature);
  let multiplier = 1 + mods.income;
  if (creature.stage >= 2) multiplier += 0.15;
  if (creature.stage >= 3) multiplier += 0.2;
  if (def?.id === 'vodolazik' && creature.stage >= 3) multiplier += 0.1;
  return multiplier;
}

/** Текущее занятие для камеры и интерфейса. */
export function activityFor(creature) {
  if (!creature || !creature.stats) return 'ПУСТО';
  switch (creature.status) {
    case 'empty':
      return 'НЕТ СУБЪЕКТА';
    case 'terminated':
      return 'УТИЛИЗИРОВАН';
    case 'contract':
      return creature.contract ? `КОНТРАКТ: ${creature.contract.title}` : 'НА КОНТРАКТЕ';
    case 'training':
      return 'ОБУЧЕНИЕ';
    case 'escaped':
      return 'ПОБЕГ';
    default:
      break;
  }
  const s = creature.stats;
  if (s.stress >= 88) return 'ПАНИКА';
  if (s.aggression >= 78) return 'ГОТОВИТСЯ К ПОБЕГУ';
  if (s.hunger >= 82) return 'ИЩЕТ ЕДУ';
  if (s.health <= 25) return 'ЛЕЖИТ';
  if (s.energy <= 18) return 'СПИТ';
  if (s.cleanliness <= 30) return 'В ГРЯЗИ';
  if (s.stress >= 70) return 'БЬЁТСЯ О СТЕНУ';
  if (creature.stage >= 3) return 'НАБЛЮДАЕТ ЗА КАМЕРОЙ';
  return 'НАБЛЮДАЕТ';
}

/** Проверка состояния узла навыка. */
export function skillNodeState(creature, nodeId) {
  const def = creatureDef(creature);
  const node = getSkillNode(def, nodeId);
  if (!node) return { state: 'unknown', node: null };
  if (creature.skills[nodeId]) return { state: 'learned', node };
  if (creature.training?.nodeId === nodeId) return { state: 'training', node };
  const previous = previousSkillNode(def, node);
  if (previous && !creature.skills[previous.id]) return { state: 'locked', node, requires: previous };
  return { state: 'available', node };
}

/** Добавление опыта и повышение уровня. */
export function addXp(creature, amount) {
  const def = creatureDef(creature);
  if (!def) return { levels: 0 };
  creature.xp += Math.max(0, amount);
  let levels = 0;
  while (creature.level < BALANCE.creature.maxLevel) {
    const need = BALANCE.creature.xpPerLevel * creature.level;
    if (creature.xp < need) break;
    creature.xp -= need;
    creature.level += 1;
    levels += 1;
    creature.stats.health = clamp(creature.stats.health + 3);
    creature.stats.energy = clamp(creature.stats.energy + 5);
  }
  return { levels };
}

/**
 * Один шаг симуляции существа.
 * @param {object} creature
 * @param {number} dt секунды
 * @param {{blackout?: boolean, powerFactor?: number}} env
 * @param {Array<{text:string,kind:string,slot:number}>} messages
 */
export function tickCreature(creature, dt, env = {}, messages = []) {
  if (!creature || !creature.stats) return;
  if (!['idle', 'training'].includes(creature.status)) return;

  const def = creatureDef(creature);
  if (!def) return;

  // Отдых в комнате доступен после короткой паузы.
  if (creature.restCooldown > 0) {
    creature.restCooldown = Math.max(0, creature.restCooldown - dt);
  }

  const mods = aggregateSkills(creature);
  const upg = creature.upgrades || UPGRADE_DEFAULT;
  const s = creature.stats;
  const triggers = def.triggers || {};
  const minutes = dt / 60;
  const difficulty = Math.max(0.5, Number(env.difficulty) || 1);

  // --- Голод и чистота -----------------------------------------------------
  const hungerRate =
    BALANCE.creature.hungerRate * difficulty * (1 - upg.feeder * 0.09) * (1 - mods.hungerRate);
  s.hunger += hungerRate * minutes;

  const cleanRate =
    BALANCE.creature.cleanlinessRate *
    difficulty *
    (1 - upg.feeder * 0.06) *
    (1 - mods.cleanRate);
  s.cleanliness -= cleanRate * minutes;

  // --- Стресс --------------------------------------------------------------
  let stressRate = BALANCE.creature.stressBase;

  if (s.hunger > BALANCE.creature.hungerBad) {
    stressRate += 0.45 + ((s.hunger - BALANCE.creature.hungerBad) / 100) * 1.4;
  }
  if (s.hunger > BALANCE.creature.hungerCritical) stressRate += 0.5;
  if (s.cleanliness < BALANCE.creature.cleanBad) {
    stressRate += 0.35 + ((BALANCE.creature.cleanBad - s.cleanliness) / 100) * 0.8;
  }
  if (s.energy < BALANCE.creature.energyLow) stressRate += 0.3;
  if (s.integrity < BALANCE.creature.integrityBad) stressRate += 0.45;
  if (s.aggression > BALANCE.creature.aggressionBad) stressRate += 0.25;
  if (env.blackout) stressRate += BALANCE.power.blackoutStressPerMin;

  // Свет и вентиляция: кому-то помогают, кому-то мешают.
  if (upg.light > 0) {
    stressRate += (triggers.light >= 1 ? -0.18 : 0.3) * upg.light;
  }
  if (upg.vent > 0) {
    stressRate += (triggers.vent >= 1 ? -0.25 : 0.28) * upg.vent;
  }

  stressRate -= mods.stressRate;
  s.stress += stressRate * difficulty * minutes;

  // --- Энергия и агрессия --------------------------------------------------
  s.energy -= BALANCE.creature.energyRate * difficulty * minutes;
  if (creature.status === 'training') s.energy -= 0.8 * minutes;
  if (creature.status === 'training') s.stress += 0.25 * minutes;

  let aggressionRate = BALANCE.creature.aggressionBase;
  if (s.stress > 60) aggressionRate += ((s.stress - 60) / 100) * 1.5;
  if (s.hunger > 75) aggressionRate += 0.7;
  if (s.cleanliness < BALANCE.creature.cleanBad) aggressionRate += 0.4;
  if (s.integrity < BALANCE.creature.integrityBad) aggressionRate += 0.35;
  if (s.loyalty > 70) aggressionRate -= 0.25;
  s.aggression += aggressionRate * difficulty * minutes;

  // --- Здоровье ------------------------------------------------------------
  let healthDelta = 0;
  if (s.hunger > BALANCE.creature.hungerCritical) {
    healthDelta -= BALANCE.creature.starvationDamage * minutes;
  }
  if (s.stress > BALANCE.creature.stressCritical) {
    healthDelta -= BALANCE.creature.stressDamage * minutes;
  }
  if (s.hunger < 55 && s.stress < 55 && s.cleanliness > 45) {
    healthDelta += (BALANCE.creature.healthRegen + mods.healthRegen) * minutes;
  }
  s.health += healthDelta;

  // --- Целостность клетки --------------------------------------------------
  let decay = BALANCE.creature.integrityBaseDecay;
  if (s.stress > BALANCE.creature.stressBad) decay += 0.4;
  if (s.aggression > BALANCE.creature.aggressionBad) decay += 0.5;
  if (s.integrity < BALANCE.creature.integrityCritical) decay += 0.3;
  if (env.blackout) decay += BALANCE.power.blackoutIntegrityPerMin;
  decay *=
    (1 - upg.armor * 0.14) *
    (1 - upg.security * 0.08) *
    (1 - mods.integrityRate) *
    difficulty;
  s.integrity -= decay * minutes;
  if (s.stress < 42 && s.aggression < 42) {
    s.integrity += 0.18 * minutes;
  }

  // --- Лояльность ----------------------------------------------------------
  if (s.hunger < 55 && s.stress < 55 && s.health > 40) {
    s.loyalty += BALANCE.creature.loyaltyGain * minutes;
  } else if (s.hunger > 78 || s.stress > 78 || s.health < 30) {
    s.loyalty -= BALANCE.creature.loyaltyLoss * minutes;
  }

  // --- Ограничения ---------------------------------------------------------
  for (const key of STAT_KEYS) s[key] = clamp(s[key]);
  s.integrity = clamp(s.integrity, 0, maxIntegrity(creature));
  creature.stage = clamp(creature.stage, 1, 3);

  // --- Диагностические сообщения (без спама) -------------------------------
  const flags = creature.flags || (creature.flags = {});
  if (s.hunger >= BALANCE.creature.hungerCritical && !flags.starving) {
    flags.starving = true;
    messages.push({ slot: creature.slot, kind: 'danger', text: `${def.name}: КРИТИЧЕСКИЙ ГОЛОД` });
  } else if (s.hunger < 70) {
    flags.starving = false;
  }

  if (s.stress >= BALANCE.creature.stressCritical && !flags.panic) {
    flags.panic = true;
    messages.push({ slot: creature.slot, kind: 'danger', text: `${def.name}: СТРЕСС НА КРИТИЧЕСКОМ УРОВНЕ` });
  } else if (s.stress < 75) {
    flags.panic = false;
  }

  if (s.integrity <= BALANCE.creature.integrityCritical && !flags.cell) {
    flags.cell = true;
    messages.push({ slot: creature.slot, kind: 'danger', text: `${def.name}: ЦЕЛОСТНОСТЬ КЛЕТКИ НА КРИТИЧЕСКОМ УРОВНЕ` });
  } else if (s.integrity > 45) {
    flags.cell = false;
  }

  creature.activity = activityFor(creature);
}

/** Применение еды. Возвращает описание результата. */
export function feedCreature(creature, food) {
  const def = creatureDef(creature);
  if (!def || !creature.stats) return { ok: false, reason: 'Нет существа' };

  const preference =
    def.food.love === food.id ? 'love' : def.food.hate === food.id ? 'hate' : 'neutral';
  const s = creature.stats;
  const multiplier = preference === 'love' ? 1.18 : preference === 'hate' ? 0.55 : 1;

  s.hunger -= food.nutrition * multiplier;
  s.energy += food.energy * (preference === 'love' ? 1.2 : 1);
  s.health += food.health * (preference === 'love' ? 1.35 : preference === 'hate' ? 1.6 : 1);
  s.cleanliness += food.cleanliness;

  let stressDelta = food.stress;
  if (preference === 'love') {
    stressDelta -= 4;
    s.loyalty += 1.4;
  } else if (preference === 'hate') {
    stressDelta += 9;
    s.loyalty -= 2;
    s.aggression += 3;
  }
  s.stress += stressDelta;

  for (const key of STAT_KEYS) s[key] = clamp(s[key]);
  s.integrity = clamp(s.integrity, 0, maxIntegrity(creature));

  creature.lastFood = food.id;
  creature.activity = activityFor(creature);

  return {
    ok: true,
    preference,
    text:
      preference === 'love'
        ? `${def.name} доволен: любимая еда.`
        : preference === 'hate'
          ? `${def.name} недоволен: он это не ест.`
          : `${def.name} поел.`,
  };
}

/**
 * Успокоение / сдерживание конкретным инструментом.
 * Эффективность берётся из индивидуальных триггеров.
 */
export function calmCreature(creature, toolId) {
  const def = creatureDef(creature);
  if (!def || !creature.stats) return { ok: false, reason: 'Нет существа' };

  const multiplier = Number(def.triggers?.[toolId] ?? 0.9);
  const s = creature.stats;
  let kind = 'weak';

  if (multiplier >= 1.05) {
    kind = 'good';
    s.stress -= 12 * multiplier;
    s.aggression -= 10 * multiplier;
    s.loyalty += 0.6;
    s.integrity += 0.8;
  } else if (multiplier <= 0.68) {
    kind = 'bad';
    s.stress += 7;
    s.aggression += 5;
    s.integrity -= 0.6;
  } else {
    s.stress -= 4;
    s.aggression -= 3;
  }

  for (const key of STAT_KEYS) s[key] = clamp(s[key]);
  s.integrity = clamp(s.integrity, 0, maxIntegrity(creature));
  creature.activity = activityFor(creature);

  return {
    ok: true,
    kind,
    multiplier,
    text:
      kind === 'good'
        ? `${def.name} успокаивается.`
        : kind === 'bad'
          ? `${def.name} реагирует агрессивно. Это его раздражает.`
          : `${def.name} слегка успокаивается.`,
  };
}

/** Сколько нажатий нужно до следующей стадии. */
export function mutationTarget(creature) {
  const index = Math.max(0, Math.min(1, (creature?.stage || 1) - 1));
  return BALANCE.mutation.clickTargets[index] || 10;
}

export function mutationRemaining(creature) {
  const target = mutationTarget(creature);
  return Math.max(0, target - (creature?.mutationClicks || 0));
}

export function mutationPercent(creature) {
  const target = mutationTarget(creature);
  return Math.min(100, Math.round(((creature?.mutationClicks || 0) / target) * 100));
}

/**
 * Кликер мутации. Каждое нажатие двигает шкалу; стресс и агрессия слегка растут.
 * Финальное превращение запускается только когда шкала заполнена.
 */
export function clickMutation(creature) {
  if (!creature?.stats) return { ok: false, reason: 'Нет существа' };
  if (creature.stage >= 3) return { ok: false, reason: 'Финальная стадия' };
  const target = mutationTarget(creature);
  if ((creature.mutationClicks || 0) >= target) {
    return { ok: true, ready: true, progress: 100, remaining: 0 };
  }
  creature.mutationClicks = Math.min(target, (creature.mutationClicks || 0) + 1);
  creature.mutationProgress = Math.round((creature.mutationClicks / target) * 100);
  creature.stats.stress = clamp(
    creature.stats.stress + BALANCE.mutation.stressPerClick * (1 + creature.stage * 0.15)
  );
  creature.stats.aggression = clamp(
    creature.stats.aggression + BALANCE.mutation.aggressionPerClick * (1 + creature.stage * 0.15)
  );
  creature.activity = activityFor(creature);
  return {
    ok: true,
    ready: creature.mutationClicks >= target,
    progress: creature.mutationProgress,
    remaining: Math.max(0, target - creature.mutationClicks),
  };
}

/** Открытие следующей стадии мутации. */
export function mutateCreature(creature) {
  const def = creatureDef(creature);
  if (!def) return { ok: false, reason: 'Нет существа' };
  if (creature.stage >= 3) return { ok: false, reason: 'Достигнута финальная стадия' };
  if ((creature.mutationClicks || 0) < mutationTarget(creature)) {
    return { ok: false, reason: 'Шкала мутации не заполнена' };
  }

  const nextStage = creature.stage + 1;
  const mutation = getMutation(def, nextStage);
  if (!mutation) return { ok: false, reason: 'Мутация недоступна' };

  creature.stage = nextStage;
  creature.mutationClicks = 0;
  creature.mutationProgress = 0;
  for (const [key, value] of Object.entries(mutation.stat || {})) {
    creature.stats[key] = clamp((creature.stats[key] || 0) + value);
  }
  creature.stats.integrity = clamp(creature.stats.integrity, 0, maxIntegrity(creature));
  creature.activity = activityFor(creature);

  return { ok: true, mutation, text: `Мутация: ${mutation.name}` };
}

/** Запуск обучения (оплата выполняется менеджером). */
export function beginTraining(creature, nodeId) {
  const check = skillNodeState(creature, nodeId);
  if (check.state !== 'available') {
    return { ok: false, reason: check.state === 'locked' ? 'Сначала изучите предыдущий навык' : 'Навык недоступен' };
  }
  if (creature.status === 'contract') return { ok: false, reason: 'Существо на контракте' };
  if (creature.training) return { ok: false, reason: 'Уже идёт обучение' };

  const node = check.node;
  creature.training = { nodeId, timeLeft: node.time, total: node.time };
  creature.status = 'training';
  creature.activity = 'ОБУЧЕНИЕ';
  return { ok: true, node };
}

/** Завершение обучения (вызывается по таймеру). */
export function completeTraining(creature) {
  if (!creature.training) return null;
  const def = creatureDef(creature);
  const node = getSkillNode(def, creature.training.nodeId);
  creature.training = null;
  creature.status = 'idle';
  if (!node) return null;

  creature.skills[node.id] = true;

  // Мгновенные эффекты навыка.
  const effect = node.effect || {};
  if (effect.health) creature.stats.health = clamp(creature.stats.health + effect.health);
  if (effect.energy) creature.stats.energy = clamp(creature.stats.energy + effect.energy);
  if (effect.loyalty) creature.stats.loyalty = clamp(creature.stats.loyalty + effect.loyalty);

  const xp = addXp(creature, BALANCE.training.levelXp + node.cost * 0.02);
  creature.activity = activityFor(creature);
  return { node, levels: xp.levels };
}

/** Восстановление после контракта. */
export function applyContractResult(creature, result) {
  const s = creature.stats;
  if (!s) return;
  s.stress = clamp(s.stress + (result.stressDelta || 0));
  s.health = clamp(s.health + (result.healthDelta || 0));
  s.loyalty = clamp(s.loyalty + (result.loyaltyDelta || 0));
  s.hunger = clamp(s.hunger + (result.hungerDelta || 0));
  s.energy = clamp(s.energy + (result.energyDelta || 0));
  s.aggression = clamp(s.aggression + (result.aggressionDelta || 0));
  creature.status = 'idle';
  creature.contract = null;
  creature.activity = activityFor(creature);
}

/** Отдача от содержания: биомасса за смену. */
export function biomassPerShift(creature) {
  const def = creatureDef(creature);
  if (!def) return 0;
  const mods = aggregateSkills(creature);
  return (def.biomass || 1) * 0.25 + mods.biomass;
}
