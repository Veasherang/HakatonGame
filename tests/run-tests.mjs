/**
 * Тесты игровой логики (без Phaser и браузера).
 * Запуск: node tests/run-tests.mjs
 */
import assert from 'node:assert/strict';
import { GameManager } from '../src/managers/GameManager.js';
import { BALANCE, clamp } from '../src/config/balance.js';
import { CREATURE_DEFS, EMPTY_SLOTS, getSkillNode, skillNodes } from '../src/data/creatures.js';
import { FOODS } from '../src/data/food.js';
import { COMPANY_LIST } from '../src/data/companies.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { NOTES, ENDINGS } from '../src/data/plot.js';
import { readiness } from '../src/systems/creatures.js';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

function fresh(seed = 1, storage = new MemoryStorage()) {
  const manager = new GameManager({ storage });
  manager.newGame(seed);
  return manager;
}

const activeCreatures = (manager) =>
  manager.state.creatures.filter((creature) => creature.defId);

/* ========================================================================== */

test('Новая партия: структура состояния', () => {
  const manager = fresh(42);
  const state = manager.state;
  assert.equal(state.day, 1);
  assert.equal(state.shift, 1);
  assert.equal(state.creatures.length, 6);
  assert.equal(state.creatures.filter((creature) => creature.defId).length, 4);
  assert.equal(state.creatures.filter((creature) => creature.status === 'empty').length, 2);
  assert.equal(state.offers.length, BALANCE.contract.offersPerShift);
  assert.equal(state.money, BALANCE.economy.startMoney);
  assert.equal(state.phase, 'office');
  for (const creature of state.creatures.filter((item) => item.defId)) {
    for (const key of ['hunger', 'stress', 'energy', 'health', 'aggression', 'cleanliness', 'integrity', 'loyalty']) {
      assert.ok(creature.stats[key] >= 0 && creature.stats[key] <= 100, `${creature.name}:${key}`);
    }
  }
});

test('Кормление тратит деньги и энергию, снижает голод', () => {
  const manager = fresh(7);
  const creature = manager.get(1);
  const hungerBefore = creature.stats.hunger;
  const moneyBefore = manager.state.money;
  const energyBefore = manager.state.operatorEnergy;
  const result = manager.feed(1, 'broth');
  assert.equal(result.ok, true);
  assert.ok(creature.stats.hunger < hungerBefore);
  assert.equal(manager.state.money, moneyBefore - FOODS.broth.price);
  assert.ok(manager.state.operatorEnergy < energyBefore);
  assert.equal(manager.state.shiftStats.moneySpent, FOODS.broth.price);
});

test('Любимая еда эффективнее нелюбимой', () => {
  const manager = fresh(8);
  const creature = manager.get(1);
  creature.stats.hunger = 100;
  manager.feed(1, 'dry');
  const afterHate = creature.stats.hunger;
  creature.stats.hunger = 100;
  manager.feed(1, 'broth');
  const afterLove = creature.stats.hunger;
  assert.ok(afterLove < afterHate);
});

test('Обучение: запуск, время и завершение', () => {
  const manager = fresh(11);
  const creature = manager.get(1);
  const node = skillNodes(CREATURE_DEFS.bobek)[0];
  const moneyBefore = manager.state.money;
  const result = manager.train(1, node.id);
  assert.equal(result.ok, true);
  assert.equal(creature.status, 'training');
  assert.ok(manager.state.money < moneyBefore);
  for (let index = 0; index < node.time + 2; index += 1) manager.advance(1);
  assert.equal(creature.status, 'idle');
  assert.equal(creature.skills[node.id], true);
});

test('Улучшение оборудования повышает уровень', () => {
  const manager = fresh(12);
  const creature = manager.get(1);
  const result = manager.upgrade(1, 'armor');
  assert.equal(result.ok, true);
  assert.equal(creature.upgrades.armor, 1);
  assert.ok(manager.state.money < BALANCE.economy.startMoney);
});

test('Мутация требует биомассу и меняет стадию', () => {
  const manager = fresh(13);
  const creature = manager.get(1);
  manager.state.biomass = 200;
  const result = manager.mutate(1);
  assert.equal(result.ok, true);
  assert.equal(creature.stage, 2);
  assert.equal(manager.state.biomass, 200 - CREATURE_DEFS.bobek.mutations[0].cost);
  const second = manager.mutate(1);
  assert.equal(second.ok, true);
  assert.equal(creature.stage, 3);
  const third = manager.mutate(1);
  assert.equal(third.ok, false);
});

test('Контракт: отправка, возвращение и учёт', () => {
  const manager = fresh(21);
  const offer = manager.state.offers[0];
  const creature = manager.get(1);
  for (const key of Object.keys(creature.stats)) creature.stats[key] = 100;
  creature.stats.hunger = 0;
  creature.stats.stress = 0;
  creature.stats.aggression = 0;
  const result = manager.acceptOffer(offer.id, 1);
  assert.equal(result.ok, true, result.reason);
  assert.equal(creature.status, 'contract');
  for (let index = 0; index < offer.duration + 2 && manager.state.phase === 'office'; index += 1) {
    manager.advance(1);
  }
  assert.equal(creature.status, 'idle');
  assert.equal(manager.state.shiftStats.contracts.length, 1);
  assert.ok(manager.state.stats.contractsDone >= 1);
});

test('Тревога перерастает в побег, смена завершается', () => {
  const manager = fresh(31);
  const creature = manager.get(1);
  creature.stats.stress = 100;
  creature.stats.aggression = 100;
  creature.stats.integrity = 15;
  let alarmSeen = false;
  for (let index = 0; index < 300; index += 1) {
    manager.advance(1);
    if (manager.state.alarm) alarmSeen = true;
    if (manager.state.phase !== 'office') break;
  }
  assert.equal(alarmSeen, true, 'тревога должна возникнуть');
  assert.equal(manager.state.phase, 'escaping');
  assert.equal(creature.status, 'escaped');
  assert.ok(manager.state.stats.escapes >= 1);
  const report = manager.completeEscape();
  assert.ok(report);
  assert.equal(manager.state.phase, 'report');
  assert.equal(report.reason, 'escape');
  assert.equal(manager.state.report.reason, 'escape');
});

test('Сдерживание снимает тревогу при верном инструменте', () => {
  const manager = fresh(32);
  const creature = manager.get(1);
  creature.stats.stress = 100;
  creature.stats.aggression = 100;
  creature.stats.integrity = 15;
  for (let index = 0; index < 120 && !manager.state.alarm; index += 1) manager.advance(1);
  assert.ok(manager.state.alarm);
  const result = manager.defend(1, 'light');
  assert.equal(result.ok, true);
  assert.equal(result.success, true);
  assert.equal(manager.state.alarm, null);
});

test('Сохранение и загрузка сохраняют прогресс', () => {
  const storage = new MemoryStorage();
  const manager = fresh(55, storage);
  manager.feed(1, 'porridge');
  manager.upgrade(1, 'feeder');
  manager.state.money = 4321;
  manager.save(true);

  const second = new GameManager({ storage });
  const result = second.load();
  assert.equal(result.ok, true);
  assert.equal(second.state.money, 4321);
  assert.equal(second.state.creatures[0].upgrades.feeder, 1);
  assert.equal(second.state.day, 1);
});

test('Повреждённое сохранение не ломает игру', () => {
  const storage = new MemoryStorage();
  storage.setItem(BALANCE.save.key, '{broken json');
  const manager = new GameManager({ storage });
  const result = manager.load();
  assert.equal(result.ok, false);
  assert.equal(result.corrupted, true);
  assert.equal(storage.getItem(BALANCE.save.key), null);
  assert.ok(storage.getItem(`${BALANCE.save.key}_broken`));
});

test('Смена: отчёт и переход к следующему дню', () => {
  const manager = fresh(66);
  const report = manager.endShift('manual');
  assert.ok(report);
  assert.equal(manager.state.phase, 'report');
  assert.ok(manager.state.report.salary > 0);
  assert.ok(manager.nextShift());
  assert.equal(manager.state.day, 2);
  assert.equal(manager.state.phase, 'office');
  assert.equal(manager.state.shiftTimeLeft, BALANCE.shift.durationSec);
  assert.equal(manager.state.offers.length, BALANCE.contract.offersPerShift);
});

test('Финальная развилка и концовка', () => {
  const manager = fresh(77);
  manager.state.day = BALANCE.plot.finalDay;
  manager.endShift('manual');
  assert.equal(manager.state.ending.final, true);
  const result = manager.finishEnding('servant');
  assert.equal(result.id, 'servant');
  assert.equal(manager.state.phase, 'ended');
  assert.ok(manager.state.meta.unlockedEndings.includes('servant'));
});

test('Аварийный протокол и замена существа', () => {
  const manager = fresh(88);
  manager.state.money = 5000;
  const result = manager.emergency(1);
  assert.equal(result.ok, true);
  assert.equal(manager.get(1).status, 'terminated');
  const replace = manager.requestReplacement(1);
  assert.equal(replace.ok, true);
  assert.equal(manager.get(1).status, 'idle');
  assert.equal(manager.get(1).stage, 1);
});

test('Все данные согласованы', () => {
  for (const [id, def] of Object.entries(CREATURE_DEFS)) {
    assert.equal(def.skills.length >= 2, true, `${id}: ветки навыков`);
    for (const branch of def.skills) {
      assert.equal(branch.nodes.length, 3, `${id}/${branch.id}`);
      for (const node of branch.nodes) {
        assert.ok(node.cost > 0 && node.time > 0);
        assert.ok(node.desc && node.name);
      }
    }
    assert.equal(def.mutations.length, 2);
    assert.ok(FOODS[def.food.love], `${id}: любимая еда`);
    assert.ok(FOODS[def.food.hate], `${id}: нелюбимая еда`);
    assert.ok(def.base);
    skillNodes(def).forEach((node) => assert.ok(getSkillNode(def, node.id)));
  }
  for (const company of COMPANY_LIST) {
    assert.ok(company.templates.length > 0);
    for (const template of company.templates) {
      assert.ok(template.basePay > 0 && template.duration > 0);
    }
  }
  assert.equal(NOTES.length, 8);
  assert.equal(Object.keys(ENDINGS).length, 5);
  assert.equal(EMPTY_SLOTS.length, 2);
  assert.equal(Object.keys(UPGRADES).length, 6);
});

test('Симуляция 10 смен: экономика не уходит в минус и не ломается', () => {
  const manager = fresh(2026);
  let totalContracts = 0;

  const bestTool = (def) => {
    let best = 'light';
    let bestValue = -1;
    for (const [tool, value] of Object.entries(def.triggers)) {
      if (tool === 'lock' || tool === 'power') continue;
      if (value > bestValue) {
        bestValue = value;
        best = tool;
      }
    }
    return best;
  };

  for (let day = 0; day < 10; day += 1) {
    for (let tick = 0; tick < 260 && manager.state.phase === 'office'; tick += 1) {
      manager.advance(1);

      if (tick % 20 !== 0 || manager.state.phase !== 'office') continue;

      for (const creature of activeCreatures(manager)) {
        const def = manager.def(creature.slot);
        if (creature.status !== 'idle') continue;

        if (creature.stats.hunger > 45 && manager.state.money > 200) {
          manager.feed(creature.slot, def.food.love);
        }
        if (creature.stats.stress > 50 && manager.state.operatorEnergy > 30) {
          manager.calm(creature.slot, bestTool(def));
        }
        if (creature.stats.integrity < 65 && manager.state.money > 300) {
          manager.repairCell(creature.slot);
        }
        if (creature.stats.energy < 30 && manager.state.operatorEnergy > 40) {
          manager.restCreature(creature.slot);
        }
      }

      for (const offer of [...manager.state.offers]) {
        const candidate = activeCreatures(manager).find(
          (creature) =>
            creature.status === 'idle' && readiness(creature) >= offer.reqReadiness
        );
        if (candidate) {
          const accepted = manager.acceptOffer(offer.id, candidate.slot);
          if (accepted.ok) totalContracts += 1;
        }
      }

      if (manager.state.operatorEnergy < 30) manager.buyCoffee();
    }

    if (manager.state.phase === 'office') manager.endShift('manual');
    assert.ok(manager.state.report, `отчёт дня ${day + 1}`);
    assert.ok(manager.state.money >= 0);
    for (const creature of activeCreatures(manager)) {
      for (const value of Object.values(creature.stats)) {
        assert.ok(Number.isFinite(value), `NaN в характеристиках ${creature.name}`);
        assert.ok(value >= 0 && value <= 100);
      }
    }
    if (manager.state.ending?.final) break;
    manager.nextShift();
  }

  assert.ok(totalContracts > 0, 'бот должен был заключить контракты');
  assert.ok(manager.state.stats.shiftsDone >= 1);
  assert.ok(manager.state.money < 1_000_000);
});

test('Проверка ограничений действий', () => {
  const manager = fresh(101);
  manager.state.operatorEnergy = 0;
  const result = manager.feed(1, 'gel');
  assert.equal(result.ok, false);
  assert.ok(manager.state.money <= BALANCE.economy.startMoney);

  const manager2 = fresh(102);
  manager2.state.money = 0;
  const upgrade = manager2.upgrade(1, 'armor');
  assert.equal(upgrade.ok, false);
  assert.equal(manager2.get(1).upgrades.armor, 0);
});

/* ========================================================================== */

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  if (result.ok) console.log(`  ✓ ${result.name}`);
  else {
    console.log(`  ✗ ${result.name}`);
    console.log(result.error?.stack || result.error);
  }
}
console.log(`\n${results.length - failed.length}/${results.length} тестов пройдено`);
if (failed.length) process.exit(1);
