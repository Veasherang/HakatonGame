/**
 * GameManager — центральный узел игры.
 * Хранит состояние, тикает симуляцию, применяет действия игрока,
 * управляет сменой, сохранениями и шиной событий для интерфейса.
 *
 * Модуль не импортирует Phaser и работает в Node (используется в тестах).
 */
import { BALANCE, clamp, difficultyForDay, intervalScaleForDay } from '../config/balance.js';
import {
  CREATURE_SHOP,
  EMPTY_SLOTS,
  getCreatureDef,
  getMutation,
  getSkillNode,
} from '../data/creatures.js';
import { getFood, foodsFor } from '../data/food.js';
import { UPGRADES, upgradeCost, maxIntegrity } from '../data/upgrades.js';
import { getCareTool } from '../data/tools.js';
import {
  acceptContract,
  generateOffers,
  tickContracts,
} from '../systems/contracts.js';
import {
  beginTraining,
  biomassPerShift,
  calmCreature,
  clickMutation as clickMutationProgress,
  completeTraining,
  createCreature,
  createEmptySlot,
  creatureDef,
  feedCreature,
  mutateCreature,
  mutationPercent,
  mutationRemaining,
  readiness,
  skillNodeState,
  tickCreature,
} from '../systems/creatures.js';
import { rollEvent } from '../systems/events.js';
import { rollAiLine, aiContractLine, aiAlarmLine, aiEscapeLine, aiBlackoutLine } from '../systems/ai.js';
import {
  adjustAiTrust,
  applyEnding,
  createPlot,
  evaluateEnding,
  markNoteShown,
  pendingNote,
  unlockNote,
} from '../systems/plot.js';
import { advanceDay, buildReport, computeSalary, FAILURE_REASONS } from '../systems/report.js';
import { defend as defendThreat, markEscaped, tickThreat } from '../systems/threat.js';
import { createRng } from '../utils/rand.js';
import { Emitter } from '../utils/emitter.js';
import { SaveManager } from './SaveManager.js';

const cloneState = (state) => JSON.parse(JSON.stringify(state));

function createShiftStats(state) {
  return {
    repStart: state.reputation,
    moneyStart: state.money,
    moneyEarned: 0,
    moneySpent: 0,
    moneyLost: 0,
    biomassEarned: 0,
    biomassSpent: 0,
    contracts: [],
    incidents: [],
    notes: [],
    salary: 0,
  };
}

export class GameManager {
  constructor({ storage = null } = {}) {
    this.bus = new Emitter();
    this.saveManager = new SaveManager(storage);
    this.rng = createRng(Date.now());
    this.state = null;
    this.acc = 0;
    this.paused = false;
    this.audio = null;
    this.lastSaveAt = 0;
  }

  /* ======================================================================
     Жизненный цикл
     ====================================================================== */

  createState(seed) {
    const creatures = [createCreature('bobek', 1)];
    const emptySlots = [
      [2, 'СЕКТОР 02', 'Протокол 02 закрыт. Субъект можно приобрести в питомнике.'],
      [3, 'СЕКТОР 03', 'Протокол 03 закрыт. Субъект можно приобрести в питомнике.'],
      [4, 'СЕКТОР 04', 'Протокол 04 закрыт. Субъект можно приобрести в питомнике.'],
      ...EMPTY_SLOTS.map((slot) => [slot.slot, slot.sector, slot.note]),
    ];
    for (const [slot, sector, note] of emptySlots) {
      creatures.push(createEmptySlot(slot, sector, note));
    }
    creatures.sort((a, b) => a.slot - b.slot);

    const state = {
      version: BALANCE.save.version,
      seed,
      createdAt: Date.now(),
      lastSaved: null,
      day: 1,
      shift: 1,
      shiftDuration: BALANCE.shift.durationSec,
      shiftTimeLeft: BALANCE.shift.durationSec,
      money: BALANCE.economy.startMoney,
      biomass: BALANCE.economy.startBiomass,
      reputation: BALANCE.economy.startReputation,
      operatorEnergy: BALANCE.shift.energyMax,
      power: BALANCE.power.max,
      speed: 1,
      phase: 'office',
      creatures,
      offers: [],
      log: [],
      aiMessages: [],
      alarm: null,
      alarmCooldown: 0,
      camDown: {},
      nextEventIn: BALANCE.events.firstDelay,
      aiCooldown: 10,
      autosaveTimer: 0,
      coffeeUsed: 0,
      energyWarned: 0,
      blackout: false,
      plot: createPlot(),
      stats: {
        shiftsDone: 0,
        daysDone: 0,
        contractsDone: 0,
        escapes: 0,
        moneyEarned: 0,
        moneySpent: 0,
        terminated: 0,
      },
      meta: {
        unlockedEndings: [],
        bestDay: 1,
        runs: 1,
      },
      shiftStats: null,
      report: null,
      escape: null,
      ending: null,
      endingResult: null,
      daySnapshot: null,
      settings: { sound: true },
    };

    state.shiftStats = createShiftStats(state);
    state.offers = generateOffers(state, this.rng);
    state.daySnapshot = this.captureDay(state);
    return state;
  }

  newGame(seed = Math.floor(Math.random() * 1_000_000_000)) {
    this.rng = createRng(seed);
    this.state = this.createState(seed);
    this.acc = 0;
    this.paused = false;
    this.lastSaveAt = 0;
    this.addLog('СИСТЕМА АТД-67 АКТИВИРОВАНА', 'sys');
    this.addLog('ДЕНЬ 01. ОПЕРАТОР ДОПУЩЕН. В БУНКЕРЕ ТОЛЬКО БОБЭК.', 'sys');
    this.addAi('ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР. ОСМОТРИ КАМЕРЫ. НЕ ОТКРЫВАЙ ЛИШНЕГО.');
    this.state.daySnapshot = this.captureDay(this.state);
    this.save(true);
    this.bus.emit('new-game', this.state);
    return this.state;
  }

  load() {
    const result = this.saveManager.load();
    if (!result.ok) return result;
    this.state = result.state;
    this.rng = createRng(result.state.seed || Date.now());
    this.acc = 0;
    this.paused = false;
    if (!this.state.daySnapshot) this.state.daySnapshot = this.captureDay(this.state);
    this.bus.emit('loaded', this.state);
    return result;
  }

  /** Снимок начала дня. Позволяет перезапустить день после поражения. */
  captureDay(state) {
    const copy = cloneState(state);
    copy.daySnapshot = null;
    copy.report = null;
    copy.ending = null;
    copy.endingResult = null;
    copy.escape = null;
    copy.phase = 'office';
    return copy;
  }

  restartDay() {
    const state = this.state;
    if (!state?.daySnapshot) return false;
    const meta = state.meta;
    const settings = state.settings;
    const snapshot = cloneState(state.daySnapshot);
    // Сохраняем только мета-прогресс и настройки; всё остальное — ровно как в начале дня.
    snapshot.meta = meta;
    snapshot.settings = settings;
    snapshot.daySnapshot = cloneState(state.daySnapshot);
    this.state = snapshot;
    this.acc = 0;
    this.paused = false;
    this.save(true);
    this.bus.emit('day-restart', this.state);
    return true;
  }

  hasSave() {
    return this.saveManager.hasSave();
  }

  save(force = false) {
    if (!this.state) return false;
    const now = Date.now();
    if (!force && now - this.lastSaveAt < 2500) return false;
    this.lastSaveAt = now;
    const ok = this.saveManager.save(this.state);
    if (ok) this.bus.emit('save', this.state.lastSaved);
    return ok;
  }

  reset() {
    this.saveManager.clear();
    this.state = null;
    this.acc = 0;
    this.bus.emit('reset');
  }

  setPaused(value) {
    this.paused = Boolean(value);
  }

  setSpeed(speed) {
    if (!this.state) return;
    if (!BALANCE.shift.speeds.includes(speed)) return;
    this.state.speed = speed;
    this.bus.emit('speed', speed);
  }

  /* ======================================================================
     Тик и симуляция
     ====================================================================== */

  tick(deltaMs) {
    const state = this.state;
    if (!state || state.phase !== 'office' || this.paused) return;
    const speed = state.speed || 1;
    this.acc += Math.min(deltaMs, 500) * speed;
    let guard = 0;
    while (this.acc >= 1000 && guard < 10) {
      this.acc -= 1000;
      guard += 1;
      this.advance(1);
      if (!this.state || this.state.phase !== 'office') break;
    }
    if (this.acc > 4000) this.acc = 0;
  }

  advance(dt) {
    const state = this.state;
    if (!state || state.phase !== 'office') return;

    state.shiftTimeLeft -= dt;
    if (state.shiftTimeLeft <= 0) {
      state.shiftTimeLeft = 0;
      this.endShift('time');
      return;
    }

    // Камеры, потерявшие сигнал.
    for (const key of Object.keys(state.camDown)) {
      state.camDown[key] = Math.max(0, state.camDown[key] - dt);
      if (state.camDown[key] <= 0) delete state.camDown[key];
    }

    this.updatePower(dt);
    state.operatorEnergy = clamp(
      state.operatorEnergy + (BALANCE.shift.energyRegenPerMin * dt) / 60,
      0,
      100
    );

    const messages = [];
    const difficulty = difficultyForDay(state.day);
    for (const creature of state.creatures) {
      tickCreature(
        creature,
        dt,
        { blackout: state.blackout, difficulty, random: () => this.rng.next() },
        messages
      );
      if (creature.training) {
        creature.training.timeLeft -= dt;
        if (creature.training.timeLeft <= 0) {
          const result = completeTraining(creature);
          if (result) {
            this.addLog(`${creature.name}: НАВЫК «${result.node.name}» ИЗУЧЕН`, 'good');
            if (result.levels > 0) {
              this.addLog(`${creature.name}: УРОВЕНЬ ПОВЫШЕН ДО ${creature.level}`, 'good');
            }
            this.bus.emit('creature', { slot: creature.slot });
          }
        }
      }
    }

    const completed = tickContracts(state, dt, this.rng);
    if (completed.length) this.handleContractResults(completed);
    if (this.state.phase !== 'office') return;

    const threatResult = tickThreat(state, dt, this.rng);
    if (threatResult?.alarm) this.handleAlarm(threatResult.creature);
    if (threatResult?.escape) {
      this.beginEscape(threatResult.escape);
      return;
    }

    state.nextEventIn -= dt;
    if (state.nextEventIn <= 0) {
      const event = rollEvent(state, this.rng);
      this.applyEvent(event);
      state.nextEventIn =
        this.rng.int(BALANCE.events.intervalMin, BALANCE.events.intervalMax) *
        intervalScaleForDay(state.day);
    }

    state.aiCooldown -= dt;
    if (state.aiCooldown <= 0) {
      const line = rollAiLine(state, this.rng);
      this.handleAiLine(line);
      state.aiCooldown =
        this.rng.int(BALANCE.events.aiIntervalMin, BALANCE.events.aiIntervalMax) *
        intervalScaleForDay(state.day);
    }

    for (const message of messages) {
      this.addLog(message.text, message.kind);
      this.bus.emit('creature', { slot: message.slot });
    }

    this.checkEnergyWarning();

    if (state.operatorEnergy <= 0) {
      this.endShift('exhausted');
      return;
    }

    state.autosaveTimer = (state.autosaveTimer || 0) + dt;
    if (state.autosaveTimer >= BALANCE.save.autosaveSec) {
      state.autosaveTimer = 0;
      this.save(true);
    }

    this.bus.emit('tick', state);
  }

  updatePower(dt) {
    const state = this.state;
    if (!state) return;
    let drain = BALANCE.power.drainBasePerMin;
    for (const creature of state.creatures) {
      const levels = Object.values(creature.upgrades || {}).reduce((sum, value) => sum + value, 0);
      drain += levels * BALANCE.power.drainPerUpgradePerMin;
    }
    state.power = clamp(state.power - (drain * dt) / 60, 0, BALANCE.power.max);

    if (state.power <= 0 && !state.blackout) {
      this.triggerBlackout();
    } else if (state.blackout && state.power >= 12) {
      state.blackout = false;
      this.addLog('ПИТАНИЕ СЕКТОРА ВОССТАНОВЛЕНО', 'good');
    }
  }

  triggerBlackout() {
    const state = this.state;
    if (!state) return;
    state.blackout = true;
    this.addLog('ОБЩЕЕ ОТКЛЮЧЕНИЕ ПИТАНИЯ. КАМЕРЫ НЕ РАБОТАЮТ.', 'danger');
    this.addAi(aiBlackoutLine(this.rng));
    for (const creature of state.creatures) {
      if (creature.defId) state.camDown[creature.slot] = 22;
    }
    adjustAiTrust(state, -1);
    this.bus.emit('blackout', true);
    this.save(true);
  }

  handleAiLine(line) {
    if (!this.state) return;
    this.addAi(line.text);
    if (line.camDown) {
      this.state.camDown[line.camDown.slot] = Math.max(
        this.state.camDown[line.camDown.slot] || 0,
        line.camDown.seconds
      );
      this.bus.emit('creature', { slot: line.camDown.slot });
    }
    if (line.stress && line.slot) {
      const creature = this.get(line.slot);
      if (creature?.stats) {
        creature.stats.stress = clamp(creature.stats.stress + line.stress);
        this.bus.emit('creature', { slot: line.slot });
      }
    }
  }

  /** Предупреждения о низкой энергии оператора. */
  checkEnergyWarning() {
    const state = this.state;
    if (!state) return;
    const energy = state.operatorEnergy;
    if (energy > 36) {
      state.energyWarned = 0;
      return;
    }
    if (energy <= 15 && (state.energyWarned || 0) < 2) {
      state.energyWarned = 2;
      this.addLog('КРИТИЧЕСКАЯ ЭНЕРГИЯ ОПЕРАТОРА. НУЖЕН КОФЕ.', 'danger');
      this.bus.emit('energy-low', { energy, level: 2 });
      return;
    }
    if (energy <= 30 && (state.energyWarned || 0) < 1) {
      state.energyWarned = 1;
      this.bus.emit('energy-low', { energy, level: 1 });
    }
  }

  /** Применить последствия случайного события. */
  applyEvent(event) {
    const state = this.state;
    if (!state || !event) return;
    const effects = event.effects || {};
    const active = state.creatures.filter((creature) =>
      ['idle', 'training'].includes(creature.status)
    );

    if (effects.power) {
      state.power = clamp(state.power + effects.power, 0, BALANCE.power.max);
      if (state.power <= 0) this.triggerBlackout();
      this.bus.emit('power', state.power);
    }
    if (effects.money) this.earn(effects.money);
    if (effects.biomass) this.addBiomass(effects.biomass);
    if (effects.rep) this.changeRep(effects.rep);
    if (effects.operatorEnergy) {
      state.operatorEnergy = clamp(state.operatorEnergy + effects.operatorEnergy);
      this.bus.emit('energy', state.operatorEnergy);
    }
    if (effects.stressAll) {
      for (const creature of active) {
        creature.stats.stress = clamp(creature.stats.stress + effects.stressAll);
      }
    }
    if (effects.cleanlinessAll) {
      for (const creature of active) {
        creature.stats.cleanliness = clamp(creature.stats.cleanliness + effects.cleanlinessAll);
      }
    }
    if (effects.stress) {
      const target = this.get(effects.stress.slot);
      if (target?.stats) target.stats.stress = clamp(target.stats.stress + effects.stress.value);
    }
    if (effects.integrity) {
      const target = this.get(effects.integrity.slot);
      if (target?.stats) target.stats.integrity = clamp(target.stats.integrity + effects.integrity.value);
    }
    if (effects.camDown) {
      state.camDown[effects.camDown.slot] = Math.max(
        state.camDown[effects.camDown.slot] || 0,
        effects.camDown.seconds
      );
      this.bus.emit('creature', { slot: effects.camDown.slot });
    }
    if (effects.memory && effects.defId) {
      state.plot.flags[`memory_${effects.defId}`] = true;
    }

    const kind =
      event.kind === 'good'
        ? 'good'
        : event.kind === 'plot'
          ? 'plot'
          : event.kind === 'warning'
            ? 'warning'
            : 'sys';
    this.addLog(`${event.title}: ${event.text}`, kind);
    this.bus.emit('event', event);
    this.refreshCreatureViews(active);
    this.save();
  }

  refreshCreatureViews(creatures) {
    for (const creature of creatures || this.state?.creatures || []) {
      if (creature.defId) this.bus.emit('creature', { slot: creature.slot });
    }
  }

  /* ======================================================================
     Действия игрока
     ====================================================================== */

  get(slot) {
    return this.state?.creatures.find((creature) => creature.slot === slot) || null;
  }

  def(slot) {
    const creature = this.get(slot);
    return creature?.defId ? getCreatureDef(creature.defId) : null;
  }

  readinessOf(slot) {
    const creature = this.get(slot);
    return creature?.defId ? readiness(creature) : 0;
  }

  usable(slot) {
    const creature = this.get(slot);
    if (!creature) return { ok: false, reason: 'Сектор не найден' };
    if (creature.status === 'empty') return { ok: false, reason: 'Сектор пуст' };
    if (creature.status === 'terminated') return { ok: false, reason: 'Существо утилизировано' };
    if (creature.status === 'escaped') return { ok: false, reason: 'Существо сбежало' };
    if (creature.status === 'contract') return { ok: false, reason: 'Существо на контракте' };
    if ((this.state?.camDown?.[slot] || 0) > 0) {
      return { ok: false, reason: 'ПОМЕХИ НА КАМЕРЕ. ВЗАИМОДЕЙСТВИЕ ЗАБЛОКИРОВАНО.' };
    }
    return { ok: true, creature };
  }

  spend(amount) {
    const state = this.state;
    if (!state) return false;
    if (amount <= 0) return true;
    if (state.money < amount) {
      this.notify(`Недостаточно средств: нужно ${amount} ₽`, 'danger');
      return false;
    }
    state.money -= amount;
    state.shiftStats.moneySpent += amount;
    state.stats.moneySpent += amount;
    this.bus.emit('money', state.money);
    return true;
  }

  earn(amount) {
    const state = this.state;
    if (!state || amount <= 0) return;
    state.money += amount;
    state.shiftStats.moneyEarned += amount;
    state.stats.moneyEarned += amount;
    this.bus.emit('money', state.money);
  }

  loseMoney(amount) {
    const state = this.state;
    if (!state || amount <= 0) return;
    state.money = Math.max(0, state.money - amount);
    state.shiftStats.moneyLost += amount;
    this.bus.emit('money', state.money);
  }

  useEnergy(amount) {
    const state = this.state;
    if (!state) return false;
    if (state.operatorEnergy < amount) {
      this.notify('Не хватает энергии оператора. Кофе или завершение дня.', 'danger');
      return false;
    }
    state.operatorEnergy = clamp(state.operatorEnergy - amount);
    this.bus.emit('energy', state.operatorEnergy);
    this.checkEnergyWarning();
    return true;
  }

  addBiomass(amount) {
    const state = this.state;
    if (!state || amount <= 0) return;
    state.biomass += amount;
    state.shiftStats.biomassEarned += amount;
    this.bus.emit('biomass', state.biomass);
  }

  changeRep(delta) {
    const state = this.state;
    if (!state) return;
    state.reputation = clamp(state.reputation + delta, 0, BALANCE.economy.maxReputation);
    this.bus.emit('reputation', state.reputation);
  }

  notify(text, kind = 'warning') {
    this.bus.emit('notice', { text, kind });
  }

  /** Вернуть деньги при отказе действия после оплаты. */
  refund(amount) {
    const state = this.state;
    if (!state || amount <= 0) return;
    state.money += amount;
    state.shiftStats.moneySpent = Math.max(0, state.shiftStats.moneySpent - amount);
    state.stats.moneySpent = Math.max(0, state.stats.moneySpent - amount);
    this.bus.emit('money', state.money);
  }

  addLog(text, kind = 'sys') {
    const state = this.state;
    if (!state) return;
    let message = text;
    // Часть сюжетных записей намеренно повреждена цензурой.
    if (kind === 'plot' && message.length > 24 && Math.random() < 0.4) {
      message = message.replace(/\b[А-Яа-яЁё]{5,}\b/g, (word) =>
        Math.random() < 0.22 ? '█'.repeat(word.length) : word
      );
    }
    const entry = {
      day: state.day,
      shift: state.shift,
      time: Math.max(0, Math.round(state.shiftTimeLeft)),
      text: message,
      kind,
    };
    state.log.push(entry);
    if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
    this.bus.emit('log', entry);
  }

  addAi(text) {
    const state = this.state;
    if (!state) return;
    const message = {
      day: state.day,
      time: Math.max(0, Math.round(state.shiftTimeLeft)),
      text,
    };
    state.aiMessages.push(message);
    if (state.aiMessages.length > 40) state.aiMessages.splice(0, state.aiMessages.length - 40);
    this.bus.emit('ai', message);
  }

  feed(slot, foodId) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const usable = this.usable(slot);
    if (!usable.ok) {
      this.notify(usable.reason, 'warning');
      return usable;
    }
    const creature = usable.creature;
    const def = this.def(slot);
    const food = getFood(foodId);
    if (!food) return { ok: false, reason: 'Неизвестная еда' };
    if (food.onlyFor && !food.onlyFor.includes(def.id)) {
      return { ok: false, reason: 'Это существо такое не ест' };
    }
    if (!this.spend(food.price)) return { ok: false, reason: 'Нет денег' };
    if (!this.useEnergy(4)) {
      this.refund(food.price);
      return { ok: false, reason: 'Нет энергии' };
    }

    const result = feedCreature(creature, food);
    this.addLog(`${def.name}: ${food.name} — ${result.preference === 'love' ? 'ЛЮБИМАЯ ЕДА' : result.preference === 'hate' ? 'НЕ ПРИНЯЛ' : 'ПОРЦИЯ'}`, result.preference === 'hate' ? 'warning' : 'good');
    this.bus.emit('creature', { slot });
    this.bus.emit('fx', { slot, text: result.preference === 'love' ? '♥' : '+', kind: 'feed' });
    this.save();
    return { ok: true, result };
  }

  calm(slot, toolId) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    if (state.alarm && state.alarm.slot === slot) return this.defend(slot, toolId);

    const usable = this.usable(slot);
    if (!usable.ok) {
      this.notify(usable.reason, 'warning');
      return usable;
    }
    const tool = getCareTool(toolId);
    if (!tool) return { ok: false, reason: 'Инструмент недоступен' };
    if (tool.cost && !this.spend(tool.cost)) return { ok: false, reason: 'Нет денег' };
    if (!this.useEnergy(tool.energy)) {
      if (tool.cost) this.refund(tool.cost);
      return { ok: false, reason: 'Нет энергии' };
    }

    const result = calmCreature(usable.creature, toolId);
    usable.creature.calmHistory = usable.creature.calmHistory || {};
    usable.creature.calmHistory[toolId] = result.kind;
    this.addLog(
      `${this.def(slot).name}: ${result.kind === 'good' ? 'УСПОКОЕН' : result.kind === 'bad' ? 'РАЗДРАЖЁН' : 'СЛАБАЯ РЕАКЦИЯ'} (${tool.short})`,
      result.kind === 'bad' ? 'warning' : 'sys'
    );
    this.bus.emit('creature', { slot });
    this.save();
    return { ok: true, result };
  }

  defend(slot, toolId) {
    const state = this.state;
    if (!state || state.phase !== 'office' || !state.alarm) {
      return { ok: false, reason: 'Тревоги нет' };
    }
    if (state.alarm.slot !== slot) return { ok: false, reason: 'Тревога в другом секторе' };
    if ((state.camDown[slot] || 0) > 0) {
      return { ok: false, reason: 'ПОМЕХИ НА КАМЕРЕ. СНАЧАЛА ВОССТАНОВИТЕ СВЯЗЬ.' };
    }
    const creature = this.get(slot);
    const tool = getCareTool(toolId);
    if (!creature || !tool) return { ok: false, reason: 'Недоступно' };

    if (tool.cost && !this.spend(tool.cost)) return { ok: false, reason: 'Нет денег' };
    if (!this.useEnergy(tool.energy)) {
      if (tool.cost) this.refund(tool.cost);
      return { ok: false, reason: 'Нет энергии' };
    }

    const result = defendThreat(state, creature, toolId);
    if (result.success) {
      this.changeRep(2);
      adjustAiTrust(state, 2);
      this.addLog(`ТРЕВОГА СНЯТА: ${creature.name}. ${tool.short} СРАБОТАЛ.`, 'good');
      this.bus.emit('alarm-cleared', { slot });
    } else {
      this.addLog(result.text, 'danger');
      this.bus.emit('alarm', state.alarm);
      if (result.expired) this.beginEscape(creature);
    }
    this.bus.emit('creature', { slot });
    this.save();
    return { ok: true, ...result };
  }

  train(slot, nodeId) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const usable = this.usable(slot);
    if (!usable.ok) {
      this.notify(usable.reason, 'warning');
      return usable;
    }
    const creature = usable.creature;
    const def = this.def(slot);
    const node = getSkillNode(def, nodeId);
    if (!node) return { ok: false, reason: 'Навык не найден' };
    if (!this.spend(node.cost)) return { ok: false, reason: 'Нет денег' };
    if (!this.useEnergy(BALANCE.training.energyCost)) {
      this.refund(node.cost);
      return { ok: false, reason: 'Нет энергии' };
    }

    const result = beginTraining(creature, nodeId);
    if (!result.ok) {
      this.refund(node.cost);
      this.notify(result.reason, 'warning');
      return result;
    }
    this.addLog(`${def.name}: НАЧАТО ОБУЧЕНИЕ «${node.name}» (${node.time} с)`, 'sys');
    this.bus.emit('creature', { slot });
    this.save();
    return { ok: true, node };
  }

  upgrade(slot, key) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const usable = this.usable(slot);
    if (!usable.ok) {
      this.notify(usable.reason, 'warning');
      return usable;
    }
    const upgrade = UPGRADES[key];
    if (!upgrade) return { ok: false, reason: 'Модуль не найден' };
    const creature = usable.creature;
    const level = creature.upgrades[key] || 0;
    if (level >= 3) return { ok: false, reason: 'Максимальный уровень' };
    const cost = upgradeCost(key, level);
    if (!this.spend(cost)) return { ok: false, reason: 'Нет денег' };
    if (!this.useEnergy(4)) {
      this.refund(cost);
      return { ok: false, reason: 'Нет энергии' };
    }

    creature.upgrades[key] = level + 1;
    if (key === 'armor') {
      creature.stats.integrity = clamp(creature.stats.integrity, 0, maxIntegrity(creature));
    }
    if (key === 'security' || key === 'sensors') {
      state.alarmCooldown = Math.max(state.alarmCooldown, 0);
    }
    this.addLog(`${creature.name}: ${upgrade.name} УЛУЧШЕН ДО ${level + 1}/3`, 'good');
    this.bus.emit('creature', { slot });
    this.save();
    return { ok: true, level: level + 1 };
  }

  /** Один клик по шкале мутации. */
  mutationClick(slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const usable = this.usable(slot);
    if (!usable.ok) {
      this.notify(usable.reason, 'warning');
      return usable;
    }
    const creature = usable.creature;
    const def = this.def(slot);
    if (creature.stage >= 3) return { ok: false, reason: 'Финальная стадия' };
    const result = clickMutationProgress(creature);
    if (!result.ok) return result;
    this.bus.emit('creature', { slot });
    this.bus.emit('mutation-progress', { slot, ...result });
    if (result.ready) {
      this.notify(`${def.name}: ШКАЛА МУТАЦИИ ЗАПОЛНЕНА. МОЖНО ЗАВЕРШИТЬ.`, 'good');
      this.addLog(`${def.name}: ШКАЛА МУТАЦИИ 100%. НУЖНА БИОМАССА ДЛЯ ПРЕВРАЩЕНИЯ.`, 'plot');
    }
    return result;
  }

  mutationInfo(slot) {
    const creature = this.get(slot);
    return {
      progress: mutationPercent(creature),
      remaining: mutationRemaining(creature),
      ready: mutationRemaining(creature) <= 0,
    };
  }

  /** Итог аварийной заявки обслуживания бункера. */
  resolveMaintenance(success, variant = 'wires') {
    const state = this.state;
    if (!state || state.phase !== 'office') return null;
    const cfg = BALANCE.maintenance;
    const label = variant === 'samples' ? 'СОРТИРОВКА ОБРАЗЦОВ' : 'ЭЛЕКТРОСЕТЬ';
    let moneyDelta = 0;
    let repDelta = 0;

    if (success) {
      moneyDelta = cfg.rewardMoney;
      repDelta = cfg.rewardRep;
      state.money += moneyDelta;
      state.stats.moneyEarned += moneyDelta;
      state.shiftStats.moneyEarned += moneyDelta;
      this.addLog(`ОБСЛУЖИВАНИЕ: ${label} — ИСПРАВНО. ПРЕМИЯ ${moneyDelta} ₽.`, 'good');
      this.addAi('СИСТЕМА ВОССТАНОВЛЕНА. ПРОДОЛЖАЙ РАБОТУ.');
    } else {
      moneyDelta = -Math.min(state.money, cfg.penaltyMoney);
      repDelta = -cfg.penaltyRep;
      state.money += moneyDelta;
      state.stats.moneySpent += Math.abs(moneyDelta);
      state.shiftStats.moneySpent += Math.abs(moneyDelta);
      this.addLog(`ОБСЛУЖИВАНИЕ: ${label} — ПРОВАЛ. ШТРАФ ${Math.abs(moneyDelta)} ₽.`, 'danger');
      this.addAi('ТЫ НЕ СПРАВИЛСЯ С СИСТЕМОЙ. ЭТО ЗАФИКСИРОВАНО.');
    }

    if (repDelta) this.changeRep(repDelta);
    this.bus.emit('money', state.money);
    const result = { success, variant, moneyDelta, repDelta, label };
    this.bus.emit('maintenance', result);
    this.save(true);
    return result;
  }

  /** Убрать помехи на камере после успешной мини-игры. */
  clearInterference(slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    if (!(state.camDown[slot] > 0)) return { ok: false, reason: 'Помех нет' };
    delete state.camDown[slot];
    this.addLog(`СЕКТОР ${slot}: ПОМЕХИ УСТРАНЕНЫ. СВЯЗЬ ВОССТАНОВЛЕНА.`, 'good');
    this.bus.emit('interference-cleared', { slot });
    this.bus.emit('creature', { slot });
    this.save();
    return { ok: true };
  }

  /** Купить существо в питомнике. */
  buyCreature(defId) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const offer = CREATURE_SHOP.find((item) => item.id === defId);
    if (!offer) return { ok: false, reason: 'Лот не найден' };
    if (offer.start) return { ok: false, reason: 'Уже в бункере' };
    const existing = state.creatures.find((item) => item.defId === defId);
    if (existing) return { ok: false, reason: 'Этот субъект уже куплен' };
    if (state.day < offer.unlockDay) {
      return { ok: false, reason: `Протокол откроется в день ${offer.unlockDay}` };
    }
    const slotCreature = this.get(offer.slot);
    if (!slotCreature || slotCreature.status !== 'empty') {
      return { ok: false, reason: 'Сектор занят' };
    }
    if (!this.spend(offer.price)) return { ok: false, reason: 'Нет денег' };

    const creature = createCreature(defId, offer.slot);
    creature.purchasedDay = state.day;
    const index = state.creatures.findIndex((item) => item.slot === offer.slot);
    state.creatures[index] = creature;
    state.plot.flags[`bought_${defId}`] = true;
    this.addLog(`ПИТОМНИК: СУБЪЕКТ ${offer.slot} ПРИНЯТ В БУНКЕР.`, 'good');

    if (defId === 'vodolazik') {
      state.plot.flags.vodolazik_revealed = true;
      this.addLog('СУБЪЕКТ 07 — ЧЕЛОВЕК. ЭКСПЕРИМЕНТЫ БОЛЬШЕ НЕ ОГРАНИЧЕНЫ ЖИВОТНЫМИ.', 'plot');
      this.addAi('ТЫ КУПИЛ ЧЕЛОВЕКА. ЭТО НЕ МЕНЯЕТ ПРОТОКОЛ. ТЫ ТОЖЕ МОЖЕШЬ СТАТЬ ЛОТОМ.');
      adjustAiTrust(state, -2);
    } else {
      this.addAi(`СУБЪЕКТ ${String(offer.slot).padStart(2, '0')} ДОБАВЛЕН В БУНКЕР. СЛЕДИ ЗА НИМ.`);
    }
    this.bus.emit('creature', { slot: offer.slot });
    this.bus.emit('shop', { defId, slot: offer.slot });
    this.save(true);
    return { ok: true, creature };
  }

  shopState() {
    const state = this.state;
    if (!state) return [];
    return CREATURE_SHOP.map((offer) => {
      const owned = state.creatures.some((creature) => creature.defId === offer.id);
      return {
        ...offer,
        owned,
        unlocked: offer.start || state.day >= offer.unlockDay,
        affordable: state.money >= offer.price,
        def: getCreatureDef(offer.id),
      };
    });
  }

  mutate(slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const usable = this.usable(slot);
    if (!usable.ok) {
      this.notify(usable.reason, 'warning');
      return usable;
    }
    const creature = usable.creature;
    const def = this.def(slot);
    const next = getMutation(def, creature.stage + 1);
    if (!next) return { ok: false, reason: 'Финальная стадия' };
    if (mutationRemaining(creature) > 0) {
      this.notify(`Шкала мутации не заполнена: осталось ${mutationRemaining(creature)} нажатий`, 'warning');
      return { ok: false, reason: 'Шкала мутации не заполнена' };
    }
    if (state.biomass < next.cost) {
      this.notify(`Нужно ${next.cost} биомассы`, 'danger');
      return { ok: false, reason: 'Мало биомассы' };
    }
    if (!this.useEnergy(BALANCE.mutation.energyCost)) return { ok: false, reason: 'Нет энергии' };

    state.biomass -= next.cost;
    state.shiftStats.biomassSpent += next.cost;
    const result = mutateCreature(creature);
    if (!result.ok) return result;

    this.addLog(`${def.name}: МУТАЦИЯ «${result.mutation.name}» (СТАДИЯ ${creature.stage})`, 'plot');
    this.addAi('БИОМАССА ПРИНЯТА. РЕЗУЛЬТАТ СООТВЕТСТВУЕТ ПРОТОКОЛУ.');
    this.bus.emit('creature', { slot, mutated: true });
    this.bus.emit('mutation', { slot, stage: creature.stage });
    this.save(true);
    return { ok: true, mutation: result.mutation };
  }

  /** Помыть существо и клетку: заметно повышает чистоту. */
  cleanCreature(slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const usable = this.usable(slot);
    if (!usable.ok) return usable;
    const creature = usable.creature;
    if (creature.stats.cleanliness >= 98) {
      return { ok: false, reason: 'Существо уже чистое' };
    }
    if (!this.spend(BALANCE.cleaning.cost)) return { ok: false, reason: 'Нет денег' };
    if (!this.useEnergy(BALANCE.cleaning.energy)) {
      this.refund(BALANCE.cleaning.cost);
      return { ok: false, reason: 'Нет энергии' };
    }
    creature.stats.cleanliness = clamp(creature.stats.cleanliness + BALANCE.cleaning.amount);
    creature.stats.stress = clamp(creature.stats.stress + BALANCE.cleaning.stress);
    creature.activity = 'ЧИСТИТСЯ';
    this.addLog(
      `${creature.name}: ПОМЫТ. ЧИСТОТА +${BALANCE.cleaning.amount}, СТРЕСС +${BALANCE.cleaning.stress}`,
      'good'
    );
    this.bus.emit('creature', { slot });
    this.save();
    return { ok: true };
  }

  repairCell(slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const usable = this.usable(slot);
    if (!usable.ok) return usable;
    const creature = usable.creature;
    if (creature.stats.integrity >= maxIntegrity(creature) - 1) {
      return { ok: false, reason: 'Клетка в порядке' };
    }
    if (!this.spend(460)) return { ok: false, reason: 'Нет денег' };
    if (!this.useEnergy(8)) {
      this.refund(460);
      return { ok: false, reason: 'Нет энергии' };
    }
    creature.stats.integrity = clamp(creature.stats.integrity + 18, 0, maxIntegrity(creature));
    this.addLog(`${creature.name}: КЛЕТКА ОТРЕМОНТИРОВАНА (+18)`, 'sys');
    this.bus.emit('creature', { slot });
    this.save();
    return { ok: true };
  }

  /** Отдых существа на лежанке: восстанавливает энергию и снижает стресс. */
  restCreature(slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const usable = this.usable(slot);
    if (!usable.ok) return usable;
    const creature = usable.creature;
    if ((creature.restCooldown || 0) > 0) {
      return { ok: false, reason: `Существо отдыхает ещё ${Math.ceil(creature.restCooldown)} с` };
    }
    if (!this.useEnergy(5)) return { ok: false, reason: 'Нет энергии' };
    creature.restCooldown = 45;
    creature.stats.energy = clamp(creature.stats.energy + 14);
    creature.stats.stress = clamp(creature.stats.stress - 6);
    creature.stats.hunger = clamp(creature.stats.hunger + 2);
    creature.stats.loyalty = clamp(creature.stats.loyalty + 0.4);
    creature.activity = 'ОТДЫХАЕТ';
    this.addLog(`${creature.name}: ОТДЫХ НА ЛЕЖАНКЕ. ЭНЕРГИЯ +14, СТРЕСС −6`, 'sys');
    this.bus.emit('creature', { slot });
    this.save();
    return { ok: true };
  }

  contractLimit() {
    const state = this.state;
    if (!state) return { total: 0, active: 0, max: 1, available: 0 };
    const total = state.creatures.filter((creature) => creature.defId).length;
    const active = state.creatures.filter((creature) => creature.status === 'contract').length;
    const max = Math.max(1, total - 1);
    return { total, active, max, available: Math.max(0, max - active) };
  }

  refillOffers() {
    const state = this.state;
    if (!state || state.offers.length >= 5) return state?.offers || [];
    const fresh = generateOffers(state, this.rng);
    const seen = new Set(state.offers.map((offer) => `${offer.companyId}:${offer.title}`));
    for (const offer of fresh) {
      const key = `${offer.companyId}:${offer.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      state.offers.push(offer);
      if (state.offers.length >= 5) break;
    }
    this.bus.emit('offers', state.offers);
    return state.offers;
  }

  acceptOffer(offerId, slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const offer = state.offers.find((item) => item.id === offerId);
    if (!offer) return { ok: false, reason: 'Предложение устарело' };
    const limit = this.contractLimit();
    if (limit.available <= 0) {
      return {
        ok: false,
        reason: `Лимит контрактов: ${limit.active}/${limit.max}. Верните существо из бункера.`,
      };
    }
    if ((state.camDown[slot] || 0) > 0) {
      this.notify('ПОМЕХИ НА КАМЕРЕ. СНАЧАЛА ВОССТАНОВИТЕ СВЯЗЬ.', 'danger');
      return { ok: false, reason: 'Помехи на камере' };
    }
    const creature = this.get(slot);
    const result = acceptContract(state, offer, creature, this.rng);
    if (!result.ok) {
      this.notify(result.reason || 'Нельзя отправить', 'warning');
      return result;
    }
    this.addLog(`${result.text}`, 'money');
    this.bus.emit('creature', { slot });
    this.bus.emit('offers', state.offers);
    this.save(true);
    return result;
  }

  buyCoffee() {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    if (state.coffeeUsed >= BALANCE.shift.coffee.limitPerShift) {
      this.notify('Больше кофе сегодня не будет', 'warning');
      return { ok: false, reason: 'Лимит кофе' };
    }
    if (!this.spend(BALANCE.shift.coffee.cost)) return { ok: false, reason: 'Нет денег' };
    state.coffeeUsed += 1;
    state.operatorEnergy = clamp(state.operatorEnergy + BALANCE.shift.coffee.energy);
    this.addLog('ОПЕРАТОР ВЫПИЛ КОФЕ. ЭНЕРГИЯ +24', 'sys');
    this.bus.emit('energy', state.operatorEnergy);
    this.save();
    return { ok: true };
  }

  restartGenerator() {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    if (!this.spend(BALANCE.economy.generatorCost)) return { ok: false, reason: 'Нет денег' };
    if (!this.useEnergy(5)) {
      this.refund(BALANCE.economy.generatorCost);
      return { ok: false, reason: 'Нет энергии' };
    }
    state.power = clamp(state.power + BALANCE.economy.generatorPower, 0, BALANCE.power.max);
    state.blackout = state.power < 12;
    state.camDown = {};
    this.addLog('ГЕНЕРАТОР ПЕРЕЗАПУЩЕН. ПИТАНИЕ +45', 'good');
    this.bus.emit('power', state.power);
    this.save();
    return { ok: true };
  }

  emergency(slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const creature = this.get(slot);
    if (!creature) return { ok: false, reason: 'Сектор не найден' };
    if (!['idle', 'training'].includes(creature.status)) {
      return { ok: false, reason: 'Протокол недоступен' };
    }
    const def = this.def(slot);
    creature.status = 'terminated';
    creature.contract = null;
    creature.training = null;
    creature.stats.health = 0;
    creature.stats.integrity = 0;
    creature.stats.aggression = 0;
    creature.stats.stress = 0;
    creature.stats.loyalty = 0;
    creature.activity = 'УТИЛИЗИРОВАН';
    state.stats.terminated += 1;
    if (state.alarm?.slot === slot) {
      state.alarm = null;
      state.alarmCooldown = 20;
      this.bus.emit('alarm-cleared', { slot });
    }
    this.changeRep(-3);
    this.addLog(`АВАРИЙНЫЙ ПРОТОКОЛ: ${def.name} ВЫВЕДЕН ИЗ ЭКСПЛУАТАЦИИ.`, 'danger');
    this.addAi('ПРОТОКОЛ ПРИНЯТ. ПРОГРЕСС СУБЪЕКТА УНИЧТОЖЕН.');
    this.bus.emit('creature', { slot });
    this.save(true);
    return { ok: true };
  }

  requestReplacement(slot) {
    const state = this.state;
    if (!state || state.phase !== 'office') return { ok: false };
    const creature = this.get(slot);
    if (!creature || creature.status !== 'terminated') {
      return { ok: false, reason: 'Замена недоступна' };
    }
    const defId = creature.defId;
    if (!defId) return { ok: false, reason: 'Неизвестный субъект' };
    if (!this.spend(BALANCE.economy.replacementCost)) return { ok: false, reason: 'Нет денег' };

    const upgrades = { ...creature.upgrades };
    const replacement = createCreature(defId, slot);
    replacement.upgrades = upgrades;
    const index = state.creatures.findIndex((item) => item.slot === slot);
    state.creatures[index] = replacement;

    this.addLog(`ЗАПРОШЕН НОВЫЙ СУБЪЕКТ В СЕКТОР ${slot}. КЛЕТКА СОХРАНИЛА ОБОРУДОВАНИЕ.`, 'plot');
    this.bus.emit('creature', { slot });
    this.save(true);
    return { ok: true };
  }

  /* ======================================================================
     Смена
     ====================================================================== */

  handleContractResults(results) {
    const state = this.state;
    if (!state) return;
    for (const result of results) {
      if (result.payout > 0) this.earn(result.payout);
      this.changeRep(result.repDelta);
      if (result.biomass > 0) this.addBiomass(result.biomass);
      if (['critical', 'success', 'partial'].includes(result.outcome)) {
        state.stats.contractsDone += 1;
      }
      state.shiftStats.contracts.push({
        slot: result.slot,
        name: result.name,
        title: result.contract.title,
        company: result.contract.companyName,
        outcome: result.outcome,
        payout: result.payout,
        day: state.day,
      });
      if (result.outcome === 'incident') {
        state.shiftStats.incidents.push({
          type: 'contract',
          slot: result.slot,
          name: result.name,
          text: `Потеря связи на объекте «${result.contract.title}»`,
        });
      }
      if (result.suspicion > 0.6 && ['critical', 'success'].includes(result.outcome)) {
        state.plot.evidence += 1;
        this.addLog('В ОТЧЁТЕ КОМПАНИИ ЕСТЬ СТРАННЫЕ ФРАГМЕНТЫ. ЭТО МОЖЕТ ПРИГОДИТЬСЯ.', 'plot');
      }
      adjustAiTrust(state, ['critical', 'success'].includes(result.outcome) ? 2 : -2);
      this.addLog(result.text, result.outcome === 'fail' || result.outcome === 'incident' ? 'danger' : 'money');
      if (result.changed) {
        this.addLog(`${result.name}: НЕОЖИДАННОЕ ИЗМЕНЕНИЕ. СТАДИЯ ${this.get(result.slot).stage}.`, 'plot');
      }
      if (result.levels > 0) this.addLog(`${result.name}: УРОВЕНЬ ${this.get(result.slot).level}`, 'good');
      this.addAi(aiContractLine(result.outcome, this.rng));
      this.bus.emit('contract-done', result);
      this.bus.emit('creature', { slot: result.slot });
    }
    this.refillOffers();
    this.save(true);
  }

  handleAlarm(creature) {
    const state = this.state;
    if (!state || !state.alarm) return;
    const def = creatureDef(creature);
    this.addLog(`ТРЕВОГА: СЕКТОР ${creature.slot} · ${def?.name || creature.name}. НУЖНО СДЕРЖИВАНИЕ.`, 'danger');
    this.addAi(aiAlarmLine(this.rng));
    adjustAiTrust(state, -2);
    state.shiftStats.incidents.push({
      type: 'alarm',
      slot: creature.slot,
      name: def?.name || creature.name,
      text: `Тревога в секторе ${creature.slot}`,
    });
    this.bus.emit('alarm', state.alarm);
  }

  beginEscape(creature) {
    const state = this.state;
    if (!state || state.phase !== 'office') return;
    const def = creatureDef(creature);
    markEscaped(creature);
    state.alarm = null;
    state.stats.escapes += 1;
    this.changeRep(-BALANCE.threat.escapeRepPenalty);
    this.loseMoney(BALANCE.threat.escapeMoneyPenalty);
    state.shiftStats.incidents.push({
      type: 'escape',
      slot: creature.slot,
      name: def?.name || creature.name,
      text: `Побег из сектора ${creature.slot}. Потеря контроля над камерой.`,
    });
    state.phase = 'escaping';
    state.escape = {
      slot: creature.slot,
      defId: creature.defId,
      name: def?.name || creature.name,
      stage: creature.stage,
      count: creature.escapedCount,
    };
    this.addLog(`${def?.name || creature.name} ПОКИНУЛ КЛЕТКУ. КОНТРОЛЬ ПОТЕРЯН.`, 'danger');
    this.addAi(aiEscapeLine(this.rng));
    adjustAiTrust(state, -6);
    this.save(true);
    this.bus.emit('escape', state.escape);
  }

  completeEscape() {
    if (!this.state || this.state.phase !== 'escaping') return null;
    return this.endShift('escape');
  }

  endShift(reason = 'manual') {
    const state = this.state;
    if (!state || !['office', 'escaping'].includes(state.phase)) return null;

    const failed = FAILURE_REASONS.has(reason);
    if (reason === 'exhausted') {
      this.changeRep(-3);
    }

    state.phase = 'report';
    state.alarm = null;
    state.escape = null;

    if (!failed) {
      const salary = computeSalary(state);
      state.money += salary;
      state.shiftStats.salary = salary;
      state.stats.moneyEarned += salary;
      this.bus.emit('money', state.money);

      // Пассивная биомасса от содержания существ.
      const production = state.creatures
        .filter((creature) => creature.defId && ['idle', 'training'].includes(creature.status))
        .reduce((sum, creature) => sum + biomassPerShift(creature), 0);
      state.biomass = Math.max(0, state.biomass + production);
      state.stats.shiftsDone += 1;
      state.stats.daysDone = (state.stats.daysDone || 0) + 1;
    } else {
      state.shiftStats.salary = 0;
    }

    state.report = buildReport(state, reason);
    state.ending = failed ? { final: false, failed: true } : evaluateEnding(state);

    this.save(true);
    this.bus.emit('day-end', { report: state.report, ending: state.ending });
    this.bus.emit('shift-end', { report: state.report, ending: state.ending });
    return state.report;
  }

  nextDay() {
    const state = this.state;
    if (!state || state.phase !== 'report') return false;
    advanceDay(state, this.rng);
    state.shiftStats = createShiftStats(state);
    state.daySnapshot = this.captureDay(state);
    this.acc = 0;
    this.paused = false;
    this.addLog(`ДЕНЬ ${state.day}. СЛОЖНОСТЬ ×${difficultyForDay(state.day).toFixed(2)}.`, 'sys');
    this.addAi(
      state.day > 6
        ? 'ТЫ ВСЁ ЕЩЁ ЗДЕСЬ. ЭТО ХОРОШО. НАВЕРНОЕ.'
        : 'НОВЫЙ ДЕНЬ. ПОКАЗАТЕЛИ ДОЛЖНЫ БЫТЬ В НОРМЕ.'
    );
    state.daySnapshot = this.captureDay(state);
    this.save(true);
    this.bus.emit('day-start', state);
    this.bus.emit('shift-start', state);
    return true;
  }

  /** Секретный пропуск ночи: сразу следующий день без отчёта. */
  skipNight() {
    const state = this.state;
    if (!state || state.phase === 'ended' || state.day >= BALANCE.plot.finalDay) return false;
    advanceDay(state, this.rng);
    state.shiftStats = createShiftStats(state);
    state.ending = null;
    state.endingResult = null;
    this.acc = 0;
    this.paused = false;
    this.addLog(`СЕКРЕТНЫЙ ПРОТОКОЛ: НОЧЬ ${state.day - 1} ПРОПУЩЕНА.`, 'plot');
    this.addAi('ПРОПУСК НОЧИ ПРИНЯТ. НЕ РАССКАЗЫВАЙ ОБ ЭТОМ.');
    state.daySnapshot = this.captureDay(state);
    this.save(true);
    this.bus.emit('day-start', state);
    this.bus.emit('shift-start', state);
    return true;
  }

  /** Совместимость со старыми вызовами. */
  nextShift() {
    return this.nextDay();
  }

  takePendingNote() {
    const state = this.state;
    if (!state) return null;
    const note = pendingNote(state);
    if (!note) return null;
    markNoteShown(state, note.id);
    unlockNote(state, note.id);
    this.addLog(`НАЙДЕНА ЗАПИСКА: ${note.title}`, 'plot');
    adjustAiTrust(state, -2);
    this.save(true);
    this.bus.emit('note', note);
    return note;
  }

  finishEnding(choiceId) {
    const state = this.state;
    if (!state) return null;
    const result = applyEnding(state, choiceId);
    this.save(true);
    this.bus.emit('ending', result);
    return result;
  }

  /** Быстрый доступ к еде для интерфейса. */
  foodsFor(slot) {
    const def = this.def(slot);
    return def ? foodsFor(def.id) : [];
  }

  /** Состояние исследования навыков для интерфейса. */
  skillState(slot, nodeId) {
    const creature = this.get(slot);
    if (!creature || !creature.defId) return { state: 'unknown' };
    return skillNodeState(creature, nodeId);
  }
}

export const game = new GameManager();
