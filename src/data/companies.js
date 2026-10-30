/**
 * Корпорации-заказчики. Каждая компания имеет специализацию, шаблоны
 * контрактов, уровень риска и собственный интерес в бункере.
 */
export const COMPANIES = {
  geosintez: {
    id: 'geosintez',
    name: 'ГЕОСИНТЕЗ',
    specialization: 'ГОРНАЯ ДОБЫЧА',
    color: 0x4f8f6b,
    risk: 1,
    logo: 'hex',
    blurb: 'Разработка глубоких горизонтов. Используют существ как дешёвую рабочую силу.',
    suspicion: 0.1,
    templates: [
      {
        title: 'Проходка штольни Б-12',
        profession: 'mining',
        basePay: 430,
        duration: 95,
        risk: 1,
        readiness: 40,
        flavor: 'Нужны руки, которые не устают. Или лапы.',
      },
      {
        title: 'Разбор завала в секторе Г',
        profession: 'labour',
        basePay: 360,
        duration: 85,
        risk: 1,
        readiness: 34,
        flavor: 'Бетон, пыль, темнота. Стандартная работа.',
      },
      {
        title: 'Глубинная разведка',
        profession: 'diving',
        basePay: 720,
        duration: 150,
        risk: 2,
        readiness: 58,
        flavor: 'На глубине 400 метров что-то отвечает на сигналы.',
      },
    ],
  },

  sentinel: {
    id: 'sentinel',
    name: 'СЕНТИНЕЛ',
    specialization: 'ВОЕННЫЕ ИСПЫТАНИЯ',
    color: 0xa84a3f,
    risk: 3,
    logo: 'triangle',
    blurb: 'Закрытые полевые испытания. Не задавайте вопросов о целях.',
    suspicion: 0.7,
    templates: [
      {
        title: 'Полевые испытания «Тишина»',
        profession: 'combat',
        basePay: 890,
        duration: 150,
        risk: 3,
        readiness: 62,
        flavor: 'Проверка реакции на стресс. Живые мишени не предусмотрены.',
      },
      {
        title: 'Сопровождение груза',
        profession: 'combat',
        basePay: 760,
        duration: 125,
        risk: 2,
        readiness: 55,
        flavor: 'Груз не описан. Сопровождать — не спрашивать.',
      },
    ],
  },

  clean9: {
    id: 'clean9',
    name: 'ЧИСТОТА-9',
    specialization: 'САНИТАРНАЯ ОБРАБОТКА',
    color: 0x6fa8b8,
    risk: 1,
    logo: 'circle',
    blurb: 'Уборка объектов после инцидентов. Хорошо платят за тишину.',
    suspicion: 0.35,
    templates: [
      {
        title: 'Зачистка лаборатории К-4',
        profession: 'cleaning',
        basePay: 380,
        duration: 80,
        risk: 1,
        readiness: 32,
        flavor: 'Пятна не отмываются. Это не мешает работе.',
      },
      {
        title: 'Обработка вентиляции',
        profession: 'cleaning',
        basePay: 460,
        duration: 90,
        risk: 1,
        readiness: 40,
        flavor: 'Стандартная дезинфекция. Не открывайте закрытые решётки.',
      },
      {
        title: 'Уборка после контакта',
        profession: 'cleaning',
        basePay: 610,
        duration: 110,
        risk: 2,
        readiness: 50,
        flavor: 'Иногда после уборки существ не возвращают.',
      },
    ],
  },

  biotech: {
    id: 'biotech',
    name: 'БИОТЕХ АРХИВ',
    specialization: 'БИОЛОГИЧЕСКИЕ ИССЛЕДОВАНИЯ',
    color: 0x8a6ab8,
    risk: 3,
    logo: 'spiral',
    blurb: 'Изучает мутации. Платит за образцы и за молчание оператора.',
    suspicion: 0.9,
    templates: [
      {
        title: 'Сбор образцов тканей',
        profession: 'research',
        basePay: 680,
        duration: 120,
        risk: 2,
        readiness: 52,
        flavor: 'Образцы должны быть живыми. Это важно для протокола.',
      },
      {
        title: 'Тест на регенерацию',
        profession: 'research',
        basePay: 840,
        duration: 140,
        risk: 3,
        readiness: 62,
        flavor: 'Существо помещают в камеру с «гостем». Подробности не раскрываются.',
      },
      {
        title: 'Сверка журнала субъектов',
        profession: 'tech',
        basePay: 540,
        duration: 100,
        risk: 2,
        readiness: 46,
        flavor: 'Требуется доступ к терминалу. Оператор при этом не нужен.',
      },
    ],
  },

  podzemstroy: {
    id: 'podzemstroy',
    name: 'ПОДЗЕМСТРОЙ',
    specialization: 'ПОДЗЕМНОЕ СТРОИТЕЛЬСТВО',
    color: 0xb08a4a,
    risk: 2,
    logo: 'square',
    blurb: 'Строит то, что не должно быть видно с поверхности.',
    suspicion: 0.45,
    templates: [
      {
        title: 'Монтаж переборок',
        profession: 'construction',
        basePay: 520,
        duration: 105,
        risk: 1,
        readiness: 42,
        flavor: 'Сектор 5 снова расширяют. Не спрашивайте зачем.',
      },
      {
        title: 'Бетонирование шахты',
        profession: 'construction',
        basePay: 640,
        duration: 130,
        risk: 2,
        readiness: 50,
        flavor: 'Работа тяжёлая. Существо может не вернуться тем же.',
      },
    ],
  },
};

export const COMPANY_LIST = Object.values(COMPANIES);
export const getCompany = (id) => COMPANIES[id] || null;

/** Кто в бункере умеет выполнять данную профессию. */
export const professionLabel = {
  mining: 'ГОРНЯК',
  labour: 'РАЗНОРАБОЧИЙ',
  combat: 'ВОЕННЫЙ',
  cleaning: 'УБОРЩИК',
  research: 'ИССЛЕДОВАТЕЛЬ',
  tech: 'ТЕХНИК',
  construction: 'СТРОИТЕЛЬ',
  diving: 'ВОДОЛАЗ',
};
