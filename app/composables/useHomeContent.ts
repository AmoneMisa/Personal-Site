// All homepage content as data (bilingual RU/EN). Edit here, not in templates.
// The hero years stat uses a {years} token replaced in the component from
// useExperienceYears (auto-counted, so it never goes stale).

export interface DropdownItem { label: string; sub: string; href: string }
export interface SkillCard { title: string; items: string[] }
export interface ExperienceItem { period: string; title: string; meta: string; description: string; tags: string[] }
export interface PetProject { kind: string; title: string; description: string; linkLabel: string; href: string | null; span2?: boolean }
export interface NavLinkT { label: string; href: string }
export interface HeroStat { value: string; label: string }

// ---- Shared structural data (locale-independent) ----
export const CONTACTS = {
  telegram: "https://t.me/WhitesLove",
  whatsapp: "https://wa.me/whiteslove",
  linkedin: "https://www.linkedin.com/in/marharyta-kubai-51520a362",
  github: "https://github.com/AmoneMisa",
  email: "kubai.rita5@gmail.com",
};

export const TOOLS = [
  "Vue.js", "Nuxt.js", "JavaScript", "TypeScript", "SCSS", "Freemarker",
  "REST API", "Git", "Docker", "GitLab CI/CD", "PostgreSQL", "Jira", "Confluence",
];

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
        { label: "Все проекты", sub: "полный список с описаниями", href: "/projects" },
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
    h1before: "Frontend-разработчик, который доводит фичу до ",
    h1accent: "релиза",
    lead: "Маргарита Кубай, frontend-разработчик с 6+ годами коммерческого опыта в e-commerce и маркетплейсах. Работаю в основном с Vue.js и Nuxt.js, поддерживаю production-код, беру на себя легаси-проекты, интегрирую фронтенд с бэкенд-системами и закрываю задачи по доставке фичи, когда это нужно.",
    ctaPrimary: "Связаться",
    ctaText: "Что я умею",
    stats: [
      { value: "{years}+ лет", label: "коммерческой разработки" },
      { value: "E-commerce и маркетплейсы", label: "production-опыт" },
      { value: "Vue.js · Nuxt.js · TypeScript", label: "основной стек" },
    ] as HeroStat[],
    portraitCaption: "глажу котов между спринтами",
  },
  skillsSection: {
    eyebrow: "с чем работаю",
    title: "Что я умею",
    subtitle: "Фронтенд — моя основа. Беру и то, что вокруг, когда этого требует задача.",
    ctaLead: "Нужен человек, который подхватит существующий фронтенд и продвинет задачу?",
    ctaText: "Расскажите о проекте",
    cards: [
      { title: "Продуктовый фронтенд", items: [
        "Разрабатываю и поддерживаю production-интерфейсы e-commerce и маркетплейсов",
        "Работаю с Vue.js, Nuxt.js, JavaScript и TypeScript",
        "Использую Vuex / Pinia, Vuetify, Nuxt UI и Tailwind",
        "Работаю с шаблонизаторами: Freemarker, Liquid, Velocity и Nunjucks",
      ] },
      { title: "Production и легаси", items: [
        "Разбираю регрессии и баги в проде в существующих кодовых базах",
        "Беру легаси-код, не превращая каждую задачу в переписывание с нуля",
        "Работаю над каталогом, карточками товара и адаптивным поведением UI",
        "Поддерживаю фронтенд, который уже работает в проде",
      ] },
      { title: "Бэкенд и доставка", items: [
        "Пишу REST API и cron-джобы на Node.js и FastAPI",
        "Работаю с PostgreSQL, MongoDB и Redis",
        "Настраиваю и поддерживаю CI/CD-пайплайны в GitLab",
        "Работаю с Docker и участвую в релизах и деплоях",
      ] },
      { title: "Техническая коммуникация", items: [
        "Работаю напрямую с бэкенд-разработчиками, QA, дизайнерами и менеджерами",
        "Подключаюсь к клиентским звонкам, когда нужен фронтенд- или технический контекст",
        "Объясняю ограничения реализации и технические компромиссы без прятанья за жаргоном",
      ] },
      { title: "Языки", items: [
        "Русский — родной", "Украинский — родной", "Английский — B2", "Турецкий — A1",
      ] },
    ] as SkillCard[],
  },
  experienceSection: {
    eyebrow: "опыт",
    title: "Коммерческий опыт",
    subtitle: "",
    items: [
      { period: "2021 — сейчас", title: "Frontend Developer, BPC", meta: "Remote · Vue.js, Freemarker",
        description: "Разработка и поддержка production-фронтенда маркетплейса. Работаю с Vue.js, Freemarker и Velocity, делаю и поддерживаю адаптивные интерфейсы и production email-шаблоны, реализую бизнес-изменения, разбираю регрессии и тесно работаю с бэкенд-разработчиками, QA и дизайном. Также работаю с Docker, CI/CD и релизами наравне с фронтенд-разработкой.",
        tags: ["Vue.js", "Freemarker", "Velocity", "Email-шаблоны", "Docker", "CI/CD"] },
      { period: "2020 — 2021", title: "Junior Frontend Developer, ITSUA", meta: "Харьков · Vue.js, Shopify, Liquid",
        description: "Работала над e-commerce проектами на Shopify: разработка приложения на Vue.js, кастомизация тем на Liquid, интеграции и поддержка существующего функционала витрины.",
        tags: ["Vue.js", "Shopify", "Liquid"] },
    ] as ExperienceItem[],
  },
  petSection: {
    eyebrow: "вне работы",
    title: "Pet-проекты",
    subtitle: "Использую сайд-проекты, чтобы работать с технологиями и продуктовыми идеями, которые не всегда попадают в повседневную фронтенд-работу.",
    allLabel: "Все проекты",
    items: [
      { kind: "Web · Vue.js / Nuxt.js", title: "Каталог инструментов", span2: true,
        description: "Небольшие веб-утилиты: PDF-редактор, слияние JSON, поиск в DockerHub и другие инструменты.",
        linkLabel: "Все сервисы", href: "/services" },
      { kind: "Desktop · Electron.js + Vite", title: "i18n Properties Manager",
        description: "Десктоп-инструмент для работы с файлами локализации, включая процессы с Freemarker .ftlh.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/i18nPropertiesManager" },
      { kind: "Desktop · Electron.js + Vue.js", title: "Менеджер персонажей Lost Ark",
        description: "Подтягивает данные персонажей из веба и отслеживает повторяющиеся игровые активности с автосбросом.",
        linkLabel: "Подробнее", href: null },
      { kind: "Mobile · React Native + TypeScript", title: "MediKit",
        description: "Общий трекер домашней аптечки: сроки годности, остатки лекарств и доступ для семьи.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/MediKit" },
      { kind: "Mobile · React Native + TypeScript", title: "Fun Things Tracker",
        description: "Личный трекер книг, манги, фильмов, сериалов, мест и всего, что хочется найти или запомнить.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/FunThingsTracker" },
      { kind: "Telegram-бот · Node.js", title: "Genshin Impact bot",
        description: "Групповой бот с мини-играми, системой опыта, лута, снаряжения и админ-инструментами.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/Genshin-Impact-tg-bot" },
      { kind: "Android · Kotlin", title: "Rustic Price Converter",
        description: "Нативное Android-приложение для конвертации валют и быстрого сравнения цен.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/RusticPriceConvertor" },
    ] as PetProject[],
  },
  toolsSection: { eyebrow: "повседневный стек", title: "Чем пользуюсь регулярно" },
  closingCta: {
    text: "Нужно больше, чем ещё один компонент? Я работаю с существующими продуктами, легаси-кодом, интеграциями и production-релизами — в основном вокруг Vue.js и Nuxt.js. Если это похоже на вашу задачу — расскажите о ней.",
    contactLabel: "Связаться",
    cvLabel: "Смотреть CV",
  },
  footer: {
    tag: "Frontend-разработчик. Собираю production-интерфейсы и довожу фичи до релиза.",
    navTitle: "Навигация",
    navLinks: [
      { label: "Резюме", href: "/cv" },
      { label: "Обо мне", href: "/about" },
      { label: "Опыт", href: "#experience" },
      { label: "Проекты", href: "/projects" },
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
        { label: "All projects", sub: "full list with descriptions", href: "/projects" },
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
    h1before: "Frontend developer who can take a feature all the way to ",
    h1accent: "release",
    lead: "I'm Marharyta Kubai, a frontend developer with 6+ years of commercial experience in e-commerce and marketplaces. I work mainly with Vue.js and Nuxt.js, maintain production code, take over legacy projects, integrate frontend with backend systems, and handle the delivery work around a feature when needed.",
    ctaPrimary: "Get in touch",
    ctaText: "See what I do",
    stats: [
      { value: "{years}+ years", label: "commercial development" },
      { value: "E-commerce & marketplaces", label: "production experience" },
      { value: "Vue.js · Nuxt.js · TypeScript", label: "core stack" },
    ],
    portraitCaption: "petting cats between sprints",
  },
  skillsSection: {
    eyebrow: "what I work with",
    title: "What I do",
    subtitle: "Frontend is my core. I handle the parts around it when the task needs it.",
    ctaLead: "Need someone who can pick up an existing frontend and move the task forward?",
    ctaText: "Tell me about the project",
    cards: [
      { title: "Product frontend", items: [
        "Build and maintain production e-commerce and marketplace interfaces",
        "Work with Vue.js, Nuxt.js, JavaScript and TypeScript",
        "Use Vuex / Pinia, Vuetify, Nuxt UI and Tailwind",
        "Work with template-driven frontends: Freemarker, Liquid, Velocity and Nunjucks",
      ] },
      { title: "Production & legacy", items: [
        "Investigate regressions and production bugs in existing codebases",
        "Take over legacy code without turning every task into a rewrite",
        "Work on catalogue, product-card and responsive UI behaviour",
        "Maintain frontend that is already used in production",
      ] },
      { title: "Backend & delivery", items: [
        "Build REST APIs and scheduled jobs with Node.js and FastAPI",
        "Work with PostgreSQL, MongoDB and Redis",
        "Set up and maintain GitLab CI/CD pipelines",
        "Work with Docker and participate in releases and deploys",
      ] },
      { title: "Technical communication", items: [
        "Work directly with backend developers, QA, designers and managers",
        "Join client calls when frontend or technical context is needed",
        "Explain implementation constraints and technical trade-offs without hiding behind jargon",
      ] },
      { title: "Languages", items: [
        "Russian — native", "Ukrainian — native", "English — B2", "Turkish — A1",
      ] },
    ],
  },
  experienceSection: {
    eyebrow: "experience",
    title: "Commercial experience",
    subtitle: "",
    items: [
      { period: "2021 — present", title: "Frontend Developer, BPC", meta: "Remote · Vue.js, Freemarker",
        description: "Development and support of a production marketplace frontend. I work with Vue.js, Freemarker and Velocity, build and maintain responsive interfaces and production email templates, implement business changes, investigate regressions and work closely with backend developers, QA and design. I also work with Docker, CI/CD and releases alongside frontend development.",
        tags: ["Vue.js", "Freemarker", "Velocity", "Email templates", "Docker", "CI/CD"] },
      { period: "2020 — 2021", title: "Junior Frontend Developer, ITSUA", meta: "Kharkiv · Vue.js, Shopify, Liquid",
        description: "Worked on Shopify e-commerce projects: Vue.js application development, Liquid theme customisation, integrations and support of existing storefront functionality.",
        tags: ["Vue.js", "Shopify", "Liquid"] },
    ],
  },
  petSection: {
    eyebrow: "things I build outside work",
    title: "Pet projects",
    subtitle: "I use side projects to work with technologies and product ideas that don't always fit into my day-to-day frontend work.",
    allLabel: "All projects",
    items: [
      { kind: "Web · Vue.js / Nuxt.js", title: "Tools catalog", span2: true,
        description: "Small web utilities including a PDF editor, JSON merge, DockerHub search and other tools.",
        linkLabel: "All services", href: "/services" },
      { kind: "Desktop · Electron.js + Vite", title: "i18n Properties Manager",
        description: "A desktop tool for working with localisation files, including Freemarker .ftlh workflows.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/i18nPropertiesManager" },
      { kind: "Desktop · Electron.js + Vue.js", title: "Lost Ark Character Manager",
        description: "Pulls character data from the web and keeps track of recurring in-game activities with automatic resets.",
        linkLabel: "Details", href: null },
      { kind: "Mobile · React Native + TypeScript", title: "MediKit",
        description: "A shared home medicine-cabinet tracker for expiry dates, remaining stock and family access.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/MediKit" },
      { kind: "Mobile · React Native + TypeScript", title: "Fun Things Tracker",
        description: "A personal tracker for books, manga, films, series, places and other things you want to discover or remember.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/FunThingsTracker" },
      { kind: "Telegram bot · Node.js", title: "Genshin Impact Bot",
        description: "A group bot with mini-games, XP, loot, equipment and administration tools.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/Genshin-Impact-tg-bot" },
      { kind: "Android · Kotlin", title: "Rustic Price Converter",
        description: "A native Android app for currency conversion and quick price comparison.",
        linkLabel: "GitHub", href: "https://github.com/AmoneMisa/RusticPriceConvertor" },
    ],
  },
  toolsSection: { eyebrow: "day-to-day stack", title: "Tools I use regularly" },
  closingCta: {
    text: "Have a frontend problem that needs more than another component? I work with existing products, legacy code, integrations and production releases — mostly around Vue.js and Nuxt.js. If that sounds close to what you're working on, tell me about the task.",
    contactLabel: "Contact me",
    cvLabel: "View CV",
  },
  footer: {
    tag: "Frontend developer. I build production interfaces and take features through to release.",
    navTitle: "Navigation",
    navLinks: [
      { label: "CV", href: "/cv" },
      { label: "About", href: "/about" },
      { label: "Experience", href: "#experience" },
      { label: "Projects", href: "/projects" },
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
