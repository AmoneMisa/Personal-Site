<script setup lang="ts">
// Renders one legal document from shared/legal/legalContent.ts. Operator
// facts (name, contact, governing law) come from /legal-identity, i.e. from
// deployment configuration; when any is missing the page says it requires
// operator review instead of rendering invented values. All text goes
// through {{ }} interpolation, never raw HTML binding, so configured values
// cannot inject markup.
import {
  LEGAL_CHROME,
  LEGAL_CONTENT,
  LEGAL_ROUTES,
  LEGAL_UPDATED_AT,
  fillLegalText,
  legalLocale,
  type LegalDocumentKey,
} from "~~/shared/legal/legalContent";
import type { LegalIdentity } from "~~/shared/legal/legalIdentity";

const props = defineProps<{ document: LegalDocumentKey }>();

const { locale } = useI18n();
const localePath = useLocalePath();
const lang = computed(() => legalLocale(locale.value));
const chrome = computed(() => LEGAL_CHROME[lang.value]);
const doc = computed(() => LEGAL_CONTENT[lang.value][props.document]);

const UNCONFIGURED: LegalIdentity = { controllerName: "", contactEmail: "", operatorType: "", governingLaw: "", complete: false, missing: [] };
const { data } = await useFetch<LegalIdentity>("/legal-identity", { key: "legal-identity" });
// A failed fetch is treated exactly like missing configuration: the page
// shows the review banner rather than rendering without operator details.
const identity = computed<LegalIdentity>(() => data.value ?? UNCONFIGURED);

const placeholders = computed(() => ({
  controller: identity.value.controllerName,
  email: identity.value.contactEmail,
  governingLaw: identity.value.governingLaw,
}));
const fill = (text: string) => fillLegalText(text, placeholders.value, chrome.value.unset);

// The contact address is the one value a reader needs to act on, so it is a
// real link wherever it appears on its own.
const mailto = computed(() => (identity.value.contactEmail ? `mailto:${identity.value.contactEmail}` : ""));
function splitEmail(text: string): { before: string; after: string } | null {
  if (!mailto.value || !text.includes("{email}")) return null;
  const [before, ...rest] = text.split("{email}");
  return { before: fill(before ?? ""), after: fill(rest.join("{email}")) };
}

const updated = computed(() => new Date(`${LEGAL_UPDATED_AT}T00:00:00Z`).toLocaleDateString(lang.value === "ru" ? "ru-RU" : "en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }));

const otherDocs = computed(() =>
  (Object.keys(LEGAL_ROUTES) as LegalDocumentKey[])
    .filter((key) => key !== props.document)
    .map((key) => ({ key, label: chrome.value.nav[key], href: localePath(LEGAL_ROUTES[key]) })),
);

useSeoMeta({
  title: () => `${doc.value.title} — WhitesLove`,
  description: () => doc.value.description,
  ogTitle: () => doc.value.title,
  ogDescription: () => doc.value.description,
});
</script>

<template>
  <div class="legal-page">
    <section class="rd-section legal-page__hero">
      <div class="rd-wrap">
        <div class="legal-page__eyebrow mono">{{ chrome.navTitle }}</div>
        <h1 class="legal-page__title">{{ doc.title }}</h1>
        <p class="legal-page__lead">{{ doc.description }}</p>
        <p class="legal-page__updated mono">{{ chrome.updated }}: <time :datetime="LEGAL_UPDATED_AT">{{ updated }}</time></p>
        <p v-if="!identity.complete" class="legal-page__review" role="note">{{ chrome.reviewBanner }}</p>
      </div>
    </section>

    <section class="rd-section legal-page__body">
      <div class="rd-wrap legal-page__layout">
        <nav class="legal-page__toc" :aria-label="chrome.contents">
          <h2 class="legal-page__toc-title mono">{{ chrome.contents }}</h2>
          <ol>
            <li v-for="section in doc.sections" :key="section.id">
              <a :href="`#${section.id}`">{{ section.title }}</a>
            </li>
          </ol>
        </nav>

        <article class="legal-page__article">
          <section v-for="section in doc.sections" :id="section.id" :key="section.id" class="legal-page__section">
            <h2 class="legal-page__section-title">{{ section.title }}</h2>

            <template v-for="(paragraph, index) in section.paragraphs ?? []" :key="`p-${index}`">
              <p v-if="splitEmail(paragraph)" class="legal-page__paragraph">
                {{ splitEmail(paragraph)!.before }}<a :href="mailto">{{ identity.contactEmail }}</a>{{ splitEmail(paragraph)!.after }}
              </p>
              <p v-else class="legal-page__paragraph">{{ fill(paragraph) }}</p>
            </template>

            <ul v-if="section.list" class="legal-page__list">
              <li v-for="(item, index) in section.list" :key="`l-${index}`">{{ fill(item) }}</li>
            </ul>

            <div v-if="section.table" class="legal-page__table-wrap">
              <table class="legal-page__table">
                <thead v-if="section.table.head.some(Boolean)">
                  <tr>
                    <th v-for="(cell, index) in section.table.head" :key="`h-${index}`" scope="col">{{ cell }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in section.table.rows" :key="`r-${rowIndex}`">
                    <td v-for="(cell, cellIndex) in row" :key="`c-${cellIndex}`">{{ fill(cell) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <slot />

          <nav class="legal-page__related" :aria-label="chrome.navTitle">
            <a v-for="item in otherDocs" :key="item.key" :href="item.href">{{ item.label }}</a>
          </nav>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.legal-page__hero {
  padding-top: 56px;
}
.legal-page__eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.legal-page__title {
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 600;
  letter-spacing: -0.015em;
  margin-bottom: 14px;
}
.legal-page__lead {
  color: var(--text-muted);
  font-size: 16px;
  max-width: 680px;
  line-height: 1.65;
}
.legal-page__updated {
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-muted);
}
.legal-page__review {
  margin-top: 18px;
  max-width: 680px;
  padding: 12px 14px;
  border: 1px solid var(--accent-pink);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
}
.legal-page__layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}
.legal-page__toc {
  position: sticky;
  top: 88px;
  font-size: 13px;
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  a {
    color: var(--text-muted);
  }
  a:hover,
  a:focus-visible {
    color: var(--text-primary);
  }
}
.legal-page__toc-title {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  margin: 0 0 12px;
}
.legal-page__article {
  max-width: 760px;
  min-width: 0;
}
.legal-page__section {
  scroll-margin-top: 88px;
  margin-bottom: 36px;
}
.legal-page__section-title {
  font-size: 21px;
  font-weight: 500;
  margin-bottom: 12px;
}
.legal-page__paragraph,
.legal-page__list {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  margin-bottom: 12px;
}
.legal-page__paragraph a {
  color: var(--accent-pink);
  overflow-wrap: anywhere;
}
.legal-page__list {
  padding-left: 20px;
  display: grid;
  gap: 6px;
}
.legal-page__table-wrap {
  overflow-x: auto;
  margin-bottom: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.legal-page__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.55;
  th,
  td {
    text-align: left;
    vertical-align: top;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
    min-width: 140px;
  }
  th {
    font-weight: 500;
    color: var(--text-muted);
  }
  tr:last-child td {
    border-bottom: 0;
  }
}
.legal-page__related {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
  font-size: 14px;
  a {
    color: var(--text-muted);
  }
  a:hover,
  a:focus-visible {
    color: var(--text-primary);
  }
}
@media (max-width: 900px) {
  .legal-page__layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .legal-page__toc {
    position: static;
  }
}
</style>
