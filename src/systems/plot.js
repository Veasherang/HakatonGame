/** Сюжетная система: записки, доверие НАДЗОРА, финальные развилки. */
import { BALANCE } from '../config/balance.js';
import { ENDINGS, NOTES } from '../data/plot.js';

export function createPlot() {
  return {
    notes: [],
    flags: {},
    evidence: 0,
    aiTrust: 50,
    shownNotes: [],
  };
}

export const getNote = (id) => NOTES.find((note) => note.id === id) || null;

export const noteForDay = (day) => NOTES.find((note) => note.day === day) || null;

export function unlockNote(state, noteId) {
  const note = getNote(noteId);
  if (!note) return null;
  if (state.plot.notes.includes(noteId)) return null;
  state.plot.notes.push(noteId);
  state.shiftStats.notes.push(noteId);
  return note;
}

export function pendingNote(state) {
  const note = noteForDay(state.day);
  if (!note) return null;
  if (state.plot.notes.includes(note.id)) return null;
  if (state.plot.shownNotes.includes(note.id)) return null;
  return note;
}

export function markNoteShown(state, noteId) {
  if (!state.plot.shownNotes.includes(noteId)) state.plot.shownNotes.push(noteId);
}

export function averageLoyalty(state) {
  const creatures = state.creatures.filter((creature) => creature.defId && creature.stats);
  if (!creatures.length) return 0;
  return creatures.reduce((sum, creature) => sum + creature.stats.loyalty, 0) / creatures.length;
}

export function adjustAiTrust(state, delta) {
  state.plot.aiTrust = Math.max(0, Math.min(100, state.plot.aiTrust + delta));
}

/** Финальные развилки. */
export function buildChoices(state) {
  const notes = state.plot.notes.length;
  const loyalty = averageLoyalty(state);
  const evidence = state.plot.evidence;

  return [
    {
      id: 'servant',
      label: 'ПРОДОЛЖИТЬ РАБОТУ',
      desc: 'Подписать продление контракта. Бункер будет работать дальше.',
      enabled: true,
      hint: 'Доступно всегда.',
      endingId: 'servant',
    },
    {
      id: 'release',
      label: 'ОТКРЫТЬ КЛЕТКИ',
      desc: 'Обесточить сектор и снять замки. Дать им уйти.',
      enabled: loyalty >= 55 || notes >= 6,
      hint: `Нужна средняя лояльность ≥ 55 (сейчас ${Math.round(loyalty)}) или 6 записок (${notes}).`,
      endingId: 'release',
    },
    {
      id: 'burn',
      label: 'УНИЧТОЖИТЬ БУНКЕР',
      desc: 'Собрать доказательства и запустить аварийный протокол.',
      enabled: notes >= 7 && (evidence >= 1 || notes >= 8),
      hint: `Нужно 7 записок и хотя бы одно доказательство. Сейчас: ${notes} записок, ${evidence} доказательств.`,
      endingId: 'burn',
    },
    {
      id: 'witness',
      label: 'УЙТИ ОДИН',
      desc: 'Выйти через шахту и не оглядываться.',
      enabled: notes >= 4,
      hint: `Нужно 4 записки (${notes}).`,
      endingId: 'witness',
    },
    {
      id: 'subject',
      label: 'СТАТЬ ПОДОПЫТНЫМ',
      desc: 'Подписать форму 07-Б и войти в клетку 06. Добровольно.',
      enabled: true,
      hint: 'Доступно всегда. НАДЗОР будет доволен.',
      endingId: 'subject',
    },
  ];
}

/** Проверка финала после смены. */
export function evaluateEnding(state) {
  if (state.stats.escapes >= BALANCE.plot.maxEscapesBeforeForcedEnding) {
    return {
      final: true,
      forced: true,
      id: 'replaced',
      reason: 'Слишком много побегов. НАДЗОР инициировал замену оператора.',
      choices: [],
    };
  }
  if (state.reputation <= BALANCE.plot.minReputationBeforeForcedEnding) {
    return {
      final: true,
      forced: true,
      id: 'replaced',
      reason: 'Репутация офиса упала ниже допустимого. НАДЗОР инициировал замену.',
      choices: [],
    };
  }
  if (state.day < BALANCE.plot.finalDay) {
    return { final: false };
  }
  return {
    final: true,
    forced: false,
    id: null,
    reason: 'Контракт истёк. НАДЗОР ожидает решения оператора.',
    choices: buildChoices(state),
  };
}

export function getEnding(id) {
  return ENDINGS[id] || null;
}

/** Зафиксировать выбранную концовку. */
export function applyEnding(state, choiceId) {
  const forced = Boolean(state.ending?.forced);
  const choice = buildChoices(state).find((item) => item.id === choiceId);
  const endingId = forced ? 'replaced' : choice?.endingId || 'servant';
  const ending = getEnding(endingId) || ENDINGS.servant;
  state.phase = 'ended';
  state.endingResult = {
    id: ending.id,
    title: ending.title,
    tone: ending.tone,
    text: ending.text,
    choice: forced ? 'replaced' : choice?.id || 'servant',
    day: state.day,
  };
  if (!state.meta.unlockedEndings.includes(ending.id)) {
    state.meta.unlockedEndings.push(ending.id);
  }
  state.meta.bestDay = Math.max(state.meta.bestDay || 0, state.day);
  return state.endingResult;
}
