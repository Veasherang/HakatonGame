/**
 * Инструменты успокоения и аварийного сдерживания.
 * Эффективность зависит от индивидуальных триггеров существа.
 */
export const CARE_TOOLS = {
  light: {
    id: 'light',
    name: 'РЕГУЛИРОВКА СВЕТА',
    short: 'СВЕТ',
    icon: 'lamp',
    energy: 4,
    cost: 0,
    color: 0xf0c24a,
    desc: 'Приглушить или усилить освещение.',
  },
  sound: {
    id: 'sound',
    name: 'ЗВУКОВОЕ ВОЗДЕЙСТВИЕ',
    short: 'ЗВУК',
    icon: 'speaker',
    energy: 4,
    cost: 0,
    color: 0x6fc7c9,
    desc: 'Ровный гул или резкий сигнал.',
  },
  vent: {
    id: 'vent',
    name: 'УПРАВЛЕНИЕ ВЕНТИЛЯЦИЕЙ',
    short: 'ВЕНТ',
    icon: 'vent',
    energy: 4,
    cost: 0,
    color: 0x6fa8b8,
    desc: 'Изменить поток воздуха и влажность.',
  },
  lock: {
    id: 'lock',
    name: 'БЛОКИРОВКА КЛЕТКИ',
    short: 'ЗАМОК',
    icon: 'shield',
    energy: 5,
    cost: 20,
    color: 0xb58ed8,
    desc: 'Закрыть все замки сектора.',
  },
  power: {
    id: 'power',
    name: 'ОТКЛЮЧЕНИЕ ПИТАНИЯ',
    short: 'ПИТАНИЕ',
    icon: 'power',
    energy: 6,
    cost: 0,
    color: 0xd8664a,
    desc: 'Обесточить сектор. Опасно для оборудования.',
  },
};

export const CARE_TOOL_LIST = Object.values(CARE_TOOLS);
export const getCareTool = (id) => CARE_TOOLS[id] || null;

/** Аварийные протоколы (используются при тревоге и в комнате). */
export const DEFENSE_TOOLS = [
  { ...CARE_TOOLS.light, alarmEffect: true },
  { ...CARE_TOOLS.sound, alarmEffect: true },
  { ...CARE_TOOLS.vent, alarmEffect: true },
  { ...CARE_TOOLS.lock, alarmEffect: true },
  { ...CARE_TOOLS.power, alarmEffect: true },
];
