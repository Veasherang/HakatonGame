/**
 * Тесты игровой логики (без Phaser и браузера).
 * Запуск: node tests/run-tests.mjs
 */
import assert from 'node:assert/strict';
import { GameManager } from '../src/managers/GameManager.js';
import { BALANCE, clamp } from '../src/config/balance.js';
import { CREATURE_SHOP, CREATURE_DEFS, EMPTY_SLOTS, getMutation, getSkillNode, skillNodes } from '../src/data/creatures.js';
import { FOODS } from '../src/data/food.js';
import { COMPANY_LIST } from '../src/data/companies.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { NOTES, ENDINGS } from '../src/data/plot.js';
import { readiness } from '../src/systems/creatures.js';
import { nextMaintenanceDelay } from '../src/systems/maintenance.js';

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
  assert.equal(state.creatures.filter((creature) => creature.defId).length, 1);
  assert.equal(state.creatures.filter((creature) => creature.status === 'empty').length, 5);
  assert.equal(state.creatures[0].defId, 'bobek');
  assert.equal(state.offers.length, BALANCE.contract.offersPerShift);
  assert.equal(state.money, BALANCE.economy.startMoney);
  assert.equal(state.phase, 'office');
  assert.ok(state.daySnapshot, 'снимок дня создан');
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

test('Кликер мутации заполняет шкалу и меняет стадию', () => {
  const manager = fresh(13);
  const creature = manager.get(1);
  manager.state.biomass = 400;
  assert.equal(manager.mutate(1).ok, false, 'без кликов мутация недоступна');
  for (let index = 0; index < 15; index += 1) manager.mutationClick(1);
  const info = manager.mutationInfo(1);
  assert.equal(info.progress, 100);
  assert.equal(info.remaining, 0);
  const cost = getMutation(CREATURE_DEFS.bobek, 2).cost;
  const result = manager.mutate(1);
  assert.equal(result.ok, true, result.reason);
  assert.equal(creature.stage, 2);
  assert.equal(manager.state.biomass, 400 - cost);
  assert.equal(manager.mutationInfo(1).remaining, 28);
  assert.equal(manager.mutate(1).ok, false);
});

test('Контракт: профессия, отправка, возвращение и учёт', () => {
  const manager = fresh(21);
  const offer = manager.state.offers.find((item) =>
    ['cleaning', 'labour'].includes(item.profession)
  );
  assert.ok(offer, 'должен быть контракт под профессию Бобэка');
  const wrong = manager.state.offers.find(
    (item) => !['cleaning', 'labour'].includes(item.profession)
  );
  if (wrong) {
    assert.equal(manager.acceptOffer(wrong.id, 1).ok, false);
  }
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
  delete manager.state.camDown[1];
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

test('День: отчёт и переход к следующему дню', () => {
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

test('Концовка «стать подопытным» доступна', () => {
  const manager = fresh(78);
  manager.state.day = BALANCE.plot.finalDay;
  manager.endShift('manual');
  assert.ok(manager.state.ending.choices.some((choice) => choice.id === 'subject'));
  const result = manager.finishEnding('subject');
  assert.equal(result.id, 'subject');
  assert.ok(manager.state.meta.unlockedEndings.includes('subject'));
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
  assert.equal(NOTES.length, 9);
  assert.equal(Object.keys(ENDINGS).length, 6);
  assert.equal(EMPTY_SLOTS.length, 2);
  assert.equal(Object.keys(UPGRADES).length, 6);
  assert.equal(CREATURE_SHOP.length, 4);
  assert.equal(CREATURE_SHOP.filter((item) => item.secret).length, 1);
});

test('Питомник: старт с одним существом и покупка по дням', () => {
  const manager = fresh(303);
  assert.equal(manager.get(2).status, 'empty');
  manager.state.money = 5000;
  assert.equal(manager.buyCreature('pamydsa').ok, false, 'день 1 — протокол закрыт');
  manager.state.day = 2;
  const result = manager.buyCreature('pamydsa');
  assert.equal(result.ok, true);
  assert.equal(manager.get(2).defId, 'pamydsa');
  assert.equal(manager.state.money, 3000);
  assert.equal(manager.buyCreature('pamydsa').ok, false, 'повторная покупка запрещена');
  manager.state.day = 7;
  manager.state.money = 10000;
  assert.equal(manager.buyCreature('vodolazik').ok, true);
  assert.equal(manager.state.plot.flags.vodolazik_revealed, true);
});

test('Поражение перезапускает тот же день, а не следующий', () => {
  const manager = fresh(404);
  const startMoney = manager.state.money;
  manager.state.money = 123;
  manager.beginEscape(manager.get(1));
  const report = manager.completeEscape();
  assert.equal(report.failed, true);
  assert.equal(report.salary, 0);
  assert.equal(manager.state.day, 1);
  assert.equal(manager.restartDay(), true);
  assert.equal(manager.state.day, 1);
  assert.equal(manager.state.phase, 'office');
  assert.equal(manager.state.money, startMoney);
  assert.equal(manager.get(1).status, 'idle');
});

test('Сложность и события растут с днём', () => {
  const manager = fresh(505);
  const day1 = manager.state.nextEventIn;
  manager.state.day = 6;
  assert.ok(day1 > 0);
  assert.ok(manager.state.daySnapshot);
  assert.equal(manager.state.offers.length, BALANCE.contract.offersPerShift);
  const req = manager.state.offers.map((offer) => offer.reqReadiness);
  assert.ok(Math.min(...req) >= 24);
});

test('Лимит контрактов зависит от числа существ', () => {
  const manager = fresh(606);
  manager.state.day = 4;
  manager.state.money = 50000;
  manager.buyCreature('pamydsa');
  assert.deepEqual(
    { total: manager.contractLimit().total, max: manager.contractLimit().max },
    { total: 2, max: 1 }
  );
  const first = manager.state.offers.find((offer) => offer.profession === 'cleaning');
  assert.equal(manager.acceptOffer(first.id, 1).ok, true);
  const second = manager.state.offers.find((offer) => offer.profession === 'cleaning');
  assert.equal(manager.acceptOffer(second.id, 2).ok, false);
});

test('У каждого существа 1–2 эффективных средства успокоения', () => {
  for (const [id, def] of Object.entries(CREATURE_DEFS)) {
    const good = Object.values(def.triggers).filter((value) => value >= 1.05).length;
    const bad = Object.values(def.triggers).filter((value) => value <= 0.68).length;
    assert.ok(good >= 1 && good <= 2, `${id}: хороших инструментов ${good}`);
    assert.equal(good + bad, Object.keys(def.triggers).length, `${id}: нет нейтральных инструментов`);
  }
});

test('Перезапуск дня возвращает стартовые параметры', () => {
  const manager = fresh(707);
  const before = {
    money: manager.state.money,
    energy: manager.state.operatorEnergy,
    hunger: manager.get(1).stats.hunger,
    offers: manager.state.offers.length,
  };
  manager.state.money = 10;
  manager.get(1).stats.hunger = 99;
  manager.state.operatorEnergy = 0;
  manager.endShift('exhausted');
  assert.equal(manager.restartDay(), true);
  assert.equal(manager.state.money, before.money);
  assert.equal(manager.state.operatorEnergy, before.energy);
  assert.equal(manager.get(1).stats.hunger, before.hunger);
  assert.equal(manager.state.offers.length, before.offers);
  assert.equal(manager.state.phase, 'office');
});

test('Обслуживание бункера: награда и штраф', () => {
  const manager = fresh(808);
  manager.state.money = 1600;
  const rep = manager.state.reputation;
  const success = manager.resolveMaintenance(true, 'wires');
  assert.equal(success.success, true);
  assert.equal(manager.state.money, 1600 + BALANCE.maintenance.rewardMoney);
  assert.equal(manager.state.reputation, rep + BALANCE.maintenance.rewardRep);
  const fail = manager.resolveMaintenance(false, 'samples');
  assert.equal(fail.success, false);
  assert.equal(manager.state.money, 1600 + BALANCE.maintenance.rewardMoney - BALANCE.maintenance.penaltyMoney);
  assert.equal(manager.state.reputation, rep);
  assert.equal(BALANCE.economy.generatorCost, 1000);
});

test('Частота обслуживания: одиночный контракт, половина и большинство', () => {
  const manager = fresh(909);
  const state = manager.state;
  const sample = () => {
    const values = [];
    for (let index = 0; index < 200; index += 1) values.push(nextMaintenanceDelay(state));
    return [Math.min(...values), Math.max(...values)];
  };
  manager.get(1).status = 'contract';
  const single = sample();
  assert.ok(single[0] >= 10 && single[1] <= 20, `один: ${single}`);

  manager.state.day = 4;
  manager.state.money = 50000;
  manager.buyCreature('pamydsa');
  manager.get(2).status = 'idle';
  const half = sample();
  assert.deepEqual(half, [60, 60]);

  manager.get(2).status = 'contract';
  const above = sample();
  assert.ok(above[0] >= 15 && above[1] <= 30, `большинство: ${above}`);
});

test('Мытьё повышает чистоту и тратит деньги/энергию', () => {
  const manager = fresh(1010);
  const creature = manager.get(1);
  creature.stats.cleanliness = 40;
  const money = manager.state.money;
  const energy = manager.state.operatorEnergy;
  const stress = creature.stats.stress;
  const result = manager.cleanCreature(1);
  assert.equal(result.ok, true);
  assert.equal(manager.state.money, money - BALANCE.cleaning.cost);
  assert.equal(manager.state.operatorEnergy, energy - BALANCE.cleaning.energy);
  assert.equal(creature.stats.cleanliness, 40 + BALANCE.cleaning.amount);
  assert.equal(creature.stats.stress, stress + BALANCE.cleaning.stress);
});

test('Секретный пропуск ночи переводит на следующий день', () => {
  const manager = fresh(1111);
  const money = manager.state.money;
  const creatures = manager.state.creatures.length;
  assert.equal(manager.skipNight(), true);
  assert.equal(manager.state.day, 2);
  assert.equal(manager.state.phase, 'office');
  assert.equal(manager.state.report, null);
  assert.equal(manager.state.shiftTimeLeft, BALANCE.shift.durationSec);
  assert.equal(manager.state.money, money);
  assert.equal(manager.state.creatures.length, creatures);
  manager.state.day = 9;
  assert.equal(manager.skipNight(), true);
  assert.equal(manager.state.day, 10);
  assert.equal(manager.skipNight(), false);
});

test('Симуляция 10 дней: экономика не уходит в минус и не ломается', () => {
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

        if (creature.stats.hunger > 45 && manager.state.money > 250) {
          manager.feed(creature.slot, def.food.love);
        }
        if (creature.stats.stress > 50 && manager.state.operatorEnergy > 30) {
          manager.calm(creature.slot, bestTool(def));
        }
        if (creature.stats.integrity < 65 && manager.state.money > 500) {
          manager.repairCell(creature.slot);
        }
        if (creature.stats.energy < 30 && manager.state.operatorEnergy > 40) {
          manager.restCreature(creature.slot);
        }
      }

      for (const offer of [...manager.state.offers]) {
        const candidate = activeCreatures(manager).find(
          (creature) =>
            creature.status === 'idle' &&
            readiness(creature) >= offer.reqReadiness &&
            manager.def(creature.slot)?.professions.includes(offer.profession)
        );
        if (candidate) {
          const accepted = manager.acceptOffer(offer.id, candidate.slot);
          if (accepted.ok) totalContracts += 1;
        }
      }

      if (manager.state.operatorEnergy < 30 && manager.state.money > 200) manager.buyCoffee();
    }

    if (manager.state.phase === 'escaping') manager.completeEscape();
    else if (manager.state.phase === 'office') manager.endShift('manual');
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
