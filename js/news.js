// "Вестник нашей семьи" — one shared source of entries for both the home page
// section and the dedicated page. Add an object here and it appears in both.
//
// Every entry states only what a source actually says. Where two documents
// disagree, both readings are kept. Nothing here is invented.

const FAMILY_NEWS = [
  {
    id: "wedding-1986",
    date: "1986-09-06",
    dateLabel: "6 сентября 1986",
    place: "Пермь",
    title: "Свадьба Владимира и Людмилы",
    body: [
      "С этого дня и считаются сорок лет. Владимир Витальевич Аспидов и Людмила Михайловна Тукачёва расписались в Перми, и две линии рода, которые до того шли порознь, сошлись в одну.",
      "Людмиле в тот день было двадцать шесть: она родилась в заводском Чёрмозе 25 сентября 1959 года. Через год, в 1987 году, в Перми родилась Алла."
    ],
    photo: { src: "assets/photos/wedding.jpg", alt: "Владимир и Людмила в день свадьбы, 6 сентября 1986 года, Пермь" },
    sources: []
  },
  {
    id: "alla-1987",
    date: "1987-01-01",
    dateLabel: "1987",
    place: "Пермь",
    title: "Рождение Аллы",
    body: [
      "Дочь Владимира и Людмилы родилась в Перми. Позже семья переехала в Москву; точная дата переезда пока не установлена."
    ],
    sources: []
  },
  {
    id: "syrchikov-ivan-sergeevich-2012",
    date: "2012-01-01",
    dateLabel: "2012",
    place: "Смоленская область",
    title: "Ивана Сергеевича Сырчикова нашли через семьдесят лет",
    body: [
      "Иван Сергеевич Сырчиков, 1901 года рождения, Васильевский сельсовет Ильинского района, пропал без вести в декабре 1941 года. Его останки нашли поисковики в 2012 году и перезахоронили в Смоленской области.",
      "По документам он приходится братом Степану Сергеевичу и Марии Сергеевне Сырчиковым."
    ],
    sources: [
      { label: "Публикация поискового движения", url: "https://otechestvort.ru/izdat/book12/017.htm" },
      { label: "Карточка ПермГАСПИ", url: "https://www.permgaspi.ru/membook/index.php?id=172010" }
    ]
  },
  {
    id: "syrchikov-ivan-stepanovich-1941",
    date: "1941-12-29",
    dateLabel: "Декабрь 1941",
    place: "Ильинский район, Чёрмоз",
    title: "Иван Степанович Сырчиков ушёл на фронт из Чёрмоза",
    body: [
      "Иван Степанович Сырчиков, 1907 года рождения, был призван в Чёрмозе в 1941 году и попал в 46-ю стрелковую бригаду. Возможный брат Марии Степановны, бабушки Людмилы по матери.",
      "Документы расходятся: ОБД «Мемориал» пишет о гибели 29 декабря 1941 года у Гаврилова, ПермГАСПИ формулирует исход как пропажу без вести в декабре. Оба чтения сохранены."
    ],
    sources: [
      { label: "Запись ОБД «Мемориал»", url: "https://obd-memorial.ru/html/info.htm?id=551438577" },
      { label: "Карточка ПермГАСПИ", url: "https://www.permgaspi.ru/membook/index.php?id=172012" }
    ]
  },
  {
    id: "politov-petr-1943",
    date: "1943-10-13",
    dateLabel: "Октябрь 1943",
    place: "Мишурин Рог или Михайловка",
    title: "Пётр Фёдорович Политов погиб под Днепром",
    body: [
      "Брат Анны Фёдоровны, бабушки Владимира. Родился в 1925 году, призван в 1943 году Верещагинским РВК, красноармеец первой гвардейской воздушно-десантной дивизии.",
      "Два документа расходятся в дате и месте захоронения: ОБД «Мемориал» называет 13 октября и Мишурин Рог, а книга памяти Верещагинского района называет 18 октября и Михайловку. В древе сохранены оба варианта."
    ],
    sources: [
      { label: "Запись ОБД «Мемориал»", url: "https://obd-memorial.ru/html/info.htm?id=503665796" }
    ]
  },
  {
    id: "aspidov-mikhail-1942",
    date: "1942-01-13",
    dateLabel: "13 января 1942",
    place: "Оса, Пермский край",
    title: "Связиста Аспидова призвали Осинским РВК",
    body: [
      "Михаил Николаевич Аспидов, 1899 года рождения, уроженец деревни Тюремки, прадед Владимира. Служил связистом. Пропал без вести в июне 1943 года.",
      "В документе жена записана как «Аспидова Мария Владимир.» и проживает в Тюремке, Кашкаринский сельсовет. Год призыва расходится: ПермГАСПИ пишет 1941 год, а первичный документ ОБД называет 13 января 1942 года. В базе оставлена точная дата ОБД."
    ],
    sources: [
      { label: "Документ ОБД «Мемориал»", url: "https://obd-memorial.ru/html/info.htm?id=58253101" },
      { label: "Книга памяти Пермского края", url: "https://www.permgaspi.ru/membook/index.php?id=6791" }
    ]
  },
  {
    id: "syrchikova-alexandra-1937",
    date: "1937-01-01",
    dateLabel: "1937",
    place: "деревня Сырчики",
    title: "Александра Михайловна Сырчикова была репрессирована",
    body: [
      "Родилась в 1904 году в деревне Сырчики, позже жила в Перми. Репрессирована в 1937 году, впоследствии реабилитирована.",
      "Семья подтверждает родство, но точное место присоединения к древу пока не установлено, поэтому она показана отдельно."
    ],
    sources: [
      { label: "Мартиролог Пермского «Мемориала»", url: "https://pmem.ru/index.php?id=1351" }
    ]
  },
  {
    id: "lyudmila-1959",
    date: "1959-09-25",
    dateLabel: "25 сентября 1959",
    place: "Чёрмоз",
    title: "В Чёрмозе родилась Людмила",
    body: [
      "Тукачёвы жили в заводском Чёрмозе. Металлургический завод, вокруг которого вырос город, был основан в XVIII веке и закрыт в 1956 году, за три года до рождения Людмилы.",
      "Часть старого Чёрмоза ушла под воду при создании Камского водохранилища."
    ],
    sources: [
      { label: "Историческая справка о Чёрмозе", url: "https://smgrf.ru/portfolio/chyormoz/" },
      { label: "История Чёрмозского завода", url: "https://nashural.ru/interesnoe/stranitsy-istorii-chermozskogo-metallurgicheskogo-zavoda-k-yubileyu-osnovaniya-zavoda-chast-iii/" }
    ]
  },
  {
    id: "vitaly-1935",
    date: "1935-01-03",
    dateLabel: "3 января 1935",
    place: "Тюремка, Осинский район",
    title: "Родился Виталий Михайлович Аспидов",
    body: [
      "Дед Владимира. Дата рождения известна по семейной памяти. Его отец Михаил Николаевич пропал без вести на войне, когда Виталию было восемь лет.",
      "Старший брат Виталия, Николай Михайлович, умер в Перми от старости; точные даты его жизни в семье не сохранились."
    ],
    sources: []
  },
  {
    id: "asidov-1834",
    date: "1834-01-01",
    dateLabel: "1834",
    place: "Тюремка, Осинский уезд",
    title: "Самое раннее написание фамилии: «Асидов»",
    body: [
      "В справочнике Е. Шумилова по селениям Осинского уезда за 1834 год фамилия записана без буквы «п»: Асидов. Это самый ранний известный след рода в тех местах.",
      "Соединять этих людей с Михаилом Николаевичем напрямую пока нельзя: промежуточные поколения не найдены. Ревизские сказки по Тюремке за 1834, 1850 и 1858 годы известны и ждут проверки в архиве."
    ],
    sources: [
      { label: "Справочник Е. Шумилова", url: "https://ocher.biblioteka-perm.ru/upload/pages/42199/dat_1697703723116.pdf" },
      { label: "Указатель ревизских сказок по Тюремке", url: "https://vitaboyarsh.ru/moi_proekty/spravochnik-ukazatel_naselyonnyh_punktov_v_genealogicheskih_dokumentah/gora-goskova.html" }
    ]
  },
  {
    id: "tyuremka-1827",
    date: "1827-01-01",
    dateLabel: "1827",
    place: "Осинский уезд",
    title: "Основана деревня Тюремка",
    body: [
      "Родина Аспидовых. Устиновская волость Осинского уезда, приход Вознесенской церкви села Устиновского. С 1962 года деревня называется Красные Горки."
    ],
    sources: [
      { label: "Фамилия Аспидов в Осинском районе", url: "https://osagen.ru/surnames/4-aspidov.html" }
    ]
  }
];

function newsSortedNewestFirst() {
  return [...FAMILY_NEWS].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function newsCardHtml(item) {
  const photo = item.photo
    ? `<div class="news-photo"><img src="${item.photo.src}" alt="${escapeHtml(item.photo.alt)}" loading="lazy"></div>`
    : "";
  const sources = item.sources && item.sources.length
    ? `<div class="news-sources">${item.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.label)}</a>`).join("")}</div>`
    : "";
  return `
    <article class="news-card${item.photo ? " has-photo" : ""}">
      ${photo}
      <div class="news-body">
        <h6 class="news-kicker">${escapeHtml(item.dateLabel)}${item.place ? " · " + escapeHtml(item.place) : ""}</h6>
        <h3 class="news-title">${escapeHtml(item.title)}</h3>
        ${item.body.map(p => `<p>${escapeHtml(p)}</p>`).join("")}
        ${sources}
      </div>
    </article>`;
}

function renderNews(containerId, limit) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const items = newsSortedNewestFirst();
  const shown = limit ? items.slice(0, limit) : items;
  el.innerHTML = shown.map(newsCardHtml).join("");
}
