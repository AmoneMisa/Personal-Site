// Full project catalog for the /projects page — grouped, bilingual. Single source
// of truth for the complete list (the home page shows a curated teaser subset).

export interface ProjectItem {
  name: string;
  stack: string;
  href: string | null;
  description: string;
}
export interface ProjectGroup {
  title: string;
  items: ProjectItem[];
}

interface RawItem {
  name: string;
  stack: string;
  href: string | null;
  ru: string;
  en: string;
}
interface RawGroup {
  ru: string;
  en: string;
  items: RawItem[];
}

const GROUPS: RawGroup[] = [
  {
    ru: "Веб и инструменты",
    en: "Web & tools",
    items: [
      {
        name: "WhitesLove — каталог инструментов",
        stack: "Vue.js · Nuxt.js · SSR",
        href: "/services",
        ru: "Персональная платформа онлайн-инструментов: PDF-редактор, слияние JSON, поиск тегов DockerHub, редакторы email/markdown/SVG. Тот же стек, что и в основной работе — Nuxt с SSR, мультиязычность, собственный REST-бэкенд.",
        en: "A personal platform of online tools: PDF editor, JSON merge, DockerHub tag search, email/markdown/SVG editors. The same stack as my main work — Nuxt with SSR, multi-language, a custom REST backend.",
      },
    ],
  },
  {
    ru: "Backend",
    en: "Backend",
    items: [
      {
        name: "Personal Site Backend",
        stack: "Python · FastAPI · PostgreSQL · Redis",
        href: "https://github.com/AmoneMisa/Personal-Site-Backend",
        ru: "Бэкенд для собственных сервисов сайта: REST API на FastAPI, обработка файлов (PDF, конвертация), кэширование в Redis. Питает инструменты из каталога.",
        en: "The backend for the site's own services: a FastAPI REST API, file processing (PDF, conversion), Redis caching. It powers the tools in the catalog.",
      },
    ],
  },
  {
    ru: "Десктоп (Electron)",
    en: "Desktop (Electron)",
    items: [
      {
        name: "i18n Properties Manager",
        stack: "Electron.js · Vite",
        href: "https://github.com/AmoneMisa/i18nPropertiesManager",
        ru: "Менеджер файлов локализации, включая .ftlh (Freemarker) — та же технология, что я использую в работе на BPC. Сравнение, слияние и правка ключей перевода.",
        en: "A localization-files manager, including .ftlh (Freemarker) — the same tech I use at BPC. Compare, merge and edit translation keys.",
      },
      {
        name: "Менеджер персонажей для Lost Ark",
        stack: "Electron.js · Vue.js",
        href: null,
        ru: "Автоматически подтягивает данные персонажей парсингом HTML, отслеживает игровые активности с автосбросом по расписанию.",
        en: "Automatically pulls character data by parsing HTML, and tracks in-game activities with a scheduled auto-reset.",
      },
    ],
  },
  {
    ru: "Мобильные",
    en: "Mobile",
    items: [
      {
        name: "MediKit",
        stack: "React Native · TypeScript",
        href: "https://github.com/AmoneMisa/MediKit",
        ru: "Приложение для учёта домашней аптечки: сроки годности, остатки лекарств и общий доступ для семьи.",
        en: "A home medicine-cabinet tracker: expiry dates, remaining stock, and shared family access.",
      },
      {
        name: "Fun Things Tracker",
        stack: "React Native (Expo) · TypeScript",
        href: "https://github.com/AmoneMisa/FunThingsTracker",
        ru: "Поиск, отслеживание и группировка того, что хочется или уже удалось посмотреть, прочитать или посетить: манга, книги, фильмы, сериалы, места.",
        en: "Search, track and group what you want to (or already did) watch, read or visit: manga, books, films, series, places.",
      },
      {
        name: "Rustic Price Converter",
        stack: "Kotlin (native Android)",
        href: "https://github.com/AmoneMisa/RusticPriceConvertor",
        ru: "Конвертер валют и сравнение цен на лету.",
        en: "Currency conversion and on-the-fly price comparison.",
      },
    ],
  },
  {
    ru: "Боты",
    en: "Bots",
    items: [
      {
        name: "Genshin Impact bot",
        stack: "Node.js · Telegram",
        href: "https://github.com/AmoneMisa/Genshin-Impact-tg-bot",
        ru: "Открытый бот для групп: мини-игры (карточки, слоты, боулинг, боссы), система опыта, лута и снаряжения, админ-инструменты для управления участниками.",
        en: "An open group bot: mini-games (cards, slots, bowling, bosses), an XP / loot / gear system, and admin tools for managing members.",
      },
    ],
  },
  {
    ru: "Моды и патчеры для игр (C#)",
    en: "Game mods & patchers (C#)",
    items: [
      {
        name: "Increase Hard Mod — R.E.P.O.",
        stack: "C# · BepInEx / HarmonyLib",
        href: "https://github.com/AmoneMisa/Repo-Increase-Difficulty-Mod",
        ru: "Мод сложности для кооп-игры: масштабирует врагов по прогрессу забега, добавляет случайные модификаторы за уровень и командную систему пинга поверх Photon.",
        en: "A difficulty mod for a co-op game: scales enemies by run progress, adds random per-level modifiers and a team ping system over Photon.",
      },
      {
        name: "AutoTranslateTexts",
        stack: "C# · Skyrim SE/AE",
        href: "https://github.com/AmoneMisa/AutoTranslateTexts",
        ru: "Патчер для Skyrim: автоперевод строк модов через уже существующие переводы (не машинный переводчик).",
        en: "A Skyrim patcher: auto-translates mod strings using already-existing translations (not a machine translator).",
      },
      {
        name: "FreeFastTravel",
        stack: "C# · Synthesis / Mutagen",
        href: "https://github.com/AmoneMisa/FreeFastTravel",
        ru: "Synthesis-патчер для Skyrim: снимает блокировку быстрого перемещения с внешних локаций, не трогая квестовые.",
        en: "A Synthesis patcher for Skyrim: removes the fast-travel lock from exterior locations without touching quest ones.",
      },
      {
        name: "AllBooksHavePerks",
        stack: "C# · Skyrim SE/AE",
        href: "https://github.com/AmoneMisa/AllBooksHavePerks",
        ru: "Патчер для Skyrim: добавляет случайный перк к каждой книге в игре.",
        en: "A Skyrim patcher: adds a random perk to every book in the game.",
      },
      {
        name: "MoreGoldForMerchants",
        stack: "C# · Skyrim",
        href: "https://github.com/AmoneMisa/MoreGoldForMerchants",
        ru: "Мод для увеличения количества золота у торговцев.",
        en: "A mod that increases the amount of gold merchants carry.",
      },
    ],
  },
];

export function useProjects() {
  const { locale } = useI18n();
  return computed<ProjectGroup[]>(() =>
    GROUPS.map((g) => ({
      title: locale.value === "en" ? g.en : g.ru,
      items: g.items.map((it) => ({
        name: it.name,
        stack: it.stack,
        href: it.href,
        description: locale.value === "en" ? it.en : it.ru,
      })),
    }))
  );
}
