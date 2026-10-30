/**
 * Питание. Цена, насыщение и побочные эффекты.
 * Эффекты указаны за одну порцию; множитель предпочтения применяется системой.
 */
export const FOODS = {
  dry: {
    id: 'dry',
    name: 'СУХОЙ ПАЁК',
    short: 'ПАЁК',
    price: 25,
    nutrition: 16,
    energy: 2,
    stress: 4,
    health: -2,
    cleanliness: -2,
    desc: 'Спрессованные волокна с витаминной пылью. Дёшево и почти съедобно.',
    color: 0xb59a6a,
  },
  porridge: {
    id: 'porridge',
    name: 'БЕЛКОВАЯ КАША',
    short: 'КАША',
    price: 55,
    nutrition: 30,
    energy: 4,
    stress: 0,
    health: 2,
    cleanliness: -4,
    desc: 'Тёплая масса из соевого белка. Стандарт бункера.',
    color: 0xcbbf8e,
  },
  meat: {
    id: 'meat',
    name: 'СВЕЖЕЕ МЯСО',
    short: 'МЯСО',
    price: 95,
    nutrition: 44,
    energy: 8,
    stress: -3,
    health: 6,
    cleanliness: -8,
    desc: 'Говядина из верхнего холодильника. Напоминает, что все мы что-то едим.',
    color: 0xb6544a,
  },
  broth: {
    id: 'broth',
    name: 'ПИТАТЕЛЬНЫЙ БУЛЬОН',
    short: 'БУЛЬОН',
    price: 70,
    nutrition: 34,
    energy: 5,
    stress: 1,
    health: 3,
    cleanliness: -12,
    desc: 'Тёмная жидкость с маслянистой плёнкой. Впитывается почти всем.',
    color: 0x7f8c5a,
  },
  gel: {
    id: 'gel',
    name: 'БИОМАССА-ГЕЛЬ',
    short: 'ГЕЛЬ',
    price: 120,
    nutrition: 52,
    energy: 14,
    stress: -6,
    health: 8,
    cleanliness: -6,
    desc: 'Концентрированная питательная среда. Дорого, зато существо довольно.',
    color: 0x6ea86a,
  },
  slime: {
    id: 'slime',
    name: 'БОБЭКОВА СЛИЗЬ',
    short: 'СЛИЗЬ',
    price: 0,
    nutrition: 14,
    energy: 3,
    stress: 2,
    health: -3,
    cleanliness: 16,
    desc: 'Собранная слизь из сектора 1. Бобэк сам «моет» клетку, если его покормить этим.',
    color: 0x4f6b4a,
    onlyFor: ['bobek'],
    free: true,
  },
};

export const FOOD_LIST = Object.values(FOODS);

export const getFood = (id) => FOODS[id] || null;

export const foodsFor = (creatureDefId) =>
  FOOD_LIST.filter((food) => !food.onlyFor || food.onlyFor.includes(creatureDefId));
