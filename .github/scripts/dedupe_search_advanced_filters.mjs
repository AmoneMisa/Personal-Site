import { readFile, writeFile } from "node:fs/promises";

async function read(path) { return readFile(path, "utf8"); }
async function write(path, content) { await writeFile(path, content, "utf8"); }
function replaceOnce(content, search, replacement, label) {
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`Missing anchor: ${label}`);
  if (content.indexOf(search, index + search.length) >= 0) throw new Error(`Anchor is not unique: ${label}`);
  return content.slice(0, index) + replacement + content.slice(index + search.length);
}
function removePattern(content, pattern, label) {
  const next = content.replace(pattern, "");
  if (next === content) throw new Error(`Missing pattern: ${label}`);
  return next;
}

const sharedComponent = `<script setup lang="ts">
const open = defineModel<boolean>({ default: false });

withDefaults(defineProps<{
  label: string;
  hideLabel?: string;
}>(), {
  hideLabel: "",
});
</script>

<template>
  <div class="search-advanced-filters">
    <div class="search-advanced-filters__toggle">
      <button
        type="button"
        class="search-advanced-filters__button"
        :aria-expanded="open"
        @click="open = !open"
      >
        <u-icon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" />
        {{ open && hideLabel ? hideLabel : label }}
      </button>
    </div>

    <div v-if="open" class="search-advanced-filters__panel">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.search-advanced-filters {
  grid-column: 1 / -1;
  display: grid;
  min-width: 0;
  gap: 8px;
}
.search-advanced-filters__toggle {
  display: flex;
  align-items: center;
  min-width: 0;
}
.search-advanced-filters__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.search-advanced-filters__button:hover { color: var(--text-white); }
.search-advanced-filters__panel {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--ocean-form-surface);
  box-shadow: 0 18px 42px rgba(2, 5, 18, 0.22);
}
.search-advanced-filters__panel::before,
.search-advanced-filters__panel::after {
  content: "";
  position: absolute;
  z-index: 0;
  border: 1px solid rgba(75, 145, 255, 0.1);
  border-radius: 999px;
  pointer-events: none;
}
.search-advanced-filters__panel::before {
  width: 8px;
  height: 8px;
  left: calc(50% - 4px);
  top: 49%;
  box-shadow: 0 -142px 0 -2px rgba(67, 119, 221, 0.07);
}
.search-advanced-filters__panel::after {
  width: 6px;
  height: 6px;
  right: 1.4%;
  top: 24%;
  border-color: rgba(207, 92, 220, 0.1);
  box-shadow: 0 250px 0 -1px rgba(118, 83, 226, 0.06);
}
.search-advanced-filters__panel > :deep(*) {
  position: relative;
  z-index: 1;
}
@media (min-width: 700px) {
  .search-advanced-filters__panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
`;
await write("app/components/search/SearchAdvancedFilters.vue", sharedComponent);

// Restore the intentional product contract: all boards start collapsed.
{
  const path = "app/composables/hiring/useHiringFilters.ts";
  let text = await read(path);
  text = replaceOnce(text, "  const showAdvanced = ref(true);", "  const showAdvanced = ref(false);", "hiring collapsed default");
  await write(path, text);
}

// Jobs: replace its private toggle + surface with the shared shell.
{
  const path = "app/pages/jobs/index.vue";
  let text = await read(path);
  text = replaceOnce(
    text,
    'import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";\n',
    'import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";\nimport SearchAdvancedFilters from "~/components/search/SearchAdvancedFilters.vue";\n',
    "jobs shared advanced import",
  );
  text = replaceOnce(text, `      <div class="jobs__row jobs__adv-toggle">
        <button type="button" class="jobs__advbtn" @click="showAdvanced = !showAdvanced">
          <u-icon :name="showAdvanced ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" />
          {{ t("advanced") }}
        </button>
      </div>
      <div v-if="showAdvanced" class="jobs__advanced">
        <SearchFilterBlocks :blocks="jobFilterBlocks" class="jobs__filter-blocks" />
        <UiFilterFooter class="jobs-filter-actions" :reset-label="t('reset')" @reset="resetFilters" />
      </div>`, `      <SearchAdvancedFilters v-model="showAdvanced" :label="t('advanced')">
        <SearchFilterBlocks :blocks="jobFilterBlocks" class="jobs__filter-blocks" />
        <UiFilterFooter class="jobs-filter-actions" :reset-label="t('reset')" @reset="resetFilters" />
      </SearchAdvancedFilters>`, "jobs advanced markup");
  text = removePattern(text, /\.jobs__adv-toggle \{[^\n]*\}\n/, "jobs toggle spacing css");
  text = removePattern(text, /\.jobs__advbtn \{[\s\S]*?\n\}\n\.jobs__advbtn:hover \{[^\n]*\}\n/, "jobs toggle button css");
  text = removePattern(text, /\.jobs__advanced \{[\s\S]*?\n\}\n/, "jobs advanced surface css");
  text = text.replace(/\n\s*\.jobs__advanced \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/g, "");
  await write(path, text);
}

// Hiring: same shell. This fixes the missing-button regression without changing
// the collapsed-by-default product behavior.
{
  const path = "app/pages/hiring/index.vue";
  let text = await read(path);
  text = replaceOnce(
    text,
    'import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";\n',
    'import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";\nimport SearchAdvancedFilters from "~/components/search/SearchAdvancedFilters.vue";\n',
    "hiring shared advanced import",
  );
  text = replaceOnce(text, `      <div v-if="showAdvanced" class="hiring__advanced">
        <UiSearchPresets
          :presets="presets"
          :label="t('presets')"
          :delete-label="t('deletePreset')"
          :save-label="t('savePreset')"
          :share-label="t('shareSearch')"
          @apply="applyPreset"
          @remove="removePreset"
          @save="presetModalOpen = true"
          @share="sharedLinkOpened = false; shareModalOpen = true"
        />

        <SearchFilterBlocks :blocks="hiringFilterBlocks" class="hiring__filter-blocks">
          <template #field-professions>
            <div class="hiring__profession-field">
              <u-select-menu :label="t('desiredPositions')" v-model="professions" :items="professionItems" value-key="value" label-key="label" multiple searchable :placeholder="t('anyPositions')" class="hiring__select" @update:model-value="scheduleLoad()" />
              <button v-if="professions.length" type="button" class="hiring__profession-clear" @click="clearProfessions"><u-icon name="i-lucide-x" /> {{ t("clearPositions") }} · {{ professions.length }}</button>
            </div>
          </template>
        </SearchFilterBlocks>

        <UiFilterFooter
          class="hiring-filter-actions"
          :summary="t('found', { n: view === 'active' ? total : displayedProfiles.length })"
          :reset-label="t('reset')"
          @reset="resetFilters"
        />
      </div>`, `      <SearchAdvancedFilters v-model="showAdvanced" :label="t('advanced')">
        <UiSearchPresets
          :presets="presets"
          :label="t('presets')"
          :delete-label="t('deletePreset')"
          :save-label="t('savePreset')"
          :share-label="t('shareSearch')"
          @apply="applyPreset"
          @remove="removePreset"
          @save="presetModalOpen = true"
          @share="sharedLinkOpened = false; shareModalOpen = true"
        />

        <SearchFilterBlocks :blocks="hiringFilterBlocks" class="hiring__filter-blocks">
          <template #field-professions>
            <div class="hiring__profession-field">
              <u-select-menu :label="t('desiredPositions')" v-model="professions" :items="professionItems" value-key="value" label-key="label" multiple searchable :placeholder="t('anyPositions')" class="hiring__select" @update:model-value="scheduleLoad()" />
              <button v-if="professions.length" type="button" class="hiring__profession-clear" @click="clearProfessions"><u-icon name="i-lucide-x" /> {{ t("clearPositions") }} · {{ professions.length }}</button>
            </div>
          </template>
        </SearchFilterBlocks>

        <UiFilterFooter
          class="hiring-filter-actions"
          :summary="t('found', { n: view === 'active' ? total : displayedProfiles.length })"
          :reset-label="t('reset')"
          @reset="resetFilters"
        />
      </SearchAdvancedFilters>`, "hiring advanced markup");
  text = removePattern(text, /\.hiring__advanced \{[\s\S]*?\.hiring__advanced > \* \{[^\n]*\}\n/, "hiring advanced surface css");
  text = text.replace(/\n\s*\.hiring__advanced \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/g, "");
  await write(path, text);
}

// Flat Finder: keep its richer primary filter card, but use the exact same
// collapsed/expanded shell for the secondary filter block.
{
  const path = "app/pages/flat-finder/index.vue";
  let text = await read(path);
  text = replaceOnce(
    text,
    'import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";\n',
    'import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";\nimport SearchAdvancedFilters from "~/components/search/SearchAdvancedFilters.vue";\n',
    "flats shared advanced import",
  );
  text = replaceOnce(text, `function toggleAdvanced() {
  showAdvanced.value = !showAdvanced.value;
  try { localStorage.setItem("flats:showAdvanced", showAdvanced.value ? "1" : "0"); } catch { /* noop */ }
}
`, `watch(showAdvanced, (value) => {
  if (!import.meta.client) return;
  try { localStorage.setItem("flats:showAdvanced", value ? "1" : "0"); } catch { /* noop */ }
});
`, "flats advanced persistence");
  text = replaceOnce(text, `          <u-button type="button" variant="outline" color="neutral" icon="i-lucide-sliders-horizontal" :trailing-icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" :aria-expanded="showAdvanced" class="advanced-button" @click="toggleAdvanced">{{ showAdvanced ? t("hideFilters") : t("moreFilters") }}</u-button>
`, "", "flats duplicate footer toggle");
  text = replaceOnce(text, `      <section v-if="showAdvanced" class="advanced-card">
        <div class="advanced-card__header"><div><u-icon name="i-lucide-filter" /><strong>{{ t("moreFilters") }}</strong></div><button type="button" @click="toggleAdvanced">{{ t("hideFilters") }} <u-icon name="i-lucide-chevron-up" /></button></div>
        <SearchFilterBlocks :blocks="flatAdvancedFilterBlocks" class="flats__filter-blocks">`, `      <SearchAdvancedFilters v-model="showAdvanced" :label="t('moreFilters')" :hide-label="t('hideFilters')">
        <SearchFilterBlocks :blocks="flatAdvancedFilterBlocks" class="flats__filter-blocks">`, "flats advanced opening");
  text = replaceOnce(text, `        </SearchFilterBlocks>
      </section>
      </div>`, `        </SearchFilterBlocks>
      </SearchAdvancedFilters>
      </div>`, "flats advanced closing");
  // Remove page-private advanced-card presentation; the shared shell owns it now.
  text = text.replace(/\.advanced-card(?:__header)?(?:\s*>\s*[^,{]+)?[^,{]*\{[^}]*\}\n?/g, "");
  text = text.replace(/\.advanced-button[^,{]*\{[^}]*\}\n?/g, "");
  await write(path, text);
}

// Update the regression contract: default state lives in composables, while the
// toggle/surface implementation is shared by all three boards.
{
  const path = "tests/flats-layout-and-stats.test.mjs";
  let text = await read(path);
  text = replaceOnce(text, `const jobStats = await readFile(new URL('../app/components/jobs/StatsPanel.vue', import.meta.url), 'utf8')
`, `const jobStats = await readFile(new URL('../app/components/jobs/StatsPanel.vue', import.meta.url), 'utf8')
const jobPage = await readFile(new URL('../app/pages/jobs/index.vue', import.meta.url), 'utf8')
const hiringPage = await readFile(new URL('../app/pages/hiring/index.vue', import.meta.url), 'utf8')
const advancedFilters = await readFile(new URL('../app/components/search/SearchAdvancedFilters.vue', import.meta.url), 'utf8')
`, "layout test shared reads");
  text = replaceOnce(text, `test('advanced filters are collapsed by default on all three search boards', () => {
  assert.match(flatFilters, /const showAdvanced = ref\\(false\\)/u)
  assert.match(jobFilters, /const showAdvanced = ref\\(false\\)/u)
  assert.match(hiringFilters, /const showAdvanced = ref\\(false\\)/u)
})`, `test('advanced filters share one collapsed shell on all three search boards', () => {
  assert.match(flatFilters, /const showAdvanced = ref\\(false\\)/u)
  assert.match(jobFilters, /const showAdvanced = ref\\(false\\)/u)
  assert.match(hiringFilters, /const showAdvanced = ref\\(false\\)/u)
  assert.match(page, /<SearchAdvancedFilters v-model="showAdvanced"/u)
  assert.match(jobPage, /<SearchAdvancedFilters v-model="showAdvanced"/u)
  assert.match(hiringPage, /<SearchAdvancedFilters v-model="showAdvanced"/u)
  assert.match(advancedFilters, /const open = defineModel<boolean>\\(\\{ default: false \\}\\)/u)
  assert.match(advancedFilters, /:aria-expanded="open"/u)
  assert.doesNotMatch(jobPage, /showAdvanced = !showAdvanced/u)
  assert.doesNotMatch(hiringPage, /v-if="showAdvanced" class="hiring__advanced"/u)
})`, "advanced shell regression test");
  await write(path, text);
}

// The salary test should protect the server-statistics path and the current
// categorical visualization, not a stale implementation detail from the line chart.
{
  const path = "tests/hiring-statistics.test.mjs";
  let text = await read(path);
  text = replaceOnce(text, `  assert.match(panel, /v-if="salarySamples"/u)
  assert.match(panel, /statsNoSalaryData/u)`, `  assert.match(panel, /experienceSalaryBars/u)
  assert.match(panel, /<UiAnalyticsBars v-if="experienceSalaryBars.length" :items="experienceSalaryBars"/u)
  assert.match(panel, /statsNoSalaryData/u)`, "hiring salary chart regression");
  await write(path, text);
}

console.log("Search advanced-filter shell deduplicated across flats/jobs/hiring.");
