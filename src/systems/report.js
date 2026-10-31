/** Отчёты по дням и переход к следующему дню. */
import { BALANCE, clamp } from '../config/balance.js';
import { generateOffers } from './contracts.js';
import { biomassPerShift } from './creatures.js';
import { recapture } from './threat.js';

export function computeSalary(state) {
  return Math.round(
    BALANCE.economy.baseSalary + state.reputation * BALANCE.economy.salaryPerReputation
  );
}

export const REASON_TEXT = {
  time: 'День завершён по регламенту.',
  manual: 'День завершён досрочно оператором.',
  exhausted: 'Оператор потерял сознание от усталости. День провален.',
  escape: 'Побег существа. День провален.',
  blackout: 'Аварийное отключение питания. День прерван.',
};

export const FAILURE_REASONS = new Set(['escape', 'exhausted']);

/** Собрать отчёт по завершённому дню. */
export function buildReport(state, reason) {
  const stats = state.shiftStats;
  const failed = FAILURE_REASONS.has(reason);
  const salary = failed ? 0 : computeSalary(state);
  const production = failed
    ? 0
    : state.creatures
        .filter((creature) => creature.defId && ['idle', 'training'].includes(creature.status))
        .reduce((sum, creature) => sum + biomassPerShift(creature), 0);

  const earned = stats.moneyEarned + salary;
  const net = earned - stats.moneySpent - (stats.moneyLost || 0);

  return {
    day: state.day,
    shift: state.shift,
    failed,
    reason,
    reasonText: REASON_TEXT[reason] || 'День завершён.',
    salary,
    earned,
    spent: stats.moneySpent,
    penalties: stats.moneyLost || 0,
    net,
    money: state.money,
    repBefore: stats.repStart,
    repAfter: state.reputation,
    contracts: [...stats.contracts],
    incidents: [...stats.incidents],
    notes: [...stats.notes],
    biomass: Math.round((stats.biomassEarned + production) * 10) / 10,
    production: Math.round(production * 10) / 10,
    creatureStates: state.creatures
      .filter((creature) => creature.defId)
      .map((creature) => ({
        slot: creature.slot,
        name: creature.name,
        defId: creature.defId,
        stage: creature.stage,
        status: creature.status,
        health: Math.round(creature.stats.health),
        stress: Math.round(creature.stats.stress),
        hunger: Math.round(creature.stats.hunger),
        integrity: Math.round(creature.stats.integrity),
        loyalty: Math.round(creature.stats.loyalty),
        level: creature.level,
        escaped: creature.status === 'escaped',
      })),
    timeLeft: Math.round(state.shiftTimeLeft),
  };
}

/** Новый день. */
export function advanceDay(state, rng) {
  state.day += 1;
  state.shift = 1;
  state.shiftDuration = BALANCE.shift.durationSec;
  state.shiftTimeLeft = state.shiftDuration;
  state.operatorEnergy = BALANCE.shift.energyMax;
  state.power = clamp(state.power + 35, 0, BALANCE.power.max);
  state.alarm = null;
  state.alarmCooldown = 0;
  state.camDown = {};
  state.aiCooldown = 8;
  state.nextEventIn = 14;
  state.blackout = false;
  state.offers = generateOffers(state, rng);
  state.phase = 'office';
  state.report = null;
  state.escape = null;
  state.coffeeUsed = 0;
  state.operatorEffects = {};
  state.energyWarned = 0;

  for (const creature of state.creatures) {
    if (!creature.defId) continue;
    if (creature.status === 'escaped') recapture(creature);
    if (creature.status === 'contract' && creature.contract) {
      // Контракт может длиться дольше дня — он продолжается.
      creature.contract.endIn = Math.max(1, creature.contract.endIn);
    }
    if (creature.training && creature.training.timeLeft > 0) {
      creature.status = 'training';
    }
    creature.stats.hunger = clamp(creature.stats.hunger + 8);
    creature.stats.energy = clamp(creature.stats.energy + 12);
    creature.stats.stress = clamp(creature.stats.stress - 3);
    creature.stats.cleanliness = clamp(creature.stats.cleanliness + 4);
    creature.flags = {};
  }

  return state;
}
