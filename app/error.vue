<script setup lang="ts">
import CustomButton from "~/components/common/CustomButton.vue";

const props = defineProps<{
  error?: {
    statusCode?: number
    statusMessage?: string
    message?: string
  }
}>();

const { t } = useI18n();
const localePath = useLocalePath();

const code = computed(() => props.error?.statusCode ?? 500);
const is404 = computed(() => code.value === 404);

const titleKey = computed(() => (is404.value ? "errors.404.title" : "errors.500.title"));
const textKey = computed(() => (is404.value ? "errors.404.text" : "errors.500.text"));

const details = computed(() => props.error?.statusMessage || props.error?.message || "Unknown error");

function goHome() {
  clearError({ redirect: "/" });
}

function retry() {
  clearError();
}
</script>

<template>
  <div class="err-page">
    <div class="err-page__bg" aria-hidden="true" />

    <u-container class="err-page__wrap">
      <div class="err-card">
        <div class="err-card__badge">
          <span class="err-card__badge-inner">
            {{ is404 ? "404" : "500" }}
          </span>
        </div>

        <div class="err-card__content">
          <p class="err-card__kicker gradient-text">
            {{ is404 ? t("errors.kicker.notFound") : t("errors.kicker.server") }}
          </p>

          <h1 class="err-card__title">
            {{ t(titleKey) }}
          </h1>

          <p class="err-card__text">
            {{ t(textKey) }}
          </p>

          <div class="err-card__actions">
            <custom-button variant="full" class="err-card__btn" @click="goHome">
              {{ t("errors.actions.home") }}
            </custom-button>

            <button
                type="button"
                class="ui-pill-btn ui-pill-btn_animated"
                @click="retry"
            >
              <span class="ui-pill-btn__inner">
                <u-icon name="i-lucide-refresh-cw" />
                {{ t("errors.actions.retry") }}
              </span>
            </button>
          </div>

          <div class="err-card__details" v-if="!is404">
            <details>
              <summary>{{ t("errors.details") }}</summary>
              <pre class="err-card__pre">{{ details }}</pre>
            </details>
          </div>

          <div class="err-card__links">
            <NuxtLink :to="localePath('/')" class="err-card__link">
              {{ t("errors.links.main") }}
            </NuxtLink>
            <NuxtLink :to="localePath('/services')" class="err-card__link">
              {{ t("errors.links.services") }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </u-container>
  </div>
</template>

<style scoped>
.err-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  padding: 24px 0;
}

.err-page__bg {
  position: absolute;
  inset: -40%;
  z-index: 0;
  pointer-events: none;

  background:
      radial-gradient(35% 35% at 30% 30%, rgba(128, 90, 245, 0.28), transparent 60%),
      radial-gradient(30% 30% at 70% 65%, rgba(205, 153, 255, 0.18), transparent 60%),
      radial-gradient(40% 40% at 60% 20%, rgba(255, 255, 255, 0.06), transparent 65%);

  filter: blur(14px);
  animation: errFloat 10s ease-in-out infinite;
  opacity: 0.9;
}

@keyframes errFloat {
  0% { transform: translate3d(-1.5%, 0.5%, 0); }
  50% { transform: translate3d(1.5%, -0.5%, 0); }
  100% { transform: translate3d(-1.5%, 0.5%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .err-page__bg { animation: none; }
}

.err-page__wrap {
  position: relative;
  z-index: 1;
  width: 100%;
}

.err-card {
  margin: 0 auto;
  max-width: 860px;
  position: relative;
  padding: 2px;
  border-radius: 20px;
  overflow: hidden;

  background: linear-gradient(
      90deg,
      rgba(128, 90, 245, 0.75),
      rgba(255, 255, 255, 0.10),
      rgba(205, 153, 255, 0.65),
      rgba(128, 90, 245, 0.75)
  );
  background-size: 300% 100%;
  animation: uiBorderFlow 6.2s linear infinite;

  clip-path: polygon(0 0, calc(100% - 44px) 0, 100% 38px, 100% 100%, 0 100%);

  box-shadow:
      0 24px 70px rgba(0, 0, 0, 0.48),
      0 0 0 1px rgba(255, 255, 255, 0.03);
}

@keyframes uiBorderFlow {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .err-card { animation: none; }
}

.err-card__badge {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
}

.err-card__badge-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;

  background: rgba(14, 12, 21, 0.70);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.88);
  font-weight: 900;
  letter-spacing: 0.6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
}

.err-card__content {
  background: rgba(14, 12, 21, 0.92);
  border-radius: 18px;
  padding: 44px 22px 22px;
  text-align: center;

  box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      inset 0 -18px 30px rgba(0, 0, 0, 0.45);

  clip-path: polygon(0 0, calc(100% - 44px) 0, 100% 38px, 100% 100%, 0 100%);
}

.err-card__kicker {
  font-weight: 800;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.err-card__title {
  font-size: 44px;
  font-weight: 900;
  line-height: 1.05;
  color: var(--text-white);
  margin-bottom: 12px;
}

.err-card__text {
  max-width: 64ch;
  margin: 0 auto 18px;
  color: var(--ui-text-muted);
  line-height: 1.65;
}

.err-card__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 10px;
}

.err-card__btn {
  min-width: 220px;
}

.err-card__details {
  margin-top: 16px;
  text-align: left;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 14px;
}

.err-card__details summary {
  cursor: pointer;
  color: rgba(255, 255, 255, 0.80);
  font-weight: 700;
}

.err-card__pre {
  margin-top: 10px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.78);
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
}

.err-card__links {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.err-card__link {
  color: var(--color-link);
  font-weight: 700;
  text-decoration: none;
  border-bottom: 1px dashed rgba(205, 153, 255, 0.28);
  padding-bottom: 2px;
  transition: filter 160ms ease, border-color 160ms ease;
}

.err-card__link:hover {
  filter: brightness(1.08);
  border-color: rgba(128, 90, 245, 0.55);
}

@media (max-width: 640px) {
  .err-card__title { font-size: 34px; }
  .err-card__content { padding-top: 50px; }
}

/* Light theme overrides */
.light .err-card__content {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(12px) saturate(180%);
  box-shadow:
      0 12px 35px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.65),
      inset 0 -4px 12px rgba(0, 0, 0, 0.06),
      inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}

.light .err-card__badge-inner {
  background: rgba(255, 255, 255, 0.75);
  border-color: rgba(0, 0, 0, 0.08);
  color: rgba(21, 22, 42, 0.86);
}

.light .err-card__title { color: rgba(21, 22, 42, 0.92); }
.light .err-card__text { color: rgba(21, 22, 42, 0.62); }
.light .err-card__details summary,
.light .err-card__pre { color: rgba(21, 22, 42, 0.75); }
</style>
