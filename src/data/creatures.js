/**
 * Каталог существ бункера АТД-67.
 *
 * Каждое существо содержит:
 *  - базовые характеристики;
 *  - предпочтения в еде;
 *  - чувствительность к свету/шуму/вентиляции/энергии (триггеры);
 *  - ветки навыков (3 направления, цепочки из 3 узлов);
 *  - стадии мутаций (2 и 3);
 *  - профессии, влияющие на контракты.
 *
 * Стадии мутаций соответствуют трём предоставленным спрайтам (1–3).
 */
import { BALANCE } from '../config/balance.js';

const MUTATION_PRICE_SCALE = 2.4;

export const CREATURE_DEFS = {
  bobek: {
    id: 'bobek',
    slot: 1,
    sector: 'СЕКТОР 01',
    name: 'БОБЭК',
    fullName: 'Бобэк',
    subject: 'СУБЪЕКТ 12',
    species: 'МУТИРОВАВШИЙ ПЁС',
    color: 0x8fb37a,
    accent: 0xc9d7a3,
    stageNames: ['ПЁС', 'ПОРИСТЫЙ', 'СПОРОВЫЙ УЛЕЙ'],
    stageDesc: [
      'Обычный пёс с пористой кожей. Пока что.',
      'Тело покрылось губчатыми порами, из которых сочится тёмная слизь.',
      'Пористая масса покрыта спорами и глазами. Он больше не один.',
    ],
    base: { hunger: 34, stress: 26, energy: 72, health: 86, aggression: 18, cleanliness: 58, integrity: 88, loyalty: 62 },
    professions: ['cleaning', 'labour'],
    professionNames: ['УБОРЩИК', 'РАЗНОРАБОЧИЙ'],
    food: { love: 'broth', hate: 'dry' },
    triggers: { light: 1.2, noise: 0.4, vent: 1.1, lock: 0.5, power: 0.5 },
    hint: 'Успокаивают только ровный свет и прохладная вентиляция. Шум, замки и отключение питания его злят.',
    ability: {
      name: 'ВПИТЫВАНИЕ',
      text: 'Поглощает жидкость и грязь. Точный эффект пока не задокументирован.',
      configurable: true,
    },
    behavior: 'Медленно бродит по клетке и оставляет за собой липкие следы. В грязной клетке становится беспокойным.',
    biomass: 1.6,
    skills: [
      {
        id: 'obedience',
        name: 'ПОСЛУШАНИЕ',
        color: 0x6ad48a,
        nodes: [
          { name: 'РОВНЫЙ ГОЛОС', cost: 150, time: 22, effect: { contract: 5 }, desc: 'Бобэк перестаёт скулить, когда с ним говорят спокойно. +5 к контрактам.' },
          { name: 'ТЕРПЕНИЕ', cost: 260, time: 30, effect: { stressRate: 0.1 }, desc: 'Он ждёт команды, а не бросается к двери. Стресс растёт медленнее.' },
          { name: 'КОНТАКТ', cost: 420, time: 38, effect: { readiness: 7, contract: 4 }, desc: 'Он узнаёт оператора. Готовность к контракту +7.' },
        ],
      },
      {
        id: 'absorb',
        name: 'ВПИТЫВАНИЕ',
        color: 0x6fa8b8,
        nodes: [
          { name: 'СБОР СЛИЗИ', cost: 160, time: 24, effect: { biomass: 0.6, cleanRate: 0.2 }, desc: 'Слизь можно собирать в биомассу. +0.6 биомассы за день.' },
          { name: 'ФИЛЬТРАЦИЯ', cost: 280, time: 32, effect: { healthRegen: 0.15, stressRate: 0.05 }, desc: 'Он фильтрует собственную слизь. Здоровье восстанавливается быстрее.' },
          { name: 'СПОРЫ', cost: 460, time: 42, effect: { biomass: 1.0, income: 0.08 }, desc: 'Споры повышают ценность существа для биотех-компаний. +8% к оплате.' },
        ],
      },
      {
        id: 'labour',
        name: 'РАБОТА',
        color: 0xd9a04a,
        nodes: [
          { name: 'ТРЯПКА', cost: 140, time: 20, effect: { contract: 4 }, desc: 'Простейшая уборка. +4 к контрактам.' },
          { name: 'ПОЛИРОВКА', cost: 250, time: 28, effect: { income: 0.06, contract: 3 }, desc: 'Он умеет доводить поверхности до блеска. +6% к оплате.' },
          { name: 'ТИХИЙ УБОРЩИК', cost: 400, time: 36, effect: { contract: 9, readiness: 4 }, desc: 'Работает без надзора. +9 к контрактам.' },
        ],
      },
    ],
    mutations: [
      {
        stage: 2,
        name: 'ПОРИСТАЯ СТАДИЯ',
        cost: 30,
        desc: 'Кожа превращается в губку. Слизь становится ценным сырьём, но раздражает существо.',
        stat: { aggression: 7, health: 4, cleanliness: -6 },
        contract: 0.15,
      },
      {
        stage: 3,
        name: 'СПОРОВЫЙ УЛЕЙ',
        cost: 72,
        desc: 'Споры прорастают глазами. Бобэк перестаёт быть одним существом — и это нравится компаниям.',
        stat: { aggression: 11, health: 7, energy: 5 },
        contract: 0.3,
      },
    ],
  },

  pamydsa: {
    id: 'pamydsa',
    slot: 2,
    sector: 'СЕКТОР 02',
    name: 'ПАМЫЦА',
    fullName: 'Птица Памыца',
    subject: 'СУБЪЕКТ 19',
    species: 'МУТИРОВАВШАЯ ПТИЦА',
    color: 0xc8b06a,
    accent: 0xe6d79a,
    stageNames: ['ПТИЦА', 'ТЕНЬ', 'МЕТЛА'],
    stageDesc: [
      'Крупная птица с человеческим зрачком.',
      'Перья облезли, голос стал чужим. Она повторяет слова, которых не слышала.',
      'На третьей стадии она держит метлу. Никто не видел, чтобы её кто-то дал.',
    ],
    base: { hunger: 28, stress: 48, energy: 80, health: 74, aggression: 30, cleanliness: 70, integrity: 80, loyalty: 44 },
    professions: ['cleaning'],
    professionNames: ['УБОРЩИЦА', 'СОРТИРОВЩИЦА'],
    food: { love: 'porridge', hate: 'meat' },
    triggers: { light: 0.35, noise: 0.3, vent: 1.35, lock: 0.45, power: 0.4 },
    hint: 'Единственное, что её успокаивает, — вентиляция. Свет, шум, замки и питание вызывают панику.',
    ability: {
      name: 'ЭХО',
      text: 'Повторяет голоса. Иногда — голосом предыдущего оператора.',
      configurable: false,
    },
    behavior: 'Сидит на полу, повернув голову к камере. Когда волнуется — бьётся о стены и повторяет чужие фразы.',
    biomass: 0.8,
    skills: [
      {
        id: 'flight',
        name: 'ПОЛЁТ',
        color: 0x6fc7c9,
        nodes: [
          { name: 'ПОДЪЁМ', cost: 160, time: 22, effect: { contract: 5, energy: 2 }, desc: 'Она держится в воздухе дольше. +5 к контрактам.' },
          { name: 'ПИКИРОВАНИЕ', cost: 270, time: 30, effect: { contract: 7, stressRate: 0.04 }, desc: 'Точность и скорость. +7 к контрактам.' },
          { name: 'ТИХИЙ КРЫЛ', cost: 430, time: 40, effect: { income: 0.1, contract: 5 }, desc: 'Бесшумный полёт ценят в разведке. +10% к оплате.' },
        ],
      },
      {
        id: 'cleaning',
        name: 'ЧИСТОТА',
        color: 0x9aa7b8,
        nodes: [
          { name: 'ПОРЯДОК', cost: 150, time: 20, effect: { contract: 4, cleanRate: 0.15 }, desc: 'Она не терпит грязь. +4 к контрактам.' },
          { name: 'СОРТИРОВКА', cost: 250, time: 28, effect: { income: 0.07, contract: 3 }, desc: 'Разбирает мусор по категориям. +7% к оплате.' },
          { name: 'МЕТЛА', cost: 520, time: 46, effect: { contract: 12, income: 0.08, cleanRate: 0.3 }, desc: 'На третьей стадии она получает метлу. Работа становится почти осмысленной.' },
        ],
      },
      {
        id: 'memory',
        name: 'ПАМЯТЬ',
        color: 0xb58ed8,
        nodes: [
          { name: 'ЧУЖИЕ СЛОВА', cost: 170, time: 24, effect: { stressRate: 0.08 }, desc: 'Она перестаёт кричать чужими голосами. Стресс растёт медленнее.' },
          { name: 'УЗНАВАНИЕ', cost: 290, time: 34, effect: { readiness: 6, contract: 4 }, desc: 'Она узнаёт оператора и не бьётся о стены. Готовность +6.' },
          { name: 'ИМЯ', cost: 470, time: 44, effect: { loyalty: 4, contract: 6 }, desc: 'Она вспоминает своё имя. Лояльность и контракты растут.' },
        ],
      },
    ],
    mutations: [
      {
        stage: 2,
        name: 'ОБЛЕЗШАЯ ТЕНЬ',
        cost: 32,
        desc: 'Перья выпадают, голос ломается. Она начинает повторять чужие фразы.',
        stat: { aggression: 8, health: 3, stress: 4 },
        contract: 0.18,
      },
      {
        stage: 3,
        name: 'МЕТЛА',
        cost: 78,
        desc: 'Она получает метлу. Контракты по уборке становятся её специализацией — и её приговором.',
        stat: { aggression: 10, health: 6, cleanliness: 10 },
        contract: 0.32,
      },
    ],
  },

  mishutka: {
    id: 'mishutka',
    slot: 3,
    sector: 'СЕКТОР 03',
    name: 'МИШУТКА',
    fullName: 'Мишутка',
    subject: 'СУБЪЕКТ 04',
    species: 'МЕДВЕДЬ-КИБОРГ',
    color: 0xa8896a,
    accent: 0xd0b48e,
    stageNames: ['МЕДВЕДЬ', 'КИБОРГ', 'ОРУЖИЕ'],
    stageDesc: [
      'Огромный медведь с механическим глазом.',
      'Броня вросла в тело. Импланты питаются от бункера.',
      'Он научился держать оружие. Военные компании выстраиваются в очередь.',
    ],
    base: { hunger: 46, stress: 34, energy: 60, health: 92, aggression: 42, cleanliness: 52, integrity: 92, loyalty: 50 },
    professions: ['combat', 'construction'],
    professionNames: ['ВОЕННЫЙ', 'СТРОИТЕЛЬ'],
    food: { love: 'meat', hate: 'gel' },
    triggers: { light: 1.15, noise: 0.5, vent: 0.4, lock: 0.5, power: 1.3 },
    hint: 'Успокаивают свет и аварийное отключение питания. Шум, сырость и замки только злят.',
    ability: {
      name: 'СИЛОВОЙ ПРИВОД',
      text: 'Механические импланты усиливают удар. При отключении питания он становится почти безобидным.',
      configurable: false,
    },
    behavior: 'Стоит в центре клетки, не двигаясь часами. При стрессе бьёт по стене бронированной лапой.',
    biomass: 1.0,
    skills: [
      {
        id: 'strength',
        name: 'СИЛА',
        color: 0xd8503f,
        nodes: [
          { name: 'ХВАТКА', cost: 190, time: 24, effect: { contract: 6 }, desc: 'Держит инструмент без пальцев. +6 к контрактам.' },
          { name: 'ТЯГА', cost: 320, time: 32, effect: { contract: 9, income: 0.05 }, desc: 'Ворочает бетонные блоки. +9 к контрактам.' },
          { name: 'ТАРАН', cost: 520, time: 42, effect: { contract: 13, income: 0.07 }, desc: 'Живой таран. Компании платят за это щедро.' },
        ],
      },
      {
        id: 'engineering',
        name: 'ИНЖЕНЕРИЯ',
        color: 0x6fc7c9,
        nodes: [
          { name: 'ПИТАНИЕ', cost: 200, time: 26, effect: { powerUse: 0.15, stressRate: 0.06 }, desc: 'Импланты потребляют меньше энергии бункера.' },
          { name: 'КАЛИБРОВКА', cost: 340, time: 34, effect: { contract: 7, integrityRate: 0.1 }, desc: 'Точная настройка приводов. +7 к контрактам.' },
          { name: 'АВТОНОМНОСТЬ', cost: 540, time: 44, effect: { income: 0.12, contract: 6 }, desc: 'Он может работать без питания бункера. +12% к оплате.' },
        ],
      },
      {
        id: 'armor',
        name: 'БРОНЯ',
        color: 0x8a9aa8,
        nodes: [
          { name: 'ЗАКЛЁПКИ', cost: 180, time: 22, effect: { integrityRate: 0.12 }, desc: 'Дополнительные пластины. Клетка разрушается медленнее.' },
          { name: 'ПОДШИПНИКИ', cost: 300, time: 30, effect: { contract: 5, stressRate: 0.05 }, desc: 'Меньше трения — меньше боли. +5 к контрактам.' },
          { name: 'ШКУРА', cost: 480, time: 40, effect: { health: 5, readiness: 5 }, desc: 'Броня срастается с телом. Здоровье и готовность растут.' },
        ],
      },
    ],
    mutations: [
      {
        stage: 2,
        name: 'СВАРНОЙ КИБОРГ',
        cost: 35,
        desc: 'Импланты разрастаются. Он сильнее, но питание бункера для него важнее.',
        stat: { aggression: 9, health: 6 },
        contract: 0.2,
      },
      {
        stage: 3,
        name: 'ОРУЖИЕ',
        cost: 85,
        desc: 'Он берёт в лапы оружие и понимает, зачем оно нужно. Контракты становятся опаснее.',
        stat: { aggression: 14, health: 6, energy: 4 },
        contract: 0.38,
      },
    ],
  },

  vodolazik: {
    id: 'vodolazik',
    slot: 4,
    sector: 'СЕКТОР 04',
    name: 'ВОДОЛАЗИК',
    fullName: 'Водолазик',
    subject: 'СУБЪЕКТ 07',
    species: 'МУТИРОВАВШИЙ ЧЕЛОВЕК',
    color: 0x8fa8b8,
    accent: 0xc3d6dd,
    stageNames: ['ЧЕЛОВЕК', 'ГОЛОДНЫЙ', 'ВОДОЛАЗ'],
    stageDesc: [
      'Он человек. Это видно по глазам. Это же и самое страшное.',
      'Кожа пожелтела, суставы вывернулись. Он всё ещё смотрит на оператора.',
      'Костюм стабилизирует мутации. В нём он перестаёт меняться — и перестаёт быть человеком.',
    ],
    base: { hunger: 38, stress: 58, energy: 46, health: 66, aggression: 24, cleanliness: 64, integrity: 76, loyalty: 38 },
    professions: ['cleaning', 'labour', 'mining', 'combat', 'construction', 'research', 'tech', 'diving'],
    professionNames: ['ТЕХНИК', 'ИССЛЕДОВАТЕЛЬ'],
    food: { love: 'gel', hate: 'dry' },
    triggers: { light: 0.4, noise: 1.3, vent: 1.5, lock: 0.45, power: 0.5 },
    hint: 'Помогают только ровный гул и влажная вентиляция. Свет, замки и отключение питания причиняют боль.',
    ability: {
      name: 'ПОСЛЕДНИЙ ЧЕЛОВЕК',
      text: 'Сохраняет остатки человеческого разума. Может выполнять сложные задания — и задавать вопросы.',
      configurable: false,
    },
    behavior: 'Сидит у стекла и смотрит на камеру. Иногда произносит одно и то же имя. Иногда это имя оператора.',
    biomass: 1.4,
    skills: [
      {
        id: 'intellect',
        name: 'ИНТЕЛЛЕКТ',
        color: 0x6fc7c9,
        nodes: [
          { name: 'СЧЁТ', cost: 190, time: 24, effect: { contract: 6 }, desc: 'Он читает отчёты быстрее оператора. +6 к контрактам.' },
          { name: 'СХЕМА', cost: 330, time: 34, effect: { contract: 8, income: 0.06 }, desc: 'Собирает устройства из мусора. +8 к контрактам.' },
          { name: 'ЯЗЫК', cost: 500, time: 44, effect: { contract: 10, income: 0.1 }, desc: 'Он выучил язык компаний. Это меняет качество заданий.' },
        ],
      },
      {
        id: 'adaptation',
        name: 'АДАПТАЦИЯ',
        color: 0xb58ed8,
        nodes: [
          { name: 'ДЫХАНИЕ', cost: 180, time: 22, effect: { stressRate: 0.12 }, desc: 'Он снова умеет дышать ровно. Стресс растёт медленнее.' },
          { name: 'ТЕРПИМОСТЬ', cost: 300, time: 30, effect: { stressRate: 0.1, healthRegen: 0.12 }, desc: 'Он привыкает к клетке. Это не то, чем стоит гордиться.' },
          { name: 'ДОВЕРИЕ', cost: 460, time: 40, effect: { loyalty: 6, readiness: 6 }, desc: 'Он перестаёт считать тебя врагом. Пока.' },
        ],
      },
      {
        id: 'diving',
        name: 'ГЛУБИНА',
        color: 0x6fa8b8,
        nodes: [
          { name: 'ДАВЛЕНИЕ', cost: 200, time: 26, effect: { contract: 6, integrityRate: 0.08 }, desc: 'Он спокойно переносит глубину. +6 к контрактам.' },
          { name: 'СОНАР', cost: 340, time: 34, effect: { contract: 8, income: 0.06 }, desc: 'Слышит то, чего не слышит техника. +8 к контрактам.' },
          { name: 'КОСТЮМ', cost: 560, time: 46, effect: { income: 0.14, contract: 8 }, desc: 'На третьей стадии он получает костюм. Мутации останавливаются.' },
        ],
      },
    ],
    mutations: [
      {
        stage: 2,
        name: 'ПОЖЕЛТЕВШИЙ',
        cost: 34,
        desc: 'Тело выворачивается. Он всё ещё человек — но уже не совсем.',
        stat: { aggression: 8, health: 4, stress: 5 },
        contract: 0.22,
      },
      {
        stage: 3,
        name: 'КОСТЮМ',
        cost: 88,
        desc: 'Специальный костюм стабилизирует мутации. Под стеклом шлема — лицо, которое ты узнаёшь.',
        stat: { aggression: 6, health: 8, stress: -4 },
        contract: 0.42,
      },
    ],
  },
};

/** Пустые секторы: предусмотрены под будущих существ. */
export const EMPTY_SLOTS = [
  {
    slot: 5,
    sector: 'СЕКТОР 05',
    name: 'ПУСТО',
    note: 'Сектор не введён в эксплуатацию. Камера показывает пустую комнату.',
  },
  {
    slot: 6,
    sector: 'СЕКТОР 06',
    name: 'ПУСТО',
    note: 'Сектор не введён в эксплуатацию. Кабели выведены, но питание отключено.',
  },
];

/**
 * Питомник. В начале игры в бункере только Бобэк.
 * Остальные субъекты покупаются по мере открытия протоколов.
 */
export const CREATURE_SHOP = [
  {
    id: 'bobek',
    slot: 1,
    price: 0,
    unlockDay: 1,
    start: true,
    tag: 'СТАРТОВЫЙ СУБЪЕКТ',
    blurb: 'Пёс-губка. Уже в бункере. Ест бульон, боится резкого шума.',
  },
  {
    id: 'pamydsa',
    slot: 2,
    price: 2000,
    unlockDay: 2,
    tag: 'ЖИВОТНОЕ',
    blurb: 'Птица с человеческим зрачком. Только уборка и сортировка.',
  },
  {
    id: 'mishutka',
    slot: 3,
    price: 4200,
    unlockDay: 4,
    tag: 'ЖИВОТНОЕ · КИБОРГ',
    blurb: 'Медведь-киборг. Военные и строительные контракты. Тяжёлый, дорогой, опасный.',
  },
  {
    id: 'vodolazik',
    slot: 4,
    price: 7600,
    unlockDay: 7,
    secret: true,
    tag: 'ПРОТОКОЛ 07',
    blurb: 'Последний лот. До открытия протокола информация скрыта.',
    reveal: 'ЭТО ЧЕЛОВЕК. Эксперименты больше не ограничены животными.',
  },
];

export const SLOT_COUNT = 6;

export const getCreatureDef = (id) => CREATURE_DEFS[id] || null;

export const creatureBySlot = (slot) =>
  Object.values(CREATURE_DEFS).find((def) => def.slot === slot) || null;

export const getMutation = (def, stage) => {
  const mutation = (def?.mutations || []).find((item) => item.stage === stage) || null;
  if (!mutation) return null;
  return {
    ...mutation,
    cost: Math.round((mutation.cost * MUTATION_PRICE_SCALE) / 5) * 5,
  };
};

/**
 * Все узлы навыков существа в плоском виде.
 * Идентификаторы детерминированы (def + ветка + индекс), поэтому
 * сохраняются между версиями и загрузками.
 */
export const skillNodes = (def) => {
  const result = [];
  for (const branch of def.skills) {
    branch.nodes.forEach((node, index) => {
      result.push({
        ...node,
        cost: Math.round((node.cost * BALANCE.training.priceScale) / 10) * 10,
        id: `${def.id}_${branch.id}_${index + 1}`,
        branchId: branch.id,
        branchName: branch.name,
        branchColor: branch.color,
        index,
      });
    });
  }
  return result;
};

/** Узел по id. */
export const getSkillNode = (def, nodeId) =>
  skillNodes(def).find((node) => node.id === nodeId) || null;

/** Предыдущий узел цепочки (для проверки prerequisites). */
export const previousSkillNode = (def, node) => {
  if (!node || node.index === 0) return null;
  return skillNodes(def).find(
    (candidate) => candidate.branchId === node.branchId && candidate.index === node.index - 1
  ) || null;
};
