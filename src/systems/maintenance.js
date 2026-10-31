/**
 * Планировщик аварийных заявок обслуживания.
 * Работает поверх любой игровой сцены: офис, комната, магазин, рынок.
 */
import { BALANCE } from '../config/balance.js';

const GAMEPLAY_SCENES = ['Office', 'Room', 'Market', 'Shop'];

/** Задержка до следующей заявки с учётом контрактов и состояния существ. */
export function nextMaintenanceDelay(state, random = Math.random) {
  const cfg = BALANCE.maintenance;
  if (!state) return cfg.normalMin;

  const owned = state.creatures.filter((creature) => creature.defId);
  const away = owned.filter((creature) => creature.status === 'contract');
  const total = owned.length;
  let min = cfg.normalMin;
  let max = cfg.normalMax;
  let applyNormalBonus = true;

  if (total === 1 && away.length === 1) {
    min = cfg.singleMin;
    max = cfg.singleMax;
    applyNormalBonus = false;
  } else if (total > 1) {
    if (away.length * 2 === total) {
      min = cfg.halfInterval;
      max = cfg.halfInterval;
      applyNormalBonus = false;
    } else if (away.length * 2 > total) {
      min = cfg.fastMin;
      max = cfg.fastMax;
      applyNormalBonus = false;
    }
  }

  if (applyNormalBonus) {
    const active = owned.filter(
      (creature) => creature.status === 'idle' || creature.status === 'training'
    );
    const normal =
      active.length > 0 &&
      active.every((creature) => {
        const s = creature.stats;
        return (
          s.hunger <= 65 &&
          s.stress <= 55 &&
          s.aggression <= 55 &&
          s.integrity >= 55 &&
          s.health >= 55 &&
          s.cleanliness >= 45 &&
          s.energy >= 25
        );
      });

    if (normal) {
      min = Math.max(cfg.fastMin, Math.round(min * cfg.normalFactor));
      max = Math.max(min + 5, Math.round(max * cfg.normalFactor));
    }
  }

  return min + random() * (max - min);
}

export class MaintenanceController {
  constructor(game) {
    this.game = game;
    this.timer = null;
    this.lastDay = null;
    this.lastAway = null;
    this.active = false;
    this.source = null;
  }

  ensure(state) {
    if (this.timer == null || this.lastDay !== state.day) {
      this.timer = nextMaintenanceDelay(state);
      this.lastDay = state.day;
      this.lastAway = this.awayCount(state);
    }
  }

  awayCount(state) {
    return state.creatures.filter(
      (creature) => creature.defId && creature.status === 'contract'
    ).length;
  }

  update(delta, game, activeKeys) {
    const manager = game.manager;
    const state = manager.state;
    if (!state) return;
    this.ensure(state);
    if (state.phase !== 'office' || manager.paused) return;
    if (activeKeys.includes('Maintenance') || activeKeys.includes('Modal')) return;

    if (state.alarm || Object.keys(state.camDown || {}).length > 0) {
      this.timer = Math.min(this.timer, 8);
      return;
    }

    const sourceKey = GAMEPLAY_SCENES.find((key) => activeKeys.includes(key));
    if (!sourceKey) return;

    const away = this.awayCount(state);
    if (away !== this.lastAway) {
      this.lastAway = away;
      this.timer = Math.min(this.timer, nextMaintenanceDelay(state));
    }

    this.timer -= delta / 1000;
    if (this.timer > 0) return;

    const source = game.scene.getScene(sourceKey);
    if (!source) return;
    this.launch(source, state);
  }

  launch(source, state) {
    if (this.active) return;
    this.active = true;
    this.source = source;
    this.timer = nextMaintenanceDelay(state);
    source.input.enabled = false;
    if (source.input.keyboard) source.input.keyboard.enabled = false;
    source.scene.launch('Maintenance', { sourceKey: source.scene.key });
  }

  onClosed() {
    const source = this.source;
    this.source = null;
    this.active = false;
    if (source?.input) {
      source.input.enabled = true;
      if (source.input.keyboard) source.input.keyboard.enabled = true;
    }
    const state = this.game.manager.state;
    if (state) {
      this.timer = Math.min(
        this.timer ?? nextMaintenanceDelay(state),
        nextMaintenanceDelay(state)
      );
    }
  }
}
