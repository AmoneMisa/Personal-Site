<script setup lang="ts">
import {nextTick, onBeforeUnmount, onMounted, ref} from "vue";
import type {TabsItem} from "#ui/components/Tabs.vue";
import PageHeader from "~/components/common/PageHeader.vue";

type SimpleSort = "len_asc" | "len_desc";

const simpleSort = ref<SimpleSort>("len_asc");
const simpleSortOptions = computed(() => ([
  {label: t("services.dockerSearch.simple.sort.lenAsc"), value: "len_asc"},
  {label: t("services.dockerSearch.simple.sort.lenDesc"), value: "len_desc"}
]));

const simpleResultsSorted = computed(() => {
  const list = [...(simpleResults.value || [])];

  list.sort((a, b) => {
    const la = (a.tag || "").length;
    const lb = (b.tag || "").length;

    if (la !== lb) return simpleSort.value === "len_asc" ? la - lb : lb - la;
    return (a.tag || "").localeCompare(b.tag || "");
  });

  return list;
});

const {t} = useI18n();

useSeoMeta({
  title: () => t('seo.pages.dockerSearch.title'),
  description: () => t('seo.pages.dockerSearch.description'),
  robots: () => t('seo.common.robots'),
  ogType: () => t('seo.common.ogType'),
  ogSiteName: () => t('seo.common.siteName'),
  ogTitle: () => t('seo.pages.dockerSearch.ogTitle'),
  ogDescription: () => t('seo.pages.dockerSearch.ogDescription'),
  twitterCard: () => t('seo.common.twitterCard'),
  twitterTitle: () => t('seo.pages.dockerSearch.twitterTitle'),
  twitterDescription: () => t('seo.pages.dockerSearch.twitterDescription')
});

type ResolveResponse = {
  repo: string;
  major: number;
  variant?: string | null;
  best_tag: string | null;
  fallbacks: string[];
  reason: string;
  total_matched: number;
};

type AliasesResponse = {
  repo: string;
  tag: string;
  digest: string | null;
  aliases: string[];
  reason: string;
};

type SimpleSearchItem = {
  base: string;
  tag: string;
  examples: string[];
};

type VariantPreset = { labelKey: string; value: string | null };

// -----------------------------
// Tabs (your styling logic)
// -----------------------------
const tabsScroll = useTemplateRef<HTMLElement>("tabsScroll");
const tabLine = useTemplateRef<HTMLElement>("tabLineElement");
const currentIndex = ref(0);

function moveTabLine(index: number) {
  const wrap = tabsScroll.value;
  const line = tabLine.value;
  if (!wrap || !line) return;

  const triggers = wrap.querySelectorAll<HTMLElement>(".tabs__trigger");
  const active = triggers[index];
  if (!active) return;

  const center = active.offsetLeft + active.offsetWidth / 2;
  const w = 12;
  line.style.width = `${w}px`;
  line.style.transform = `translateX(${Math.round(center - w / 2)}px)`;
}

function ensureTabVisible(index: number) {
  const wrap = tabsScroll.value;
  if (!wrap) return;

  const triggers = wrap.querySelectorAll<HTMLElement>(".tabs__trigger");
  const active = triggers[index];
  if (!active) return;

  const left = active.offsetLeft;
  const right = left + active.offsetWidth;
  const viewLeft = wrap.scrollLeft;
  const viewRight = wrap.scrollLeft + wrap.clientWidth;

  if (left < viewLeft) wrap.scrollTo({left: left - 16, behavior: "smooth"});
  else if (right > viewRight) wrap.scrollTo({left: right - wrap.clientWidth + 16, behavior: "smooth"});
}

async function onTabChange(index: number) {
  currentIndex.value = index;
  await nextTick();
  moveTabLine(index);
  ensureTabVisible(index);
}

function handleResize() {
  nextTick(() => moveTabLine(currentIndex.value));
}

onMounted(async () => {
  await nextTick();
  moveTabLine(0);
  window.addEventListener("resize", handleResize, {passive: true});
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
});

const tabs: TabsItem[] = [
  {label: "services.dockerSearch.tabs.simple"},
  {label: "services.dockerSearch.tabs.advanced"},
];

// -----------------------------
// Shared state (repo + aliases)
// -----------------------------
const repo = ref("library/amazoncorretto");

// Aliases (shared)
const loadingAliases = ref(false);
const aliasesError = ref<string | null>(null);
const aliasesResult = ref<AliasesResponse | null>(null);
const selectedTag = ref<string | null>(null);

function resetAliases() {
  aliasesResult.value = null;
  aliasesError.value = null;
}

async function loadAliases(tag: string) {
  loadingAliases.value = true;
  aliasesError.value = null;

  try {
    aliasesResult.value = await $fetch<AliasesResponse>("/api/dockerhub/tags/aliases", {
      params: {repo: repo.value.trim(), tag},
    });
  } catch (e: any) {
    aliasesError.value = e?.data?.message || e?.message || "Fetch failed";
  } finally {
    loadingAliases.value = false;
  }
}

// -----------------------------
// Tab 1: Simple search
// -----------------------------
const simpleQuery = ref("");
const simpleLoading = ref(false);
const simpleError = ref<string | null>(null);
const simpleResults = ref<SimpleSearchItem[]>([]);

const canSimpleSearch = computed(() => repo.value.trim().length > 3 && simpleQuery.value.trim().length > 1);

async function runSimpleSearch() {
  if (!canSimpleSearch.value) return;

  simpleLoading.value = true;
  simpleError.value = null;
  resetAliases();

  try {
    const data = await $fetch<SimpleSearchItem[]>("/api/dockerhub/tags/search", {
      params: {repo: repo.value.trim(), q: simpleQuery.value.trim()},
    });

    simpleResults.value = Array.isArray(data) ? data : [];
    selectedTag.value = simpleResults.value[0]?.tag ?? null;
  } catch (e: any) {
    simpleError.value = e?.data?.message || e?.message || "Fetch failed";
    simpleResults.value = [];
    selectedTag.value = null;
  } finally {
    simpleLoading.value = false;
  }
}

function chooseSimpleTag(tag: string) {
  selectedTag.value = tag;
  resetAliases();
}

// -----------------------------
// Tab 2: Advanced search (your current)
// -----------------------------
const major = ref<number | null>(17);
const variant = ref<string | null>("alpine");

const variantPresets: VariantPreset[] = [
  {labelKey: "services.dockerSearch.variant.any", value: null},
  {labelKey: "services.dockerSearch.variant.alpine", value: "alpine"},
  {labelKey: "services.dockerSearch.variant.al2", value: "al2"},
  {labelKey: "services.dockerSearch.variant.debian", value: "debian"},
  {labelKey: "services.dockerSearch.variant.ubuntu", value: "ubuntu"},
];

const loading = ref(false);
const error = ref<string | null>(null);
const resolveResult = ref<ResolveResponse | null>(null);

const canAdvancedSearch = computed(() => {
  const r = repo.value.trim();
  return r.length > 3 && !!major.value && major.value > 0;
});

function resetAdvanced() {
  resolveResult.value = null;
  error.value = null;
  selectedTag.value = null;
  resetAliases();
}

async function runAdvancedSearch() {
  if (!canAdvancedSearch.value) return;

  loading.value = true;
  error.value = null;
  resetAliases();

  try {
    const data = await $fetch<ResolveResponse>("/api/dockerhub/tags/resolve", {
      params: {
        repo: repo.value.trim(),
        major: major.value,
        ...(variant.value ? {variant: variant.value} : {}),
      },
    });

    resolveResult.value = data;
    selectedTag.value = data.best_tag ?? null;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Fetch failed";
  } finally {
    loading.value = false;
  }
}

const tagsToShow = computed(() => resolveResult.value?.fallbacks ?? []);

function chooseAdvancedTag(tag: string) {
  selectedTag.value = tag;
  resetAliases();
}
</script>

<template>
  <u-container class="docker-search">
    <div class="docker-search__header background-hero text-center space-y-3">
      <page-header
          title="services.dockerSearch.title"
          headline="services.dockerSearch.headline"
          description="services.dockerSearch.subtitle"
          class="mb-6"
          :is-centered="true"
      />
    </div>
    <div class="tabs-row">
      <div ref="tabsScroll" class="tabs-scroll">
        <div class="tabs-head">
          <u-tabs
              :items="tabs"
              @update:modelValue="onTabChange"
              :ui="{ trigger: 'tabs__trigger', list: 'tabs__list mt-4', indicator: 'hidden' }"
          >
            <template #default="{ item }">
              {{ t(item.label) }}
            </template>

            <template #content="{ item, index }">
              <section v-if="index === 0">
                <div class="docker-search__controls docker-search__controls_simple">
                  <div class="docker-search__field">
                    <div class="docker-search__label">{{ t("services.dockerSearch.fields.repo") }}</div>
                    <u-input
                        icon="i-lucide-box"
                        v-model="repo"
                        :placeholder="t('services.dockerSearch.placeholders.repo')"
                        @keydown.enter="runSimpleSearch"
                    />
                    <div class="docker-search__hint text-muted">
                      {{ t("services.dockerSearch.hints.repo") }}
                    </div>
                  </div>

                  <div class="docker-search__field">
                    <div class="docker-search__label">{{ t("services.dockerSearch.simple.queryLabel") }}</div>
                    <u-input
                        icon="i-lucide-search"
                        v-model="simpleQuery"
                        :placeholder="t('services.dockerSearch.simple.queryPlaceholder')"
                        @keydown.enter="runSimpleSearch"
                    />
                    <div class="docker-search__hint text-muted">
                      {{ t("services.dockerSearch.simple.queryHint") }}
                    </div>
                  </div>

                  <div class="docker-search__field docker-search__field_small docker-search__field_sort ui-pill-btn ui-pill-btn_animated">
                    <div class="ui-pill-btn__inner">
                      <div class="docker-search__label">
                        {{ t("services.dockerSearch.simple.sort.label") }}
                      </div>

                      <u-select
                          v-model="simpleSort"
                          :items="simpleSortOptions"
                          :ui="{ base: 'min-w-0 p-0 bg-transparent rounded-none ring-0 border-0' }"
                          class="ui-locale"
                      />
                    </div>
                  </div>

                  <div class="docker-search__actions">
                    <button
                        type="button"
                        class="docker-search__btn"
                        :disabled="!canSimpleSearch || simpleLoading"
                        @click="runSimpleSearch"
                    >
                      <u-icon v-if="simpleLoading" name="i-lucide-loader-circle"
                              class="docker-search__btn-icon docker-search__spin"/>
                      <u-icon v-else name="i-lucide-search" class="docker-search__btn-icon"/>
                      {{ t("services.dockerSearch.actions.search") }}
                    </button>

                    <button
                        type="button"
                        class="docker-search__btn docker-search__btn_ghost"
                        :disabled="simpleLoading"
                        @click="() => { simpleQuery=''; simpleResults=[]; simpleError=null; selectedTag=null; resetAliases(); }"
                    >
                      <u-icon name="i-lucide-eraser" class="docker-search__btn-icon"/>
                      {{ t("services.dockerSearch.actions.reset") }}
                    </button>
                  </div>
                </div>

                <div v-if="simpleError" class="docker-search__empty">
                  <div class="docker-search__empty-title">{{ t("services.dockerSearch.errors.title") }}</div>
                  <div class="text-muted">{{ simpleError }}</div>
                </div>

                <div v-if="simpleResults.length" class="docker-search__result">
                  <div class="docker-search__result-head">
                    <div class="docker-search__result-title">{{ t("services.dockerSearch.simple.resultsTitle") }}</div>
                    <div class="docker-search__result-meta text-muted">
                      {{ t("services.dockerSearch.simple.resultsCount") }}: {{ simpleResults.length }}
                    </div>
                  </div>

                  <div class="docker-search__grid">
                    <div class="docker-search__panel">
                      <div class="docker-search__panel-title">
                        {{ t("services.dockerSearch.simple.mainTags") }}
                      </div>

                      <div class="docker-search__tags">
                        <button
                            v-for="item2 in simpleResultsSorted"
                            :key="item2.base"
                            type="button"
                            class="docker-search__tag"
                            :class="{ 'docker-search__tag_active': selectedTag === item2.tag }"
                            @click="chooseSimpleTag(item2.tag)"
                        >
                          <span class="docker-search__tag-text">{{ item2.tag }}</span>
                          <span v-if="selectedTag === item2.tag" class="docker-search__tag-badge">
                            {{ t("services.dockerSearch.result.selected") }}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div class="docker-search__panel">
                      <div class="docker-search__panel-title">
                        {{ t("services.dockerSearch.result.aliasesTitle") }}
                      </div>

                      <div class="docker-search__best-actions" style="margin-bottom: 10px;">
                        <button
                            type="button"
                            class="docker-search__btn"
                            :disabled="!selectedTag || loadingAliases"
                            @click="selectedTag && loadAliases(selectedTag)"
                        >
                          <u-icon v-if="loadingAliases" name="i-lucide-loader-circle"
                                  class="docker-search__btn-icon docker-search__spin"/>
                          <u-icon v-else name="i-lucide-link-2" class="docker-search__btn-icon"/>
                          {{ t("services.dockerSearch.actions.aliases") }}
                        </button>
                      </div>

                      <div v-if="aliasesError" class="docker-search__hint text-muted">{{ aliasesError }}</div>

                      <div v-else-if="aliasesResult" class="docker-search__aliases">
                        <div class="docker-search__aliases-meta text-muted">
                          <div>
                            {{ t("services.dockerSearch.result.digest") }}:
                            <span class="docker-search__mono">{{ aliasesResult.digest || "—" }}</span>
                          </div>
                          <div>
                            {{ t("services.dockerSearch.result.aliasCount") }}: {{ aliasesResult.aliases.length }}
                          </div>
                        </div>

                        <div v-if="aliasesResult.aliases.length" class="docker-search__aliases-list">
                          <div v-for="a in aliasesResult.aliases" :key="a" class="docker-search__alias">
                            <span class="docker-search__mono">{{ a }}</span>
                          </div>
                        </div>

                        <div v-else class="docker-search__hint text-muted">
                          {{ t("services.dockerSearch.result.noAliases") }}
                        </div>
                      </div>

                      <div v-else class="docker-search__hint text-muted">
                        {{ t("services.dockerSearch.result.aliasesHint") }}
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else-if="!simpleLoading && !simpleError" class="docker-search__hint text-muted"
                     style="text-align:center; margin-top: 10px;">
                  {{ t("services.dockerSearch.simple.emptyHint") }}
                </div>
              </section>

              <section v-else>
                <div class="docker-search__controls docker-search__controls_advanced">
                  <div class="docker-search__field">
                    <div class="docker-search__label">{{ t("services.dockerSearch.fields.repo") }}</div>
                    <u-input
                        icon="i-lucide-box"
                        v-model="repo"
                        :placeholder="t('services.dockerSearch.placeholders.repo')"
                        @keydown.enter="runAdvancedSearch"
                    />
                    <div class="docker-search__hint text-muted">
                      {{ t("services.dockerSearch.hints.repo") }}
                    </div>
                  </div>

                  <div class="docker-search__field docker-search__field_small">
                    <div class="docker-search__label">{{ t("services.dockerSearch.fields.major") }}</div>
                    <u-input
                        icon="i-lucide-hash"
                        type="number"
                        v-model="major"
                        :placeholder="t('services.dockerSearch.placeholders.major')"
                        @keydown.enter="runAdvancedSearch"
                    />
                  </div>

                  <div class="docker-search__field docker-search__field_small ui-pill-btn ui-pill-btn_animated">
                    <div class="ui-pill-btn__inner">
                      <div class="docker-search__label">{{ t("services.dockerSearch.fields.variant") }}</div>
                      <u-select
                          v-model="variant"
                          :items="variantPresets.map(v => ({ label: t(v.labelKey), value: v.value }))"
                          :ui="{ base: 'min-w-0 p-0 bg-transparent rounded-none ring-0 border-0' }"
                          class="ui-locale"
                      />
                    </div>
                  </div>

                  <div class="docker-search__actions">
                    <button
                        type="button"
                        class="docker-search__btn"
                        :disabled="!canAdvancedSearch || loading"
                        @click="runAdvancedSearch"
                    >
                      <u-icon v-if="loading" name="i-lucide-loader-circle"
                              class="docker-search__btn-icon docker-search__spin"/>
                      <u-icon v-else name="i-lucide-search" class="docker-search__btn-icon"/>
                      {{ t("services.dockerSearch.actions.search") }}
                    </button>

                    <button
                        type="button"
                        class="docker-search__btn docker-search__btn_ghost"
                        :disabled="loading"
                        @click="resetAdvanced"
                    >
                      <u-icon name="i-lucide-eraser" class="docker-search__btn-icon"/>
                      {{ t("services.dockerSearch.actions.reset") }}
                    </button>
                  </div>
                </div>

                <div v-if="error" class="docker-search__empty">
                  <div class="docker-search__empty-title">{{ t("services.dockerSearch.errors.title") }}</div>
                  <div class="text-muted">{{ error }}</div>
                </div>

                <div v-if="resolveResult" class="docker-search__result">
                  <div class="docker-search__result-head">
                    <div class="docker-search__result-title">{{ t("services.dockerSearch.result.title") }}</div>
                    <div class="docker-search__result-meta text-muted">
                      {{ t("services.dockerSearch.result.matched") }}: {{ resolveResult.total_matched }}
                      <span class="docker-search__dot">•</span>
                      {{ t("services.dockerSearch.result.reason") }}: {{ resolveResult.reason }}
                    </div>
                  </div>

                  <div class="docker-search__best">
                    <div class="docker-search__best-left">
                      <div class="docker-search__chip">{{ t("services.dockerSearch.result.bestTag") }}</div>
                      <div class="docker-search__best-tag">
                        <span v-if="resolveResult.best_tag">{{ resolveResult.best_tag }}</span>
                        <span v-else class="text-muted">{{ t("services.dockerSearch.result.noBest") }}</span>
                      </div>
                      <div class="docker-search__best-repo text-muted">{{ resolveResult.repo }}</div>
                    </div>

                    <div class="docker-search__best-actions">
                      <button
                          type="button"
                          class="docker-search__btn"
                          :disabled="!selectedTag || loadingAliases"
                          @click="selectedTag && loadAliases(selectedTag)"
                      >
                        <u-icon v-if="loadingAliases" name="i-lucide-loader-circle"
                                class="docker-search__btn-icon docker-search__spin"/>
                        <u-icon v-else name="i-lucide-link-2" class="docker-search__btn-icon"/>
                        {{ t("services.dockerSearch.actions.aliases") }}
                      </button>
                    </div>
                  </div>

                  <div class="docker-search__grid">
                    <div class="docker-search__panel">
                      <div class="docker-search__panel-title">
                        {{ t("services.dockerSearch.result.fallbacks") }}
                      </div>

                      <div v-if="tagsToShow.length" class="docker-search__tags">
                        <button
                            v-for="tag2 in tagsToShow"
                            :key="tag2"
                            type="button"
                            class="docker-search__tag"
                            :class="{ 'docker-search__tag_active': selectedTag === tag2 }"
                            @click="chooseAdvancedTag(tag2)"
                        >
                          <span class="docker-search__tag-text">{{ tag2 }}</span>
                          <span v-if="selectedTag === tag2" class="docker-search__tag-badge">
                            {{ t("services.dockerSearch.result.selected") }}
                          </span>
                        </button>
                      </div>

                      <div v-else class="docker-search__hint text-muted">
                        {{ t("services.dockerSearch.result.noFallbacks") }}
                      </div>
                    </div>

                    <div class="docker-search__panel">
                      <div class="docker-search__panel-title">
                        {{ t("services.dockerSearch.result.aliasesTitle") }}
                      </div>

                      <div v-if="aliasesError" class="docker-search__hint text-muted">{{ aliasesError }}</div>

                      <div v-else-if="aliasesResult" class="docker-search__aliases">
                        <div class="docker-search__aliases-meta text-muted">
                          <div>
                            {{ t("services.dockerSearch.result.digest") }}:
                            <span class="docker-search__mono">{{ aliasesResult.digest || "—" }}</span>
                          </div>
                          <div>
                            {{ t("services.dockerSearch.result.aliasCount") }}: {{ aliasesResult.aliases.length }}
                          </div>
                        </div>

                        <div v-if="aliasesResult.aliases.length" class="docker-search__aliases-list">
                          <div v-for="a in aliasesResult.aliases" :key="a" class="docker-search__alias">
                            <span class="docker-search__mono">{{ a }}</span>
                          </div>
                        </div>

                        <div v-else class="docker-search__hint text-muted">
                          {{ t("services.dockerSearch.result.noAliases") }}
                        </div>
                      </div>

                      <div v-else class="docker-search__hint text-muted">
                        {{ t("services.dockerSearch.result.aliasesHint") }}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </template>
          </u-tabs>
        </div>
      </div>
    </div>

    <section class="docker-search__how">
      <h2 class="docker-search__h2">{{ t("services.dockerSearch.howTitle") }}</h2>

      <div class="docker-search__how-grid">
        <div class="how-card">
          <u-icon name="i-lucide-search" class="how-card__icon"/>
          <div class="how-card__title">{{ t("services.dockerSearch.how.step1.title") }}</div>
          <div class="how-card__text text-muted">{{ t("services.dockerSearch.how.step1.text") }}</div>
        </div>

        <div class="how-card">
          <u-icon name="i-lucide-tags" class="how-card__icon"/>
          <div class="how-card__title">{{ t("services.dockerSearch.how.step2.title") }}</div>
          <div class="how-card__text text-muted">{{ t("services.dockerSearch.how.step2.text") }}</div>
        </div>

        <div class="how-card">
          <u-icon name="i-lucide-link-2" class="how-card__icon"/>
          <div class="how-card__title">{{ t("services.dockerSearch.how.step3.title") }}</div>
          <div class="how-card__text text-muted">{{ t("services.dockerSearch.how.step3.text") }}</div>
        </div>
      </div>
    </section>
  </u-container>
</template>

<style scoped>
.docker-search {
  padding-top: 24px;
  padding-bottom: 96px;
}

.docker-search__subtitle {
  max-width: 720px;
  font-size: 14px;
}

.docker-search__controls {
  margin: 28px 0 22px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.docker-search__controls_simple {
  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "repo  query"
      "actions actions";
    align-items: end;
  }

  @media (min-width: 900px) {
    .docker-search__field:nth-child(1) {
      grid-area: repo;
    }

    .docker-search__field:nth-child(2) {
      grid-area: query;
    }

    .docker-search__actions {
      grid-area: actions;
    }
  }
}

.docker-search__controls_advanced {
  @media (min-width: 900px) {
    grid-template-columns: 180px 1fr;
    grid-template-rows: auto auto;

    grid-template-areas:
      "repo   repo   repo"
      "major  variant actions";

    align-items: end;
  }

  @media (min-width: 900px) {
    .docker-search__field:nth-child(1) {
      grid-area: repo;
    }

    .docker-search__field:nth-child(2) {
      grid-area: major;
    }

    .docker-search__field:nth-child(3) {
      grid-area: variant;
    }

    .docker-search__actions {
      grid-area: actions;
    }
  }
}

.docker-search__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.docker-search__field_small {
  @media (min-width: 900px) {
    max-width: 240px;
  }
}

.docker-search__field_sort {
  @media (min-width: 900px) {
    max-width: none;
  }
}

.docker-search__label {
  font-weight: 900;
  font-size: 13px;
}

.ui-pill-btn__inner .docker-search__label {
  flex: 0 0 auto;
  white-space: nowrap;
}

.ui-pill-btn__inner :deep(.ui-locale) {
  flex: 1 1 auto;
  min-width: 0;
}

.docker-search__hint {
  font-size: 12px;
  line-height: 1.35;
}

.docker-search__actions {
  display: flex;
  gap: 10px;
  justify-content: center;

  @media (min-width: 900px) {
    justify-content: flex-end;
  }
}

.docker-search__btn {
  height: 40px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-white);
  font-weight: 900;
  font-size: 13px;
  cursor: pointer;
  transition: filter 180ms ease, transform 140ms ease, opacity 180ms ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.docker-search__btn:hover {
  filter: brightness(1.06);
}

.docker-search__btn:active {
  transform: translateY(1px);
}

.docker-search__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.docker-search__btn_ghost {
  background: transparent;
}

.docker-search__btn-icon {
  font-size: 16px;
}

.docker-search__spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Result */
.docker-search__result {
  margin-top: 14px;
}

.docker-search__result-head {
  margin-bottom: 10px;
  text-align: center;

  @media (min-width: 900px) {
    text-align: left;
  }
}

.docker-search__result-title {
  font-weight: 900;
  font-size: 18px;
  margin-bottom: 4px;
}

.docker-search__result-meta {
  font-size: 12px;
}

.docker-search__dot {
  margin: 0 8px;
  opacity: 0.55;
}

.docker-search__best {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.docker-search__chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(128, 90, 245, 0.35);
  background: rgba(128, 90, 245, 0.12);
  font-weight: 900;
  font-size: 12px;
}

.docker-search__best-tag {
  font-weight: 900;
  font-size: 18px;
  margin-top: 6px;
}

.docker-search__best-repo {
  margin-top: 4px;
  font-size: 12px;
}

/* Panels */
.docker-search__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
}

.docker-search__panel {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.docker-search__panel-title {
  font-weight: 900;
  margin-bottom: 10px;
}

.docker-search__tags {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.docker-search__tag {
  width: 100%;
  text-align: left;
  padding: 12px 12px;
  border-radius: 14px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: filter 180ms ease, transform 140ms ease, color 180ms ease;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.docker-search__tag:hover {
  filter: brightness(1.06);
}

.docker-search__tag:active {
  transform: translateY(1px);
}

.docker-search__tag_active {
  border-color: rgba(128, 90, 245, 0.40);
  background: rgba(128, 90, 245, 0.14);
}

.docker-search__tag-text {
  font-weight: 900;
  font-size: 13px;
  word-break: break-word;
}

.docker-search__tag-badge {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.9;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(128, 90, 245, 0.35);
  background: rgba(128, 90, 245, 0.10);
}

/* Aliases */
.docker-search__aliases-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 10px;
}

.docker-search__aliases-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;

  @media (min-width: 600px) {
    grid-template-columns: 1fr 1fr;
  }
}

.docker-search__alias {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
}

.docker-search__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
}

.docker-search__empty {
  margin-top: 18px;
  text-align: center;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
}

.docker-search__empty-title {
  font-weight: 900;
  margin-bottom: 6px;
}

/* How */
.docker-search__how {
  margin-top: 84px;
  text-align: center;
}

.docker-search__h2 {
  font-size: 28px;
  font-weight: 900;
  margin-bottom: 18px;
}

.docker-search__how-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;

  @media (min-width: 800px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.how-card {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.how-card__icon {
  font-size: 22px;
  color: var(--color-primary);
  margin-bottom: 10px;
}

.how-card__title {
  font-weight: 900;
  margin-bottom: 6px;
}
</style>
