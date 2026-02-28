<script setup lang="ts">
type IndicesNormalized = {
  income: number | null;
  education: number | null;
  qualityOfLife: number | null;
  safety: number | null;
  internet?: number | null;
  unemployment?: number | null;
  air?: number | null;
  inequality?: number | null;
  health?: number | null;
};

type IndicesBundle = {
  key: string;
  updatedAtISO: string;
  normalized: IndicesNormalized;
};

type Item = {
  key: string;
  titleKey: string;
  fallbackName: string;
  estimatedMonthlyUSD: number;
  why?: string[];
  match100?: number | null;
  live100?: number | null;
};

const props = withDefaults(defineProps<{
  item: Item;
  indices?: IndicesBundle;
  showWhy?: boolean;
  showRatings?: boolean;
  removable?: boolean;
  removeText?: string;
}>(), {
  showWhy: false,
  showRatings: true,
  removable: false,
});

const emit = defineEmits<{ (e: "remove", key: string): void }>();

const { t } = useI18n();

function fmt100(v: number | null | undefined) {
  if (typeof v !== "number") return "—";
  return `${Math.round(v)}/100`;
}

function hasAnyIndex(b: IndicesBundle | undefined) {
  const n = b?.normalized;
  if (!n) return false;
  return [
    n.income, n.education, n.qualityOfLife, n.safety,
    n.internet, n.unemployment, n.air, n.inequality, n.health
  ].some((x) => typeof x === "number");
}
</script>

<template>
  <div class="p-4 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.03)] result-card">
    <div class="flex items-start justify-between gap-3">
      <div class="font-black">
        {{ t(item.titleKey, item.fallbackName) || item.fallbackName }}
      </div>

      <button
          v-if="removable"
          type="button"
          class="chip"
          @click="emit('remove', item.key)"
      >
        <Icon name="i-lucide-x" class="i-icon" />
        {{ removeText || t("common.remove") || "Remove" }}
      </button>
    </div>

    <div class="text-muted mt-2">
      ~${{ Math.round(item.estimatedMonthlyUSD).toLocaleString("en-US") }} / month
    </div>

    <div v-if="showWhy && item.why?.length" class="text-muted mt-2">
      • {{ item.why.join(" • ") }}
    </div>

    <div v-if="item.match100 != null || item.live100 != null" class="ratings mt-3">
      <div class="rating" v-if="item.match100 != null">
        <div class="rating__label">{{ t("quizzes.countryFit.rating.match") }}</div>
        <div class="rating__val">{{ fmt100(item.match100) }}</div>
      </div>
      <div class="rating" v-if="item.live100 != null">
        <div class="rating__label">{{ t("quizzes.countryFit.rating.live") }}</div>
        <div class="rating__val">{{ fmt100(item.live100) }}</div>
      </div>
    </div>

    <div v-if="hasAnyIndex(indices)" class="indices mt-3">
      <button type="button" class="indices__trigger" :aria-label="t('quizzes.countryFit.indices.aria')">
        <Icon name="i-lucide-info" class="i-icon" />
        {{ t("quizzes.countryFit.indices.title") }}
      </button>

      <div class="indices__panel" role="tooltip">
        <div class="indices__title">{{ t("quizzes.countryFit.indices.title") }}</div>

        <div class="indices__row" v-if="indices?.normalized.income != null">
          <span class="indices__k"><Icon name="i-lucide-dollar-sign" class="i-icon" />{{ t("quizzes.countryFit.indices.income") }}</span>
          <span class="indices__val">{{ indices!.normalized.income!.toFixed(1) }}/10</span>
        </div>

        <div class="indices__row" v-if="indices?.normalized.education != null">
          <span class="indices__k"><Icon name="i-lucide-graduation-cap" class="i-icon" />{{ t("quizzes.countryFit.indices.education") }}</span>
          <span class="indices__val">{{ indices!.normalized.education!.toFixed(1) }}/10</span>
        </div>

        <div class="indices__row" v-if="indices?.normalized.qualityOfLife != null">
          <span class="indices__k"><Icon name="i-lucide-sparkles" class="i-icon" />{{ t("quizzes.countryFit.indices.quality") }}</span>
          <span class="indices__val">{{ indices!.normalized.qualityOfLife!.toFixed(1) }}/10</span>
        </div>

        <div class="indices__row" v-if="indices?.normalized.safety != null">
          <span class="indices__k"><Icon name="i-lucide-shield" class="i-icon" />{{ t("quizzes.countryFit.indices.safety") }}</span>
          <span class="indices__val">{{ indices!.normalized.safety!.toFixed(1) }}/10</span>
        </div>

        <div class="indices__meta text-muted" v-if="indices?.updatedAtISO">
          {{ t("quizzes.countryFit.indices.updated") }}: {{ indices!.updatedAtISO.slice(0, 10) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-card {
  position: relative;
}

.ratings {
  display: grid;
  gap: 6px;
  text-align: right;
}

.rating__label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1;
}

.rating__val {
  font-weight: 900;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
}

.i-icon {
  width: 16px;
  height: 16px;
}

.indices {
  position: relative;
  display: inline-block;
}

.indices__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  line-height: 1;
  cursor: default;
}

.indices__trigger:focus-visible {
  outline: 2px solid rgba(128, 90, 245, 0.55);
  outline-offset: 2px;
}

.indices__panel {
  position: absolute;
  z-index: 70;
  left: 0;
  top: calc(100% + 10px);
  width: 320px;

  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--ui-border);
  background: rgba(15, 15, 18, 0.92);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);

  opacity: 0;
  transform: translateY(-6px);
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
}

.indices:hover .indices__panel,
.indices:focus-within .indices__panel {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.indices__title {
  font-weight: 900;
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.indices__row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.indices__k {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.indices__val {
  font-variant-numeric: tabular-nums;
  font-weight: 900;
}

.indices__meta {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.25;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  line-height: 1;
}
</style>