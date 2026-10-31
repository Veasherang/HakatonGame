/**
 * Случайные события смены. Событие возвращает набор эффектов,
 * которые применяет GameManager — так сохраняется единый учёт ресурсов.
 */
import { MEMORY_LINES } from '../data/plot.js';

const isActive = (creature) => ['idle', 'training'].includes(creature.status);

function activeCreatures(state) {
  return state.creatures.filter(isActive);
}

/** Выбрать и описать событие. */
export function rollEvent(state, rng) {
  const active = activeCreatures(state);
  const candidates = [];

  const add = (weight, factory) => candidates.push({ weight, factory });

  add(1, () => ({
    id: 'power_surge',
    title: 'СКАЧОК НАПРЯЖЕНИЯ',
    kind: 'warning',
    text: 'Скачок напряжения в сети бункера. Часть резерва потеряна.',
    effects: { power: -22 },
  }));

  if (active.length) {
    add(3, () => {
      const target = rng.pick(active);
      return {
        id: 'cam_glitch',
        title: 'СБОЙ КАМЕРЫ',
        kind: 'warning',
        text: `Камера сектора ${target.slot}: изображение потеряно.`,
        effects: { camDown: { slot: target.slot, seconds: rng.int(18, 28) } },
      };
    });
  }

  if (active.length) {
    add(3, () => {
      const target = rng.pick(active);
      return {
        id: 'noise',
        title: 'ШУМ В ВЕНТИЛЯЦИИ',
        kind: 'warning',
        text: `Что-то скребётся в вентиляции сектора ${target.slot}. Существо нервничает.`,
        effects: { stress: { slot: target.slot, value: 9 }, integrity: { slot: target.slot, value: -2 } },
      };
    });
  }

  if (active.length) {
    add(2, () => {
      const target = rng.pick(active);
      const defId = target.defId;
      const phrase = rng.pick(MEMORY_LINES[defId] || ['…']);
      return {
        id: 'memory',
        title: 'ФРАЗА ИЗ КАМЕРЫ',
        kind: 'plot',
        text: `${target.name} произносит: ${phrase}`,
        effects: { memory: true, slot: target.slot, defId },
      };
    });
  }

  add(2, () => ({
    id: 'leak',
    title: 'ПРОТЕЧКА',
    kind: 'warning',
    text: 'По стенам секторов течёт тёмная жидкость. Чистота падает.',
    effects: { cleanlinessAll: -7 },
  }));

  add(2, () => ({
    id: 'whisper',
    title: 'ШЁПОТ В ДИНАМИКАХ',
    kind: 'plot',
    text: 'Динамики транслируют шёпот на частоте, которую слышат только существа.',
    effects: { stressAll: 5 },
  }));

  add(1, () => ({
    id: 'bonus',
    title: 'ПРЕМИЯ',
    kind: 'good',
    text: 'Корпорация перечислила премию за «соблюдение протокола».',
    effects: { money: 140, rep: 1 },
  }));

  add(1, () => ({
    id: 'biomass_cache',
    title: 'БИОМАССА',
    kind: 'good',
    text: 'В фильтрах вентиляции собрана пригодная биомасса.',
    effects: { biomass: 3 },
  }));

  add(2, () => ({
    id: 'ration',
    title: 'ПОСТАВКА',
    kind: 'good',
    text: 'Пришла внеплановая поставка. Можно сэкономить часть бюджета.',
    effects: { money: 55 },
  }));

  add(1, () => ({
    id: 'inspection',
    title: 'ПРОВЕРКА',
    kind: 'warning',
    text: 'Автоматическая проверка журнала. НАДЗОР отмечает ваш прогресс.',
    effects: { rep: 2, operatorEnergy: -4 },
  }));

  add(1, () => ({
    id: 'cold',
    title: 'ПЕРЕОХЛАЖДЕНИЕ',
    kind: 'warning',
    text: 'Температура в секторах упала. Существа сбиваются в угол.',
    effects: { stressAll: 4, power: -6 },
  }));

  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng.next() * total;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate.factory();
  }
  return candidates[0].factory();
}
