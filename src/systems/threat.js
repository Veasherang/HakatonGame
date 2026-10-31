/**
 * Система угроз: накопление риска, тревоги, средства сдерживания и побеги.
 */
import { BALANCE, clamp } from '../config/balance.js';
import { getCareTool } from '../data/tools.js';
import { creatureDef } from './creatures.js';

/** Насколько близко существо к побегу. */
export function threatScore(creature) {
  if (!creature?.stats) return 0;
  const s = creature.stats;
  const upg = creature.upgrades || {};
  const value =
    s.stress * 0.55 +
    s.aggression * 0.65 +
    (100 - s.integrity) * 0.5 +
    (creature.adaptation || 0) * 3 -
    (upg.security || 0) * 3.2 -
    (upg.sensors || 0) * 1.4;
  return Math.round(clamp(value, 0, 160));
}

export function alarmThreshold(creature, day = 1) {
  return Math.max(42, BALANCE.threat.alarmThreshold - (Math.max(1, day) - 1) * BALANCE.difficulty.threatPerDay);
}

/** Длительность окна реакции при тревоге. */
export function alarmCountdown(creature) {
  const upg = creature.upgrades || {};
  const seconds =
    BALANCE.threat.countdownBase -
    (creature.adaptation || 0) * BALANCE.threat.countdownPerAdaptation +
    (upg.security || 0) * BALANCE.threat.countdownPerSecurity +
    (upg.sensors || 0) * BALANCE.threat.countdownPerSensor;
  return Math.round(clamp(seconds, 11, 45));
}

export function canRaiseAlarm(creature, day = 1) {
  return (
    creature &&
    ['idle', 'training'].includes(creature.status) &&
    threatScore(creature) >= alarmThreshold(creature, day)
  );
}

/** Запуск тревоги. */
export function startAlarm(state, creature) {
  const def = creatureDef(creature);
  const countdown = alarmCountdown(creature);
  state.alarm = {
    slot: creature.slot,
    defId: creature.defId,
    name: def?.name || creature.name,
    countdown,
    initial: countdown,
    threat: threatScore(creature),
  };
  return state.alarm;
}

/**
 * Один шаг тревожной системы.
 * @returns {{escape?: object}|null}
 */
export function tickThreat(state, dt, rng) {
  if (!state.alarm) {
    if (state.alarmCooldown > 0) {
      state.alarmCooldown = Math.max(0, state.alarmCooldown - dt);
      return null;
    }
    if (state.shiftTimeLeft > state.shiftDuration - 15) return null;

    for (const creature of state.creatures) {
      if (!['idle', 'training'].includes(creature.status)) continue;
      if (!canRaiseAlarm(creature, state.day)) continue;
      // Риск реализуется не мгновенно: у игрока есть несколько секунд до тревоги.
      if (rng.chance(0.2 * dt)) {
        startAlarm(state, creature);
        return { alarm: state.alarm, creature };
      }
    }
    return null;
  }

  const creature = state.creatures.find((item) => item.slot === state.alarm.slot);
  if (!creature || !['idle', 'training'].includes(creature.status)) {
    state.alarm = null;
    return null;
  }

  state.alarm.countdown -= dt;
  if (state.alarm.countdown <= 0) {
    return { escape: creature };
  }
  return null;
}

/** Попытка сдерживания. */
export function defend(state, creature, toolId) {
  if (!state.alarm || state.alarm.slot !== creature.slot) {
    return { ok: false, reason: 'Тревога уже снята' };
  }
  const def = creatureDef(creature);
  const tool = getCareTool(toolId);
  if (!def || !tool) return { ok: false, reason: 'Инструмент недоступен' };

  const multiplier = Number(def.triggers?.[toolId] ?? 0.9);
  const s = creature.stats;

  if (multiplier >= 1.05) {
    state.alarm = null;
    state.alarmCooldown = BALANCE.threat.alarmCooldown;
    s.stress = clamp(s.stress - 18);
    s.aggression = clamp(s.aggression - 22);
    s.loyalty = clamp(s.loyalty + 1.5);
    s.integrity = clamp(s.integrity + 2);
    return {
      ok: true,
      success: true,
      kind: 'good',
      text: `Тревога снята. ${def.name} успокаивается.`,
    };
  }

  if (multiplier <= 0.68) {
    state.alarm.countdown -= 6;
    s.stress = clamp(s.stress + 9);
    s.aggression = clamp(s.aggression + 8);
    s.integrity = clamp(s.integrity - 2.5);
    return {
      ok: true,
      success: false,
      kind: 'bad',
      pulse: true,
      text: `Неверное воздействие! ${def.name} приходит в ярость.`,
      expired: state.alarm && state.alarm.countdown <= 0,
    };
  }

  state.alarm.countdown -= 2;
  s.stress = clamp(s.stress - 5);
  s.aggression = clamp(s.aggression - 4);
  return {
    ok: true,
    success: false,
    kind: 'weak',
    text: `Слабое воздействие. ${def.name} колеблется.`,
    expired: state.alarm && state.alarm.countdown <= 0,
  };
}

/** Пометить существо сбежавшим. */
export function markEscaped(creature) {
  creature.status = 'escaped';
  creature.escapedCount = (creature.escapedCount || 0) + 1;
  creature.adaptation = (creature.adaptation || 0) + BALANCE.threat.escapeAdaptation;
  creature.stats.stress = clamp(creature.stats.stress - 25);
  creature.stats.aggression = clamp(creature.stats.aggression + 10);
  creature.stats.integrity = 0;
  creature.activity = 'ПОБЕГ';
}

/** Вернуть сбежавшее существо в клетку между сменами. */
export function recapture(creature) {
  if (creature.status !== 'escaped') return;
  creature.status = 'idle';
  creature.stats.integrity = BALANCE.threat.recaptureIntegrity;
  creature.stats.stress = clamp(creature.stats.stress + 10);
  creature.stats.loyalty = clamp(creature.stats.loyalty - BALANCE.threat.escapeLoyaltyPenalty);
  creature.stats.health = clamp(creature.stats.health - 5);
  creature.activity = 'НАБЛЮДАЕТ';
}

/** Описание реакции существа на инструмент (для подсказок в комнате). */
export function toolReaction(creature, toolId) {
  const def = creatureDef(creature);
  if (!def) return 'unknown';
  const multiplier = Number(def.triggers?.[toolId] ?? 0.9);
  if (multiplier >= 1.05) return 'good';
  if (multiplier <= 0.68) return 'bad';
  return 'weak';
}
