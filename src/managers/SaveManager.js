/**
 * Сохранение прогресса в LocalStorage с проверкой целостности.
 * Класс не зависит от Phaser и может тестироваться в Node.
 */
import { BALANCE, clamp } from '../config/balance.js';

const REQUIRED_STAT_KEYS = ['hunger', 'stress', 'energy', 'health', 'aggression', 'cleanliness', 'integrity', 'loyalty'];

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export class SaveManager {
  constructor(storage = null) {
    this.storage =
      storage ||
      (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
    this.key = BALANCE.save.key;
    this.version = BALANCE.save.version;
  }

  hasSave() {
    return Boolean(this.readRaw());
  }

  readRaw() {
    try {
      return this.storage ? this.storage.getItem(this.key) : null;
    } catch (error) {
      console.warn('[Save] storage unavailable', error);
      return null;
    }
  }

  /** Загрузить и проверить сохранение. */
  load() {
    const raw = this.readRaw();
    if (!raw) return { ok: false, empty: true, error: 'Нет сохранения' };

    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      this.backupBroken(raw);
      return { ok: false, corrupted: true, error: 'Сохранение повреждено и не может быть прочитано' };
    }

    try {
      const state = this.normalize(data);
      return { ok: true, state };
    } catch (error) {
      this.backupBroken(raw);
      return { ok: false, corrupted: true, error: error.message };
    }
  }

  backupBroken(raw) {
    try {
      this.storage?.setItem(`${this.key}_broken`, raw);
      this.storage?.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }

  /** Проверка и нормализация структуры. */
  normalize(data) {
    if (!data || typeof data !== 'object') throw new Error('Некорректный формат сохранения');
    if (data.version !== this.version) {
      throw new Error(
        `Несовместимая версия сохранения (${data.version ?? '—'} вместо ${this.version})`
      );
    }
    if (!Array.isArray(data.creatures) || data.creatures.length !== 6) {
      throw new Error('Повреждён список существ');
    }
    for (const key of ['day', 'shift', 'money', 'biomass', 'reputation', 'operatorEnergy', 'power']) {
      if (!isNumber(data[key])) throw new Error(`Повреждено поле «${key}»`);
    }

    const state = { ...data };
    state.day = Math.max(1, Math.floor(state.day));
    state.shift = Math.max(1, Math.floor(state.shift));
    state.money = Math.max(0, state.money);
    state.biomass = Math.max(0, state.biomass);
    state.reputation = clamp(state.reputation);
    state.operatorEnergy = clamp(state.operatorEnergy);
    state.power = clamp(state.power, 0, BALANCE.power.max);
    state.shiftDuration = isNumber(state.shiftDuration)
      ? state.shiftDuration
      : BALANCE.shift.durationSec;
    state.shiftTimeLeft = clamp(
      isNumber(state.shiftTimeLeft) ? state.shiftTimeLeft : state.shiftDuration,
      0,
      state.shiftDuration
    );
    state.speed = [1, 2].includes(state.speed) ? state.speed : 1;
    state.phase = ['office', 'report', 'ended', 'escaping'].includes(state.phase)
      ? state.phase === 'escaping'
        ? 'office'
        : state.phase
      : 'office';
    state.camDown = state.camDown && typeof state.camDown === 'object' ? state.camDown : {};
    state.offers = Array.isArray(state.offers) ? state.offers : [];
    state.log = Array.isArray(state.log) ? state.log.slice(-80) : [];
    state.aiMessages = Array.isArray(state.aiMessages) ? state.aiMessages.slice(-40) : [];
    state.settings = { sound: true, ...(state.settings || {}) };
    state.stats = {
      shiftsDone: 0,
      contractsDone: 0,
      escapes: 0,
      moneyEarned: 0,
      moneySpent: 0,
      terminated: 0,
      ...(state.stats || {}),
    };
    state.meta = {
      unlockedEndings: [],
      bestDay: 1,
      runs: 1,
      ...(state.meta || {}),
    };
    state.plot = {
      notes: [],
      flags: {},
      evidence: 0,
      aiTrust: 50,
      shownNotes: [],
      ...(state.plot || {}),
    };
    state.alarm = state.alarm || null;
    state.alarmCooldown = isNumber(state.alarmCooldown) ? state.alarmCooldown : 0;
    state.nextEventIn = isNumber(state.nextEventIn) ? state.nextEventIn : 30;
    state.aiCooldown = isNumber(state.aiCooldown) ? state.aiCooldown : 20;
    state.coffeeUsed = isNumber(state.coffeeUsed) ? state.coffeeUsed : 0;
    state.blackout = Boolean(state.blackout);
    state.escape = null;
    state.shiftStats = {
      repStart: state.reputation,
      moneyStart: state.money,
      moneyEarned: 0,
      moneySpent: 0,
      moneyLost: 0,
      biomassEarned: 0,
      contracts: [],
      incidents: [],
      notes: [],
      salary: 0,
      ...(state.shiftStats || {}),
    };
    state.report = state.report || null;
    state.ending = state.ending || null;
    state.endingResult = state.endingResult || null;

    state.creatures = data.creatures
      .map((creature, index) => {
        if (!creature || typeof creature !== 'object') throw new Error('Повреждена запись существа');
        const normalized = { ...creature, slot: creature.slot || index + 1 };
        normalized.skills = normalized.skills && typeof normalized.skills === 'object' ? normalized.skills : {};
        normalized.upgrades = {
          armor: 0,
          sensors: 0,
          light: 0,
          feeder: 0,
          vent: 0,
          security: 0,
          ...(normalized.upgrades || {}),
        };
        normalized.flags = normalized.flags || {};
        normalized.adaptation = Math.max(0, normalized.adaptation || 0);
        normalized.stage = clamp(normalized.stage || 1, 1, 3);
        normalized.level = Math.max(1, normalized.level || 1);
        normalized.xp = Math.max(0, normalized.xp || 0);
        normalized.status = [
          'idle',
          'training',
          'contract',
          'escaped',
          'terminated',
          'empty',
        ].includes(normalized.status)
          ? normalized.status
          : 'idle';
        if (normalized.defId) {
          normalized.stats = normalized.stats || {};
          for (const key of REQUIRED_STAT_KEYS) {
            normalized.stats[key] = clamp(
              isNumber(normalized.stats[key]) ? normalized.stats[key] : 50
            );
          }
        }
        return normalized;
      })
      .sort((a, b) => a.slot - b.slot);

    if (state.creatures.length !== 6) throw new Error('Повреждены секторы бункера');
    return state;
  }

  save(state) {
    if (!state) return false;
    try {
      state.version = this.version;
      state.lastSaved = Date.now();
      const raw = JSON.stringify(state);
      this.storage?.setItem(this.key, raw);
      return true;
    } catch (error) {
      console.warn('[Save] failed', error);
      return false;
    }
  }

  clear() {
    try {
      this.storage?.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}
