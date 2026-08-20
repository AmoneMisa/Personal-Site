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

const { tm, rt } = useI18n();
// Copy lives in i18n/locales/*.json under `about`. tm() gives the message
// tree for the active locale; a leaf may be a plain string or a compiled
// message node depending on the build, so rt() resolves the latter.
const resolve = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(resolve);
  if (node !== null && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if ("type" in record || "body" in record || "loc" in record) return rt(node as never);
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, resolve(v)]));
  }
  return node;
};
const c = computed(() => resolve(tm("about")) as Record<string, any>);

useSeoMeta({
  title: () => c.value.seoTitle,
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
