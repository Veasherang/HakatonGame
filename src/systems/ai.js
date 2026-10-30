/**
 * НАДЗОР — искусственный интеллект бункера.
 * Он даёт подсказки, врёт и постепенно меняет тон.
 */
import { AI_LINES, AI_EVENT_LINES, HORROR_LINES } from '../data/plot.js';

export function aiAct(day) {
  if (day <= 3) return 'early';
  if (day <= 6) return 'mid';
  return 'late';
}

/**
 * Плановая реплика ИИ. Иногда — ложь о состоянии существа,
 * с одновременным отключением камеры.
 */
export function rollAiLine(state, rng) {
  const lyingCandidate = state.creatures.find(
    (creature) =>
      ['idle', 'training'].includes(creature.status) &&
      creature.stats &&
      (creature.stats.stress > 72 || creature.stats.aggression > 65)
  );

  if (lyingCandidate && rng.chance(0.24)) {
    return {
      text: `ВНИМАНИЕ: СЕКТОР ${String(lyingCandidate.slot).padStart(2, '0')} ТРЕБУЕТ ПРОВЕРКИ.`,
      lie: false,
      camDown: null,
      slot: lyingCandidate.slot,
    };
  }

  // Чем ниже доверие к НАДЗОРУ, тем чаще он скрывает правду.
  const trust = state.plot?.aiTrust ?? 50;
  const lieChance = Math.max(0.15, Math.min(0.72, 0.2 + (100 - trust) / 220));

  if (lyingCandidate && rng.chance(lieChance)) {
    return {
      text: rng.pick(AI_LINES.lie),
      lie: true,
      camDown: { slot: lyingCandidate.slot, seconds: rng.int(9, 15) },
      slot: lyingCandidate.slot,
    };
  }

  const act = aiAct(state.day);
  return {
    text: rng.pick(AI_LINES[act]),
    lie: false,
    camDown: null,
    slot: null,
  };
}

export function aiContractLine(outcome, rng) {
  const pool =
    outcome === 'critical' || outcome === 'success'
      ? AI_EVENT_LINES.contractSuccess
      : AI_EVENT_LINES.contractFail;
  return rng.pick(pool);
}

export function aiAlarmLine(rng) {
  return rng.pick(AI_EVENT_LINES.alarm);
}

export function aiEscapeLine(rng) {
  return rng.pick(AI_EVENT_LINES.escape);
}

export function aiBlackoutLine(rng) {
  return rng.pick(AI_EVENT_LINES.blackout);
}

export function horrorLine(rng) {
  return rng.pick(HORROR_LINES);
}
