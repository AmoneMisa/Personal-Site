// All homepage content as data (bilingual RU/EN). Edit here, not in templates.
// The two dynamic year insertions (hero stat + skills highlight) are composed in
// the components from useExperienceYears.

export interface DropdownItem { label: string; sub: string; href: string }
export interface SkillCard { title: string; items: string[] }
export interface ExperienceItem { period: string; title: string; meta: string; description: string; tags: string[] }
export interface PetProject { kind: string; title: string; description: string; linkLabel: string; href: string | null; span2?: boolean }
export interface NavLinkT { label: string; href: string }

// ---- Shared structural data (locale-independent) ----
export const CONTACTS = {
  telegram: "https://t.me/WhitesLove",
  // WhatsApp username link. If wa.me/<username> doesn't resolve for you, replace
  // with wa.me/<full phone number> (no +, no spaces).
  whatsapp: "https://wa.me/whiteslove",
  linkedin: "https://www.linkedin.com/in/marharyta-kubai-51520a362",
  github: "https://github.com/AmoneMisa",
  email: "kubai.rita5@gmail.com",
};

export const TOOLS = [
  "Vue.js", "JavaScript", "TypeScript", "SCSS", "Freemarker", "REST API",
  "PostgreSQL", "Git", "Docker", "GitLab CI/CD", "Jira", "Confluence",
];

// Twemoji codepoints used across the page (self-hosted in /public/twemoji).
export const EMOJI = { shark: "1f988", cat: "1f63b" };

const RU = {
  nav: {
    skills: "Что я умею",
    experience: "Опыт",
    petProjects: "Pet-проекты и не только",
    tools: "Инструменты",
    cv: "Резюме",
    aboutMe: "Подробнее обо мне",
    contact: "Связаться",
    dropdown: {
      petTitle: "Pet-проекты",
      pet: [
        { label: "Каталог инструментов", sub: "Vue.js / Nuxt.js сервисы", href: "/services" },
        { label: "i18n Properties Manager", sub: "Electron.js · работа с Freemarker", href: "https://github.com/AmoneMisa/i18nPropertiesManager" },
        { label: "Менеджер персонажей", sub: "Lost Ark · Electron.js", href: "#pet-projects" },
        { label: "Все проекты на GitHub", sub: "github.com/AmoneMisa", href: "https://github.com/AmoneMisa" },
      ] as DropdownItem[],
      pagesTitle: "Полезные страницы",
      pages: [
        { label: "Подбор страны", sub: "квиз: куда переехать", href: "/quizzes/country-fit" },
        { label: "Поиск вакансий", sub: "подборка под ваш стек", href: "/jobs" },
        { label: "Все сервисы", sub: "PDF, JSON, Docker-поиск и др.", href: "/services" },
      ] as DropdownItem[],
    },
  },
  fastnav: ["Обо мне", "Что я умею", "Мой опыт", "Pet-проекты", "Инструменты", "Контакты"],
  hero: {
    eyebrow: "профиль",
    h1before: "Фронтендер с потенциалом в ",
    h1accent: "фулстек",
    lead: "Маргарита Кубай. Пять лет держу production-фронтенд e-commerce и маркетплейсов на Vue.js и Nuxt.js — и не останавливаюсь на вёрстке: пишу backend-логику, настраиваю CI/CD и деплой, разбираю чужой легаси. Беру задачу целиком, а не только свою часть.",
    ctaPrimary: "Связаться со мной",
    ctaText: "Что я умею",
    statPracticeLabel: "практики",
    statCompanies: "компании, реальный опыт",
    portraitPlaceholder: "место для живой фотографии или иллюстрации-портрета",
    portraitCaption: "глажу котов между спринтами",
  },
  skillsSection: {
    eyebrow: "чем занимаюсь на практике",
    title: "Что я умею",
    subtitle: "Пять сторон одной и той же работы — от вёрстки до общения с заказчиком.",
    highlights: [
      "Production e-commerce и маркетплейсы",
      "Весь цикл: фронт → бэк → деплой",
    ],
    highlightYearsSuffix: "практики, не только на бумаге",
    ctaLead: "Похожая задача есть прямо сейчас?",
    ctaText: "Расскажите — обсудим",
    cards: [
      { title: "Как фронтендер", items: [
        "Довожу интерфейсы маркетплейса до продакшена под реальную нагрузку — от каталога до email-шаблонов",
        "Работаю с Vuex/Pinia, Vuetify/NuxtUI/Tailwind",
        "Интегрирую фронтенд поверх любого бэкенд-шаблонизатора — Freemarker, Liquid, Velocity, Nunjucks",
      ] },
      { title: "Общение с клиентами", items: [
        "На первом месте (ITSUA) участвовала в созвонах с заказчиком вместе с менеджером, не соло",
        "На текущем проекте (BPC) несколько раз созванивалась с клиентом по функционалу в своей зоне ответственности",
        "В целом переговоры ведут менеджеры — подключаюсь точечно, когда нужна техническая сторона",
      ] },
      { title: "Решение проблем", items: [
        "Чиню регрессии и баги в проде под нагрузкой — быстро и без раскачки",
        "Ускоряю отрисовку каталога и карточек товара",
        "Беру чужой легаси-код и довожу до рабочего состояния, не переписывая всё с нуля",
      ] },
      { title: "DevOps-задачи", items: [
        "Настраиваю CI/CD-пайплайны (GitLab CI) с нуля",
        "Работаю с Docker-контейнерами в проде",
        "Веду деплой и релизы наравне с разработкой фичи — не жду отдельного DevOps-инженера",
      ] },
      { title: "Backend-задачи", items: [
        "Пишу REST API и cron-джобы на Node.js и Python (FastAPI)",
        "Работаю с PostgreSQL, MongoDB, Redis; парсю HTML для интеграций",
        "Довожу Telegram/Discord-ботов и Electron-приложения до релиза как отдельные продукты",
      ] },
      { title: "Языки", items: [
        "Русский — родной", "Украинский — родной", "Английский — B2", "Турецкий — A1",
      ] },
    ] as SkillCard[],
  },
  experienceSection: {
    eyebrow: "хронология",
    title: "Мой опыт",
    subtitle: "Реальная последовательность проектов — от первых верстальных задач до полноценных фронтенд-решений для маркетплейсов.",
    items: [
      { period: "2021 — сейчас", title: "Frontend Developer, BPC", meta: "Remote · Vue.js, Freemarker",
        description: "Разработка и поддержка фронтенда маркетплейса под high-load: вёрстка на Freemarker- и Velocity-шаблонах, адаптивность на разных устройствах, продакшн email-шаблоны, доработки на основе бизнес-требований. Тесная работа с бэкендом, тестировщиками и дизайнером.",
        tags: ["Vue.js", "Freemarker", "Velocity", "Email-шаблоны", "High-load", "Docker", "CI/CD"] },
      { period: "2020 — 2021", title: "Junior Frontend Developer, ITSUA", meta: "Харьков · Vue.js, Shopify, Liquid",
        description: "Приложение для Shopify на Vue.js: кастомизация и поддержка тем на Liquid, интеграция в экосистему Shopify, поддержка существующих e-commerce решений.",
        tags: ["Vue.js", "Shopify", "Liquid"] },
    ] as ExperienceItem[],
  },
  petSection: {
    eyebrow: "вне работы, но по-серьёзному",
    title: "Pet-проекты",
    subtitle: "По убыванию близости к основному стеку — от Vue.js-сервисов до нативного Android.",
    items: [
      { kind: "Web-утилиты · Vue.js / Nuxt.js", title: "Каталог инструментов", span2: true,
        description: "PDF-редактор, JSON merge, DockerHub поиск и другие небольшие сервисы — те же технологии, что и в основной работе.",
        linkLabel: "Все сервисы", href: "/services" },
      { kind: "Desktop · Electron.js + Vite", title: "i18n Properties Manager",
        description: "Менеджер файлов локализации, включая .ftlh (Freemarker) — та же технология, что используется в работе на BPC.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/i18nPropertiesManager" },
      { kind: "Desktop · Electron.js + Vue.js", title: "Менеджер персонажей для Lost Ark",
        description: "Автоматически подтягивает данные персонажей парсингом HTML, отслеживает активности с автосбросом.",
        linkLabel: "Подробнее", href: null },
      { kind: "Mobile · React Native + TypeScript", title: "MediKit",
        description: "Приложение для учёта домашней аптечки: сроки годности, остатки лекарств, доступ для семьи.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/MediKit" },
      { kind: "Mobile · React Native (Expo) + TypeScript", title: "Fun Things Tracker",
        description: "Поиск, отслеживание и группировка того, что хочется или уже удалось посмотреть/прочитать/посетить: манга, книги, фильмы, сериалы, места для посещения.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/FunThingsTracker" },
      { kind: "Telegram-бот · Node.js", title: "Genshin Impact bot",
        description: "Открытый бот для групп: мини-игры (карточки, слоты, боулинг, боссы), система опыта, лута и снаряжения, админ-инструменты для управления участниками.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/Genshin-Impact-tg-bot" },
      { kind: "Mobile · Kotlin (native Android)", title: "Rustic Price Converter",
        description: "Конвертер валют и сравнение цен на лету.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/RusticPriceConvertor" },
    ] as PetProject[],
  },
  toolsSection: { eyebrow: "чаще всего в работе", title: "Наиболее часто используемые" },
  footer: {
    tag: "Фронтендер с потенциалом в фулстек. Пишу интерфейсы, backend-логику и деплой-процессы.",
    navTitle: "Навигация",
    navLinks: [
      { label: "Резюме", href: "/cv" },
      { label: "Обо мне", href: "/about" },
      { label: "Опыт", href: "#experience" },
      { label: "Pet-проекты", href: "#pet-projects" },
    ] as NavLinkT[],
    contactsTitle: "Контакты",
    copyright: "Kubai Marharyta. Front-end Developer. 2026 ©",
    motto: "Selachii nunquam dormiunt",
  },
};

const EN: typeof RU = {
  nav: {
    skills: "What I do",
    experience: "Experience",
    petProjects: "Pet projects & more",
    tools: "Tools",
    cv: "CV",
    aboutMe: "More about me",
    contact: "Contact",
    dropdown: {
      petTitle: "Pet projects",
      pet: [
        { label: "Tools catalog", sub: "Vue.js / Nuxt.js services", href: "/services" },
        { label: "i18n Properties Manager", sub: "Electron.js · Freemarker files", href: "https://github.com/AmoneMisa/i18nPropertiesManager" },
        { label: "Character manager", sub: "Lost Ark · Electron.js", href: "#pet-projects" },
        { label: "All projects on GitHub", sub: "github.com/AmoneMisa", href: "https://github.com/AmoneMisa" },
      ],
      pagesTitle: "Useful pages",
      pages: [
        { label: "Country fit", sub: "quiz: where to relocate", href: "/quizzes/country-fit" },
        { label: "Job finder", sub: "picks for your stack", href: "/jobs" },
        { label: "All services", sub: "PDF, JSON, Docker search & more", href: "/services" },
      ],
    },
  },
  fastnav: ["About me", "What I do", "My experience", "Pet projects", "Tools", "Contact"],
  hero: {
    eyebrow: "profile",
    h1before: "A frontend dev growing into ",
    h1accent: "full-stack",
    lead: "Marharyta Kubai. Five years keeping production e-commerce and marketplace frontends running on Vue.js and Nuxt.js — and I don't stop at markup: I write backend logic, set up CI/CD and deploys, and untangle other people's legacy. I take the whole task, not just my slice.",
    ctaPrimary: "Get in touch",
    ctaText: "What I do",
    statPracticeLabel: "of practice",
    statCompanies: "companies, real experience",
    portraitPlaceholder: "space for a real photo or portrait illustration",
    portraitCaption: "petting cats between sprints",
  },
  skillsSection: {
    eyebrow: "what I actually do",
    title: "What I do",
    subtitle: "Five sides of the same job — from markup to talking with the client.",
    highlights: [
      "Production e-commerce & marketplaces",
      "Full cycle: frontend → backend → deploy",
    ],
    highlightYearsSuffix: "of practice, not just on paper",
    ctaLead: "Have a task like this right now?",
    ctaText: "Tell me — let's talk",
    cards: [
      { title: "As a frontend dev", items: [
        "Ship marketplace interfaces to production under real load — from catalog to email templates",
        "Work with Vuex/Pinia, Vuetify/NuxtUI/Tailwind",
        "Integrate the frontend on top of any backend templating engine — Freemarker, Liquid, Velocity, Nunjucks",
      ] },
      { title: "Client communication", items: [
        "At my first role (ITSUA) I joined client calls together with the manager, not solo",
        "On the current project (BPC) I've had several client calls about features in my area of responsibility",
        "Managers run negotiations in general — I step in when the technical side is needed",
      ] },
      { title: "Problem solving", items: [
        "Fix regressions and prod bugs under load — fast, no ramp-up",
        "Speed up catalog and product-card rendering",
        "Take over someone else's legacy and get it working without rewriting everything",
      ] },
      { title: "DevOps tasks", items: [
        "Set up CI/CD pipelines (GitLab CI) from scratch",
        "Work with Docker containers in production",
        "Run deploys and releases alongside feature work — I don't wait for a separate DevOps engineer",
      ] },
      { title: "Backend tasks", items: [
        "Write REST APIs and cron jobs in Node.js and Python (FastAPI)",
        "Work with PostgreSQL, MongoDB, Redis; parse HTML for integrations",
        "Ship Telegram/Discord bots and Electron apps as standalone products",
      ] },
      { title: "Languages", items: [
        "Russian — native", "Ukrainian — native", "English — B2", "Turkish — A1",
      ] },
    ],
  },
  experienceSection: {
    eyebrow: "timeline",
    title: "My experience",
    subtitle: "The real sequence of projects — from first markup tasks to full frontend solutions for marketplaces.",
    items: [
      { period: "2021 — present", title: "Frontend Developer, BPC", meta: "Remote · Vue.js, Freemarker",
        description: "Development and support of a high-load marketplace frontend: markup on Freemarker and Velocity templates, responsiveness across devices, production email templates, business-driven changes. Close work with the backend, testers and the designer.",
        tags: ["Vue.js", "Freemarker", "Velocity", "Email templates", "High-load", "Docker", "CI/CD"] },
      { period: "2020 — 2021", title: "Junior Frontend Developer, ITSUA", meta: "Kharkiv · Vue.js, Shopify, Liquid",
        description: "A Shopify app in Vue.js: theme customization and support on Liquid, integration into the Shopify ecosystem, support of existing e-commerce solutions.",
        tags: ["Vue.js", "Shopify", "Liquid"] },
    ],
  },
  petSection: {
    eyebrow: "outside work, but seriously",
    title: "Pet projects",
    subtitle: "By decreasing closeness to my main stack — from Vue.js services to native Android.",
    items: [
      { kind: "Web utilities · Vue.js / Nuxt.js", title: "Tools catalog", span2: true,
        description: "PDF editor, JSON merge, DockerHub search and other small services — the same tech as my main work.",
        linkLabel: "All services", href: "/services" },
      { kind: "Desktop · Electron.js + Vite", title: "i18n Properties Manager",
        description: "A localization-files manager, incl. .ftlh (Freemarker) — the same tech used at BPC.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/i18nPropertiesManager" },
      { kind: "Desktop · Electron.js + Vue.js", title: "Lost Ark character manager",
        description: "Pulls character data by parsing HTML, tracks activities with auto-reset.",
        linkLabel: "Details", href: null },
      { kind: "Mobile · React Native + TypeScript", title: "MediKit",
        description: "A home medicine-cabinet tracker: expiry dates, remaining stock, family access.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/MediKit" },
      { kind: "Mobile · React Native (Expo) + TypeScript", title: "Fun Things Tracker",
        description: "Search, track and group what you want to or have watched/read/visited: manga, books, films, series, places.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/FunThingsTracker" },
      { kind: "Telegram bot · Node.js", title: "Genshin Impact bot",
        description: "An open group bot: mini-games (cards, slots, bowling, bosses), an XP / loot / gear system, and admin tools for managing members.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/Genshin-Impact-tg-bot" },
      { kind: "Mobile · Kotlin (native Android)", title: "Rustic Price Converter",
        description: "Currency conversion and on-the-fly price comparison.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/RusticPriceConvertor" },
    ],
  },
  toolsSection: { eyebrow: "most often at work", title: "Most frequently used" },
  footer: {
    tag: "A frontend dev growing into full-stack. I write interfaces, backend logic and deploy processes.",
    navTitle: "Navigation",
    navLinks: [
      { label: "CV", href: "/cv" },
      { label: "About", href: "/about" },
      { label: "Experience", href: "#experience" },
      { label: "Pet projects", href: "#pet-projects" },
    ],
    contactsTitle: "Contacts",
    copyright: "Kubai Marharyta. Front-end Developer. 2026 ©",
    motto: "Selachii nunquam dormiunt",
  },
};

export function useHomeContent() {
  const { locale } = useI18n();
  return computed(() => (locale.value === "en" ? EN : RU));
}
