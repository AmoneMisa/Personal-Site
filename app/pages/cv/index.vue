<script setup lang="ts">
// Recruiter-facing "hire me" / CV page — auto-routed at /cv (and /en/cv).
//
// This page is intentionally SELF-CONTAINED: unlike the rest of the site (whose
// text is served from the backend translations DB), everything here lives in the
// CV object below and switches by locale. That means the page works immediately
// with correct SEO — no DB keys to seed — and you edit your resume in ONE place.
//
// Content below is populated from your real CV (Kubai_Marharyta_Frontend). To
// tweak: verify the BPC/ITSUA bullet split (see note above `experience`), and
// consider adding a metric or two to the bullets ("cut X by 40%") — recruiters
// weight quantified impact. Everything else (contacts, skills, education,
// languages, projects) is your real data.

const SITE_URL = "https://whiteslove.me";

const links = {
  github: "https://github.com/AmoneMisa",
  portfolio: "https://amonemisa.github.io/personal/",
  site: SITE_URL,
  linkedin: "https://www.linkedin.com/in/marharyta-kubai-51520a362",
  telegram: "https://t.me/WhitesLove",
  email: "kubai.rita5@gmail.com",
  pdfUrl: "/files/Marharyta_Kubai_Frontend_Developer_CV.pdf",
};

// Language-neutral: tech keywords double as ATS + SEO signal. Order = relevance.
const skills = {
  core: ["JavaScript", "TypeScript", "HTML", "CSS / SCSS", "Responsive layout", "React"],
  frameworks: ["Vue", "Nuxt", "Vite", "Pinia", "Vuex"],
  ui: ["Tailwind", "Nuxt UI", "Vuetify", "Email template coding", "Liquid (Shopify)", "Freemarker"],
  platform: ["Node.js", "Python", "FastAPI", "REST APIs", "Cron jobs", "HTML parsing", "Electron", "Telegram / Discord Bot API"],
  tooling: ["Git", "Docker", "CI/CD", "Swagger", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Jira", "Figma"],
};

// Real portfolio — your own shipped work in this repo. Recruiters click these.
const projects = [
  {
    name: "WhitesLove — developer tools platform",
    href: SITE_URL,
    stack: "Nuxt 4 · SSR · i18n · WebSockets",
    ru: "Персональная платформа онлайн-инструментов: SSR на Nuxt, мультиязычность, real-time чат, собственный REST-бэкенд.",
    en: "Personal platform of online tools: Nuxt SSR, multi-language, real-time chat, custom REST backend.",
  },
  {
    name: "Online PDF editor",
    href: `${SITE_URL}/services/pdf-editor`,
    stack: "pdf.js · Fabric.js · Canvas",
    ru: "Редактор PDF в браузере: правка текста, аннотации, подпись, работа со шрифтами и экспорт.",
    en: "In-browser PDF editor: text editing, annotations, signature, font handling and export.",
  },
  {
    name: "HTML email editor",
    href: `${SITE_URL}/services/email-editor`,
    stack: "Monaco · HTML email · linting",
    ru: "Редактор HTML-писем с валидацией и превью для Gmail / Outlook / Yandex.",
    en: "HTML email editor with validation and previews for Gmail / Outlook / Yandex.",
  },
  {
    name: "JSON merge & DockerHub search",
    href: `${SITE_URL}/services/merge-json`,
    stack: "Monaco · diff/merge · API",
    ru: "Утилиты для разработчиков: сравнение и слияние JSON, поиск тегов Docker-образов.",
    en: "Developer utilities: JSON compare & merge, DockerHub image-tag search.",
  },
];

// From your CV. NOTE: the Shopify vs marketplace bullets were split by best guess
// between the two roles — reorder if the attribution isn't exact.
const experience = [
  {
    role: "Frontend Developer",
    company: "BPC · Remote",
    period: "Jun 2021 — present",
    start: "2021-06",
    end: null, // present
    ru: [
      "Разработка и поддержка frontend-функций маркетплейса.",
      "Реализация и поддержка UI на шаблонах Freemarker.",
      "Улучшение и исправление адаптивной вёрстки под разные устройства.",
      "Создание и поддержка продакшн-шаблонов email.",
      "Работа с существующей кодовой базой и бизнес-ориентированными изменениями UI.",
      "Поддержка и развитие существующих e-commerce решений.",
    ],
    en: [
      "Development and support of marketplace frontend features.",
      "Implementation and maintenance of UI using Freemarker templates.",
      "Improving and fixing responsive layouts across different devices.",
      "Creating and maintaining production email templates.",
      "Working with an existing codebase and business-driven UI changes.",
      "Supporting and extending existing e-commerce solutions.",
    ],
  },
  {
    role: "Junior Frontend Developer",
    company: "ITSUA · Kharkiv",
    period: "May 2020 — May 2021",
    start: "2020-05",
    end: "2021-05",
    ru: [
      "Разработка Vue-приложения для Shopify.",
      "Кастомизация и поддержка тем Shopify на Liquid.",
      "Frontend-интеграция в экосистеме Shopify.",
    ],
    en: [
      "Development of a Vue-based application for Shopify.",
      "Customization and maintenance of Shopify themes using Liquid.",
      "Frontend integration within the Shopify ecosystem.",
    ],
  },
];

// Real education from your CV (law background — included honestly).
const education = [
  {
    school: "V. N. Karazin Kharkiv National University",
    period: "2015 — 2019",
    ru: "Магистр, гражданское право",
    en: "Master's degree, Civil law",
  },
  {
    school: "National Law University — Institute of Criminal Investigation and Forensics",
    period: "2019 — 2020",
    ru: "Бакалавр",
    en: "Bachelor's degree",
  },
];

// Bilingual prose. `L` picks the current language.
const RU = {
  name: "Маргарита Кубай",
  role: "Frontend-разработчик",
  tagline: "Vue.js · Nuxt.js · TypeScript",
  availability: "Ищу позицию Middle Frontend Developer · remote или релокация с визовой поддержкой (включая супруга)",
  relocation: "Релокация: Ташкент (Узбекистан); США — Нью-Йорк, Майами, Сан-Франциско, Лос-Анджелес, Новый Орлеан",
  summary:
    "Frontend-разработчик со специализацией на e-commerce и маркетплейсах, {years}+ лет опыта. Предпочитаемый стек — Vue и Nuxt. Проектирую и интегрирую API на Node.js, создаю десктоп-приложения на Electron и ботов для Telegram и Discord.",
  location: "Бухарест, Румыния · гражданство Украины",
  languagesTitle: "Языки",
  languages: ["Русский — родной", "Українська — рідна", "English — B2", "Türkçe — A1"],
  sections: {
    skills: "Навыки",
    experience: "Опыт",
    projects: "Проекты",
    education: "Образование",
    contact: "Связаться",
  },
  cta: { download: "Скачать CV (PDF)", github: "GitHub", email: "Написать", portfolio: "Портфолио" },
  skillGroups: { core: "База", frameworks: "Vue-стек", ui: "UI / шаблоны", platform: "Backend / интеграции", tooling: "Инструменты и БД" },
};

const EN = {
  name: "Marharyta Kubai",
  role: "Frontend Developer",
  tagline: "Vue.js · Nuxt.js · TypeScript",
  availability: "Looking for a Middle Frontend Developer role · remote, or relocation with visa sponsorship (incl. spouse)",
  relocation: "Relocation: Tashkent (Uzbekistan); USA — New York, Miami, San Francisco, Los Angeles, New Orleans",
  summary:
    "Frontend developer specializing in e-commerce and marketplace projects, with {years}+ years of hands-on experience. My preferred stack is Vue and Nuxt. I design and consume APIs with Node.js, build Electron desktop apps, and integrate Telegram and Discord bots.",
  location: "Bucharest, Romania · Ukrainian citizenship",
  languagesTitle: "Languages",
  languages: ["Russian — native", "Ukrainian — native", "English — B2", "Turkish — A1"],
  sections: {
    skills: "Skills",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    contact: "Get in touch",
  },
  cta: { download: "Download CV (PDF)", github: "GitHub", email: "Email me", portfolio: "Portfolio" },
  skillGroups: { core: "Core", frameworks: "Vue stack", ui: "UI / templates", platform: "Backend / integrations", tooling: "Tooling & DBs" },
};

const { locale } = useI18n();
const L = computed(() => (locale.value === "en" ? EN : RU));
const skillGroupKeys = ["core", "frameworks", "ui", "platform", "tooling"] as const;

// ─── Auto-calculated experience ──────────────────────────────────────────────
// Whole months between "YYYY-MM" and an end ("YYYY-MM" or null = now).
function monthsBetween(start: string, end: string | null): number {
  const [sy, sm] = start.split("-").map(Number);
  const now = new Date();
  const ey = end ? Number(end.split("-")[0]) : now.getFullYear();
  const em = end ? Number(end.split("-")[1]) : now.getMonth() + 1;
  return Math.max(0, (ey - sy) * 12 + (em - sm));
}

// Total years of experience, measured from the earliest role start to today, so
// the number ticks up on its own and never goes stale.
const careerStart = computed(() =>
  experience.reduce((min, j) => (j.start < min ? j.start : min), experience[0].start)
);
const yearsExperience = computed(() => Math.floor(monthsBetween(careerStart.value, null) / 12));

// Human-readable per-role duration, e.g. "4 yr 2 mo" / "4 г. 2 мес.".
function roleDuration(start: string, end: string | null): string {
  const months = monthsBetween(start, end);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const en = locale.value === "en";
  const parts: string[] = [];
  if (y) parts.push(`${y} ${en ? "yr" : "г."}`);
  if (m) parts.push(`${m} ${en ? "mo" : "мес."}`);
  return parts.join(" ") || (en ? "<1 mo" : "<1 мес.");
}

// Summary with the live year count spliced in (used for on-page text + SEO).
const summary = computed(() => L.value.summary.replace("{years}", String(yearsExperience.value)));
const summaryEn = computed(() => EN.summary.replace("{years}", String(yearsExperience.value)));

// ─── SEO ─────────────────────────────────────────────────────────────────────
// Keyword-rich, unique per language. Set directly (not via DB i18n keys) so the
// page is correct on first paint.
useSeoMeta({
  title: () =>
    locale.value === "en"
      ? "Margarita — Frontend Developer (Vue.js · Nuxt.js · TypeScript)"
      : "Маргарита — Frontend-разработчик (Vue.js · Nuxt.js · TypeScript)",
  description: () => summary.value,
  ogType: "profile",
  ogTitle: () => `${L.value.name} — ${L.value.role}`,
  ogDescription: () => summary.value,
  twitterTitle: () => `${L.value.name} — ${L.value.role}`,
  twitterDescription: () => summary.value,
});

// Person / ProfilePage structured data — helps you surface for name/skill
// searches and gives Google a Knowledge-Panel-eligible entity.
const personLd = computed(() => {
  const sameAs = [links.github, links.portfolio, links.linkedin, links.telegram].filter(Boolean);
  const knowsAbout = [...skills.core, ...skills.frameworks, ...skills.platform];
  const person: Record<string, unknown> = {
    "@type": "Person",
    name: EN.name,
    givenName: "Marharyta",
    familyName: "Kubai",
    jobTitle: EN.role,
    description: summaryEn.value,
    url: `${SITE_URL}/cv`,
    sameAs,
    knowsAbout,
    knowsLanguage: ["Russian", "Ukrainian", "English", "Turkish"],
    nationality: {"@type": "Country", name: "Ukraine"},
    address: {"@type": "PostalAddress", addressLocality: "Bucharest", addressCountry: "RO"},
    alumniOf: education.map((e) => ({"@type": "CollegeOrUniversity", name: e.school})),
  };
  if (links.email) person.email = `mailto:${links.email}`;
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntity: person,
  };
});

useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() => JSON.stringify(personLd.value)),
    },
  ],
});
</script>

<template>
  <div class="cv">
    <!-- Hero -->
    <header class="cv__hero">
      <p class="cv__badge">{{ L.availability }}</p>
      <h1 class="cv__name">
        {{ L.name }} — <span class="cv__role">{{ L.role }}</span>
      </h1>
      <p class="cv__tagline">{{ L.tagline }}</p>
      <p class="cv__summary">{{ summary }}</p>

      <div class="cv__cta">
        <a v-if="links.pdfUrl" :href="links.pdfUrl" class="cv__btn cv__btn_primary" download>
          {{ L.cta.download }}
        </a>
        <a :href="links.github" target="_blank" rel="noopener noreferrer" class="cv__btn">
          {{ L.cta.github }}
        </a>
        <a :href="links.portfolio" target="_blank" rel="noopener noreferrer" class="cv__btn">
          {{ L.cta.portfolio }}
        </a>
        <a v-if="links.email" :href="`mailto:${links.email}`" class="cv__btn">
          {{ L.cta.email }}
        </a>
      </div>

      <p class="cv__meta">{{ L.location }}</p>
      <p class="cv__meta">{{ L.relocation }}</p>
    </header>

    <!-- Skills -->
    <section class="cv__section">
      <h2 class="cv__h2">{{ L.sections.skills }}</h2>
      <div class="cv__skills">
        <div v-for="key in skillGroupKeys" :key="key" class="cv__skill-group">
          <h3 class="cv__skill-title">{{ L.skillGroups[key] }}</h3>
          <ul class="cv__chips">
            <li v-for="s in skills[key]" :key="s" class="cv__chip">{{ s }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Experience -->
    <section class="cv__section">
      <h2 class="cv__h2">{{ L.sections.experience }}</h2>
      <ol class="cv__timeline">
        <li v-for="(job, i) in experience" :key="i" class="cv__job">
          <div class="cv__job-head">
            <span class="cv__job-role">{{ job.role }}</span>
            <span class="cv__job-company">· {{ job.company }}</span>
            <span class="cv__job-period">{{ job.period }} · {{ roleDuration(job.start, job.end) }}</span>
          </div>
          <ul class="cv__job-points">
            <li v-for="(p, j) in (locale === 'en' ? job.en : job.ru)" :key="j">{{ p }}</li>
          </ul>
        </li>
      </ol>
    </section>

    <!-- Projects -->
    <section class="cv__section">
      <h2 class="cv__h2">{{ L.sections.projects }}</h2>
      <div class="cv__projects">
        <a
            v-for="p in projects"
            :key="p.name"
            :href="p.href"
            target="_blank"
            rel="noopener noreferrer"
            class="cv__project"
        >
          <span class="cv__project-name">{{ p.name }}</span>
          <span class="cv__project-stack">{{ p.stack }}</span>
          <span class="cv__project-desc">{{ locale === 'en' ? p.en : p.ru }}</span>
        </a>
      </div>
    </section>

    <!-- Education -->
    <section class="cv__section">
      <h2 class="cv__h2">{{ L.sections.education }}</h2>
      <ol class="cv__timeline">
        <li v-for="(ed, i) in education" :key="i" class="cv__job">
          <div class="cv__job-head">
            <span class="cv__job-role">{{ ed.school }}</span>
            <span class="cv__job-period">{{ ed.period }}</span>
          </div>
          <p class="cv__edu-degree">{{ locale === 'en' ? ed.en : ed.ru }}</p>
        </li>
      </ol>
    </section>

    <!-- Languages + contact -->
    <section class="cv__section cv__section_split">
      <div>
        <h2 class="cv__h2">{{ L.languagesTitle }}</h2>
        <ul class="cv__chips">
          <li v-for="lang in L.languages" :key="lang" class="cv__chip">{{ lang }}</li>
        </ul>
      </div>
      <div>
        <h2 class="cv__h2">{{ L.sections.contact }}</h2>
        <div class="cv__cta">
          <a :href="links.github" target="_blank" rel="noopener noreferrer" class="cv__btn">GitHub</a>
          <a v-if="links.linkedin" :href="links.linkedin" target="_blank" rel="noopener noreferrer" class="cv__btn">LinkedIn</a>
          <a v-if="links.telegram" :href="links.telegram" target="_blank" rel="noopener noreferrer" class="cv__btn">Telegram</a>
          <a v-if="links.email" :href="`mailto:${links.email}`" class="cv__btn cv__btn_primary">{{ L.cta.email }}</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.cv {
  max-width: 980px;
  margin: 0 auto;
  padding: 48px 16px 80px;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.cv__hero {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cv__badge {
  align-self: flex-start;
  padding: 6px 14px;
  border-radius: 100px;
  border: 1px solid var(--ui-border);
  background: var(--color-blackest);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 500;
}

.cv__name {
  font-size: clamp(32px, 6vw, 56px);
  font-weight: 800;
  line-height: 1.05;
  color: var(--ui-text, #fff);
}

.cv__role {
  background: var(--color-primary-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.cv__tagline {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-secondary);
  letter-spacing: 0.3px;
}

.cv__summary {
  max-width: 720px;
  font-size: 17px;
  line-height: 1.6;
  color: var(--ui-text-muted);
}

.cv__meta {
  color: var(--ui-text-muted);
  font-size: 14px;
}

.cv__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
}

.cv__btn {
  display: inline-flex;
  align-items: center;
  height: 46px;
  padding: 0 20px;
  border-radius: 14px;
  font-weight: 650;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text, #fff);
  transition: 0.2s ease;
}

.cv__btn:hover {
  background: rgba(255, 255, 255, 0.07);
}

.cv__btn_primary {
  background: var(--color-primary);
  border-color: transparent;
  color: #fff;
}

.cv__btn_primary:hover {
  filter: brightness(1.12);
}

.cv__section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cv__section_split {
  display: grid;
  gap: 32px;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .cv__section_split {
    grid-template-columns: 1fr 1fr;
  }
}

.cv__h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--ui-text, #fff);
}

.cv__skills {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 640px) {
  .cv__skills {
    grid-template-columns: 1fr 1fr;
  }
}

.cv__skill-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--ui-text-muted);
  margin-bottom: 10px;
}

.cv__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.cv__chip {
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid var(--ui-border);
  background: var(--color-blackest);
  color: var(--ui-text, #fff);
  font-size: 14px;
}

.cv__timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.cv__job-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.cv__job-role {
  font-weight: 700;
  color: var(--ui-text, #fff);
}

.cv__job-company {
  color: var(--color-secondary);
}

.cv__job-period {
  margin-left: auto;
  color: var(--ui-text-muted);
  font-size: 14px;
}

.cv__job-points {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--ui-text-muted);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cv__edu-degree {
  margin: 6px 0 0;
  color: var(--ui-text-muted);
}

.cv__projects {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

@media (min-width: 640px) {
  .cv__projects {
    grid-template-columns: 1fr 1fr;
  }
}

.cv__project {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--ui-border);
  background: var(--color-blackest);
  transition: 0.2s ease;
}

.cv__project:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.cv__project-name {
  font-weight: 700;
  color: var(--ui-text, #fff);
}

.cv__project-stack {
  font-size: 13px;
  color: var(--color-secondary);
}

.cv__project-desc {
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-muted);
}

.light {
  .cv__name,
  .cv__h2,
  .cv__chip,
  .cv__project-name,
  .cv__job-role,
  .cv__btn {
    color: var(--ui-text);
  }
}
</style>
