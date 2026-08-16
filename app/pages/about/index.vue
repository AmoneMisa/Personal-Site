<script setup lang="ts">
// "Подробнее обо мне" — the personal long-read (Part 2). Content is bilingual
// data at the top of the file; edit here, not in the template.
import RedesignEmoji from "~/components/redesign/RedesignEmoji.vue";

const localePath = useLocalePath();

// Shared structural data (locale-independent).
const backendHref = "https://github.com/AmoneMisa/Personal-Site/tree/master/backend";
const MODS = [
  { title: "Increase Hard Mod — R.E.P.O.", tech: "C# · BepInEx / HarmonyLib", href: "https://github.com/AmoneMisa/Repo-Increase-Difficulty-Mod" },
  { title: "AutoTranslateTexts", tech: "C# · Skyrim SE/AE", href: "https://github.com/AmoneMisa/AutoTranslateTexts" },
  { title: "FreeFastTravel", tech: "C# · Synthesis / Mutagen", href: "https://github.com/AmoneMisa/FreeFastTravel" },
  { title: "AllBooksHavePerks", tech: "C# · Skyrim SE/AE", href: "https://github.com/AmoneMisa/AllBooksHavePerks" },
  { title: "MoreGoldForMerchants", tech: "C# · Skyrim", href: "https://github.com/AmoneMisa/MoreGoldForMerchants" },
];
const HOBBIES = [
  { cp: "1f3ae", key: "solo" },
  { cp: "1f5e1", key: "l2" },
  { cp: "1f697", key: "gta" },
  { cp: "1f63b", key: "cats" },
  { cp: "1f988", key: "sharks" },
];

const RU = {
  heroEyebrow: "обо мне подробнее",
  heroTitle: "Подробнее обо мне",
  heroLead: "Главная — про работу за десять секунд. Здесь — то, что интереснее читать, когда уже зацепило: как я хочу работать, что делаю вне работы и откуда пришла в разработку.",
  personEyebrow: "что я за человек",
  personTitle: "Что я за человек",
  personIntro: "Украинка, сейчас живу в Бухаресте. Немного о том, как я работаю и что мне важно — помимо строчек в резюме.",
  person: [
    "Беру задачу целиком — мне спокойнее довести фичу от макета до продакшена и деплоя, чем передавать её по кусочкам.",
    "Не паникую на пожаре: баги и регрессии в проде под нагрузкой — это про «сфокусироваться и починить», а не про стресс.",
    "Учусь через практику — осваиваю новое, собирая пет-проекты: от Electron-приложений до ботов и мобильных.",
    "Люблю понятность: чужой легаси разбираю аккуратно и оставляю код чище, чем нашла.",
    "Командный человек — спокойно работаю с бэкендом, тестировщиками и дизайнером, подключаюсь к клиенту, когда нужна техническая сторона.",
  ],
  workEyebrow: "как я хочу работать",
  workTitle: "Формат работы и логистика",
  work: [
    "Полностью удалённая работа — в приоритете.",
    "Рассматриваю релокацию в Ташкент.",
    "Либо гибрид в Майами, Нью-Йорке, Лос-Анджелесе, Сан-Франциско или Новом Орлеане — с визовой поддержкой, включающей переезд с супругом.",
    "Внутри команды русский, английский или украинский — со всеми ок.",
  ],
  projectsEyebrow: "ещё вне работы",
  projectsTitle: "Проекты, не попавшие на главную",
  backend: {
    kind: "Backend · Python",
    title: "Personal Site Backend",
    description: "Бэкенд для собственных сервисов сайта: Python, PostgreSQL, Redis, WebSockets. Отсюда работают инструменты из каталога.",
  },
  modsTitle: "Моды и патчеры для игр (C#)",
  hobbiesEyebrow: "вне экрана кода",
  hobbiesTitle: "Старые увлечения",
  hobbies: {
    solo: { title: "Solo Leveling: Arise", subtitle: "текущее прохождение" },
    l2: { title: "Lineage 2", subtitle: "с юности" },
    gta: { title: "GTA", subtitle: "олдскул" },
    cats: { title: "Коты", subtitle: "официальный soft skill" },
    sharks: { title: "Акулы", subtitle: "талисман сайта" },
  },
  eduEyebrow: "откуда пришла",
  eduTitle: "Образование",
  eduNote: "Юридическое, не по специальности — но часть истории того, как я оказалась в разработке.",
  edu: [
    { period: "2015 — 2019", school: "Харьковский национальный университет им. В. Н. Каразина", degree: "Магистр, гражданское право" },
    { period: "2019 — 2020", school: "Национальный юридический университет — Институт криминалистики", degree: "Бакалавр" },
  ],
  backLabel: "На главную",
  linkGithub: "GitHub",
};

const EN: typeof RU = {
  heroEyebrow: "more about me",
  heroTitle: "More about me",
  heroLead: "The home page is the ten-second version. This is the part that's nicer to read once you're interested: how I want to work, what I do outside work, and how I got into development.",
  personEyebrow: "what kind of person I am",
  personTitle: "What kind of person I am",
  personIntro: "Ukrainian citizen, currently living in Bucharest. A bit about how I work and what matters to me — beyond the resume bullets.",
  person: [
    "I take the whole task — I'd rather carry a feature from mockup to production and deploy than hand it off in pieces.",
    "I don't panic when things are on fire: prod bugs and regressions under load are about focusing and fixing, not stress.",
    "I learn by building — I pick up new things through pet projects, from Electron apps to bots and mobile.",
    "I like clarity: I untangle other people's legacy carefully and leave the code cleaner than I found it.",
    "I'm a team person — I work easily with backend, testers and the designer, and step in with clients when the technical side is needed.",
  ],
  workEyebrow: "how I want to work",
  workTitle: "Work format & logistics",
  work: [
    "Fully remote — my priority.",
    "Open to relocation to Tashkent.",
    "Or hybrid in Miami, New York, Los Angeles, San Francisco or New Orleans — with visa sponsorship that covers relocating with my spouse.",
    "Russian, English or Ukrainian inside the team — all fine with me.",
  ],
  projectsEyebrow: "more outside work",
  projectsTitle: "Projects that didn't make the home page",
  backend: {
    kind: "Backend · Python",
    title: "Personal Site Backend",
    description: "The backend for this site's own services: Python, PostgreSQL, Redis, WebSockets. It powers the tools in the catalog.",
  },
  modsTitle: "Game mods & patchers (C#)",
  hobbiesEyebrow: "away from the code",
  hobbiesTitle: "Long-time hobbies",
  hobbies: {
    solo: { title: "Solo Leveling: Arise", subtitle: "currently playing" },
    l2: { title: "Lineage 2", subtitle: "since my teens" },
    gta: { title: "GTA", subtitle: "old-school" },
    cats: { title: "Cats", subtitle: "official soft skill" },
    sharks: { title: "Sharks", subtitle: "the site's mascot" },
  },
  eduEyebrow: "where I came from",
  eduTitle: "Education",
  eduNote: "Law, not my current field — but part of the story of how I ended up in development.",
  edu: [
    { period: "2015 — 2019", school: "V. N. Karazin Kharkiv National University", degree: "Master's, Civil law" },
    { period: "2019 — 2020", school: "National Law University — Institute of Criminal Investigation and Forensics", degree: "Bachelor's" },
  ],
  backLabel: "Back to home",
  linkGithub: "GitHub",
};

const { locale } = useI18n();
const c = computed(() => (locale.value === "en" ? EN : RU));

useSeoMeta({
  title: () => (locale.value === "en" ? "More about me — Marharyta Kubai" : "Подробнее обо мне — Маргарита Кубай"),
  description: () => c.value.heroLead,
  ogType: "profile",
  ogTitle: () => c.value.heroTitle,
  ogDescription: () => c.value.heroLead,
  twitterTitle: () => c.value.heroTitle,
  twitterDescription: () => c.value.heroLead,
});
</script>

<template>
  <div class="about-page">
    <section class="rd-section about-page__hero">
      <div class="rd-wrap">
        <div class="about-page__eyebrow mono">{{ c.heroEyebrow }}</div>
        <h1 class="about-page__title">{{ c.heroTitle }}</h1>
        <p class="about-page__lead">{{ c.heroLead }}</p>
      </div>
    </section>

    <div class="rd-divider" />

    <!-- What kind of person -->
    <section class="rd-section about-page__section" id="person">
      <div class="rd-wrap">
        <div class="about-page__section-header">
          <div class="about-page__eyebrow mono">{{ c.personEyebrow }}</div>
          <h2 class="about-page__section-title">{{ c.personTitle }}</h2>
          <p class="about-page__section-subtitle">{{ c.personIntro }}</p>
        </div>
        <ul class="about-page__fact-list">
          <li v-for="(trait, i) in c.person" :key="i" class="about-page__fact"><span class="about-page__dash" />{{ trait }}</li>
        </ul>
      </div>
    </section>

    <div class="rd-divider" />

    <!-- Work format -->
    <section class="rd-section about-page__section">
      <div class="rd-wrap">
        <div class="about-page__section-header">
          <div class="about-page__eyebrow mono">{{ c.workEyebrow }}</div>
          <h2 class="about-page__section-title">{{ c.workTitle }}</h2>
        </div>
        <ul class="about-page__fact-list">
          <li v-for="(w, i) in c.work" :key="i" class="about-page__fact"><span class="about-page__dash" />{{ w }}</li>
        </ul>
      </div>
    </section>

    <div class="rd-divider" />

    <!-- Extra projects -->
    <section class="rd-section about-page__section">
      <div class="rd-wrap">
        <div class="about-page__section-header">
          <div class="about-page__eyebrow mono">{{ c.projectsEyebrow }}</div>
          <h2 class="about-page__section-title">{{ c.projectsTitle }}</h2>
        </div>

        <a class="about-page__project about-page__project_wide" :href="backendHref" target="_blank" rel="noopener noreferrer">
          <div>
            <div class="about-page__project-kind mono">{{ c.backend.kind }}</div>
            <h3 class="about-page__project-title">{{ c.backend.title }}</h3>
            <p class="about-page__project-description">{{ c.backend.description }}</p>
          </div>
          <span class="about-page__project-link mono">{{ c.linkGithub }} →</span>
        </a>

        <h4 class="about-page__mods-title mono">{{ c.modsTitle }}</h4>
        <div class="about-page__mods-grid">
          <a v-for="m in MODS" :key="m.title" class="about-page__project" :href="m.href" target="_blank" rel="noopener noreferrer">
            <div>
              <div class="about-page__project-kind mono">{{ m.tech }}</div>
              <h3 class="about-page__project-title">{{ m.title }}</h3>
            </div>
            <span class="about-page__project-link mono">{{ c.linkGithub }} →</span>
          </a>
        </div>
      </div>
    </section>

    <div class="rd-divider" />

    <!-- Hobbies -->
    <section class="rd-section about-page__section">
      <div class="rd-wrap">
        <div class="about-page__section-header">
          <div class="about-page__eyebrow mono">{{ c.hobbiesEyebrow }}</div>
          <h2 class="about-page__section-title">{{ c.hobbiesTitle }}</h2>
        </div>
        <div class="about-page__hobbies">
          <div v-for="h in HOBBIES" :key="h.key" class="about-page__hobby">
            <redesign-emoji :cp="h.cp" :size="26" :alt="(c.hobbies as any)[h.key].title" />
            <div>
              <div class="about-page__hobby-title">{{ (c.hobbies as any)[h.key].title }}</div>
              <div class="about-page__hobby-subtitle mono">{{ (c.hobbies as any)[h.key].subtitle }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="rd-divider" />

    <!-- Education -->
    <section class="rd-section about-page__section">
      <div class="rd-wrap">
        <div class="about-page__section-header">
          <div class="about-page__eyebrow mono">{{ c.eduEyebrow }}</div>
          <h2 class="about-page__section-title">{{ c.eduTitle }}</h2>
          <p class="about-page__section-subtitle">{{ c.eduNote }}</p>
        </div>
        <div class="about-page__timeline">
          <article v-for="ed in c.edu" :key="ed.school" class="about-page__timeline-item">
            <div class="about-page__period mono">{{ ed.period }}</div>
            <h3 class="about-page__school">{{ ed.school }}</h3>
            <div class="about-page__degree">{{ ed.degree }}</div>
          </article>
        </div>
        <a class="about-page__back-link mono" :href="localePath('/')">← {{ c.backLabel }}</a>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.about-page__eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.about-page__hero {
  padding-top: 56px;
}
.about-page__title {
  font-size: clamp(30px, 5vw, 44px);
  font-weight: 600;
  letter-spacing: -0.015em;
  margin-bottom: 18px;
}
.about-page__lead {
  color: var(--text-muted);
  font-size: 16px;
  max-width: 620px;
  line-height: 1.65;
}
.about-page__section-header {
  margin-bottom: 30px;
  max-width: 640px;
}
.about-page__section-title {
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.about-page__section-subtitle {
  color: var(--text-muted);
  margin-top: 10px;
  font-size: 14.5px;
}
.about-page__fact-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 700px;
}
.about-page__fact {
  display: flex;
  gap: 12px;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.55;
}
.about-page__dash {
  width: 12px;
  height: 1px;
  background: var(--accent-pink);
  flex-shrink: 0;
  margin-top: 11px;
}
.about-page__project {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  background: var(--bg-deep);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 22px;
  transition: border-color 0.15s;
  min-height: 130px;
}
.about-page__project:hover {
  border-color: var(--accent-pink);
}
.about-page__project_wide {
  margin-bottom: 28px;
}
.about-page__project-kind {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.about-page__project-title {
  font-size: 16px;
  font-weight: 400;
  margin-bottom: 7px;
}
.about-page__project-description {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.5;
}
.about-page__project-link {
  font-size: 12.5px;
  color: var(--text-muted);
}
.about-page__project:hover .about-page__project-link {
  color: var(--accent-pink);
}
.about-page__mods-title {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 16px;
}
.about-page__mods-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.about-page__hobbies {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  max-width: 720px;
}
.about-page__hobby {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-panel);
}
.about-page__hobby-title {
  font-size: 14.5px;
  color: var(--text-primary);
}
.about-page__hobby-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
.about-page__timeline {
  position: relative;
  padding-left: 28px;
  border-left: 1px solid var(--line);
  margin-bottom: 34px;
}
.about-page__timeline-item {
  position: relative;
  padding-bottom: 28px;
}
.about-page__timeline-item:last-child {
  padding-bottom: 0;
}
.about-page__timeline-item::before {
  content: "";
  position: absolute;
  left: -33px;
  top: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--bg-deep);
  border: 1px solid var(--accent-blue);
}
.about-page__period {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.about-page__school {
  font-size: 16px;
  font-weight: 400;
  margin-bottom: 4px;
}
.about-page__degree {
  color: var(--text-muted);
  font-size: 13.5px;
}
.about-page__back-link {
  display: inline-block;
  font-size: 13px;
  color: var(--text-muted);
}
.about-page__back-link:hover {
  color: var(--accent-pink);
}

@media (max-width: 760px) {
  .about-page__mods-grid,
  .about-page__hobbies {
    grid-template-columns: 1fr;
  }
}
</style>
