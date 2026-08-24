<script setup lang="ts">
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
const errorCopyKey = computed(() => `errors.${is404.value ? "404" : "500"}`);

const artworkSrc = computed(() =>
  is404.value ? "/images/errors/error-404.png" : "/images/errors/error-500.png",
);

const artStyle = computed(() => ({
  "--error-art-url": `url("${artworkSrc.value}")`,
}));

const details = computed(
  () => props.error?.statusMessage || props.error?.message || "Server Error",
);

function copy(field: "kicker" | "title" | "text" | "hint") {
  return t(`${errorCopyKey.value}.${field}`);
}

function goHome() {
  clearError({ redirect: localePath("/") });
}

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
    return;
  }
  goHome();
}

function retry() {
  if (import.meta.client) {
    window.location.reload();
    return;
  }
  clearError();
}
</script>

<template>
  <main class="error-page">
    <div class="error-page__glow error-page__glow--one" aria-hidden="true" />
    <div class="error-page__glow error-page__glow--two" aria-hidden="true" />

    <section class="error-card">
      <div
        class="error-card__body"
        :class="{ 'error-card__body--404': is404 }"
        :style="artStyle"
      >
        <div class="error-copy">
          <span class="error-code">{{ code }}</span>

          <p class="error-kicker">{{ copy("kicker") }}</p>
          <h1 class="error-title">{{ copy("title") }}</h1>
          <p class="error-text">{{ copy("text") }}</p>
          <p class="error-hint">{{ copy("hint") }}</p>

          <div class="error-actions">
            <button type="button" class="error-button error-button--primary" @click="goHome">
              <u-icon name="i-lucide-house" aria-hidden="true" />
              <span>{{ t("errors.actions.home") }}</span>
            </button>

            <button
              type="button"
              class="error-button error-button--secondary"
              @click="is404 ? goBack() : retry()"
            >
              <u-icon
                :name="is404 ? 'i-lucide-arrow-left' : 'i-lucide-refresh-cw'"
                aria-hidden="true"
              />
              <span>{{ is404 ? t("errors.actions.back") : t("errors.actions.retry") }}</span>
            </button>
          </div>

          <details v-if="!is404" class="error-details">
            <summary>
              <u-icon name="i-lucide-chevron-down" aria-hidden="true" />
              <span>{{ t("errors.details") }}</span>
            </summary>
            <pre>{{ details }}</pre>
          </details>
        </div>

        <div class="error-art-mobile" aria-hidden="true">
          <img :src="artworkSrc" alt="" decoding="async" fetchpriority="high">
        </div>
      </div>

      <nav class="error-nav" :aria-label="t('errors.navigationLabel')">
        <NuxtLink :to="localePath('/')" class="error-nav__link error-nav__link--active">
          <u-icon name="i-lucide-house" aria-hidden="true" />
          <span>{{ t("errors.links.main") }}</span>
        </NuxtLink>
        <span class="error-nav__divider" aria-hidden="true" />
        <NuxtLink :to="localePath('/services')" class="error-nav__link">
          <u-icon name="i-lucide-layout-grid" aria-hidden="true" />
          <span>{{ t("errors.links.services") }}</span>
        </NuxtLink>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: clamp(18px, 3vw, 48px);
  background:
    radial-gradient(circle at 82% 18%, rgba(37, 117, 221, 0.12), transparent 25%),
    radial-gradient(circle at 12% 84%, rgba(138, 68, 209, 0.12), transparent 28%),
    #070c22;
  color: #f8f8fb;
}

.error-page::before,
.error-page::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(75, 145, 255, 0.22);
  pointer-events: none;
}

.error-page::before {
  width: 10px;
  height: 10px;
  left: 7%;
  top: 34%;
  box-shadow: 32px 42px 0 3px rgba(67, 119, 221, 0.09), 105px 420px 0 5px rgba(66, 172, 255, 0.08);
}

.error-page::after {
  width: 8px;
  height: 8px;
  right: 8%;
  top: 26%;
  box-shadow: -42px 54px 0 2px rgba(64, 157, 255, 0.08), 16px 190px 0 4px rgba(118, 83, 226, 0.08);
}

.error-page__glow {
  position: absolute;
  z-index: -1;
  width: 36rem;
  height: 36rem;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.12;
  pointer-events: none;
}

.error-page__glow--one { right: -18rem; top: -15rem; background: #168dff; }
.error-page__glow--two { left: -20rem; bottom: -17rem; background: #c83eff; }

.error-card {
  width: min(1180px, 100%);
  overflow: hidden;
  border: 1px solid rgba(77, 92, 154, 0.55);
  border-radius: 30px;
  background: linear-gradient(145deg, rgba(8, 13, 35, 0.98), rgba(8, 11, 28, 0.96));
  box-shadow: 0 32px 90px rgba(0, 0, 0, 0.42), inset 0 1px rgba(255, 255, 255, 0.025);
}

.error-card__body {
  min-height: 570px;
  position: relative;
  display: flex;
  align-items: center;
  padding: clamp(34px, 5vw, 72px) clamp(30px, 5vw, 74px) clamp(28px, 4vw, 54px);
  background-image:
    linear-gradient(
      90deg,
      rgba(8, 12, 34, 0.98) 0%,
      rgba(8, 12, 34, 0.94) 30%,
      rgba(8, 12, 34, 0.72) 44%,
      rgba(8, 12, 34, 0.18) 60%,
      rgba(8, 12, 34, 0.02) 100%
    ),
    var(--error-art-url);
  background-repeat: no-repeat, no-repeat;
  background-size: 100% 100%, cover;
  background-position: left top, center right;
}

.error-card__body--404 {
  background-position: left top, center right;
}

.error-copy {
  position: relative;
  z-index: 2;
  width: min(510px, 100%);
}

.error-code {
  display: inline-flex;
  min-width: 78px;
  height: 48px;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  margin-bottom: 30px;
  border: 1px solid rgba(241, 73, 157, 0.76);
  border-radius: 14px;
  color: #f565a5;
  background: rgba(13, 15, 38, 0.62);
  font-size: 23px;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.error-kicker {
  margin: 0 0 8px;
  color: #ef67a3;
  font-size: clamp(18px, 1.7vw, 23px);
  font-weight: 800;
}

.error-title {
  margin: 0;
  max-width: 15ch;
  color: #fff;
  font-size: clamp(38px, 4.2vw, 62px);
  line-height: 1.02;
  letter-spacing: -0.035em;
  font-weight: 900;
  text-wrap: balance;
}

.error-text,
.error-hint {
  max-width: 48ch;
  color: rgba(230, 232, 244, 0.78);
  font-size: clamp(16px, 1.45vw, 19px);
  line-height: 1.55;
}

.error-text { margin: 24px 0 0; }
.error-hint { margin: 12px 0 0; color: rgba(205, 209, 228, 0.61); font-size: clamp(14px, 1.25vw, 17px); }

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 30px;
}

.error-button {
  min-height: 54px;
  min-width: 176px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 24px;
  border-radius: 12px;
  border: 1px solid transparent;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}

.error-button:hover { transform: translateY(-2px); }
.error-button:focus-visible { outline: 3px solid rgba(89, 170, 255, 0.42); outline-offset: 3px; }

.error-button--primary {
  color: #111328;
  background: linear-gradient(135deg, #f875b0, #e95898);
  box-shadow: 0 10px 30px rgba(231, 72, 147, 0.22);
}

.error-button--secondary {
  color: #e9e7f2;
  border-color: #e45a9b;
  background: rgba(15, 17, 40, 0.62);
}

.error-button--secondary:hover { background: rgba(228, 90, 155, 0.09); }

.error-details {
  margin-top: 24px;
  max-width: 470px;
  border: 1px solid rgba(78, 92, 145, 0.35);
  border-radius: 14px;
  background: rgba(12, 17, 44, 0.56);
  overflow: hidden;
  backdrop-filter: blur(8px);
}

.error-details summary {
  min-height: 52px;
  padding: 0 17px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgba(227, 230, 245, 0.74);
  cursor: pointer;
  font-weight: 700;
  list-style: none;
}

.error-details summary::-webkit-details-marker { display: none; }
.error-details[open] summary :deep(svg) { transform: rotate(180deg); }
.error-details pre {
  margin: 0;
  padding: 14px 17px 17px;
  border-top: 1px solid rgba(78, 92, 145, 0.24);
  color: rgba(229, 232, 246, 0.72);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
}

.error-art-mobile {
  display: none;
}

.error-art-mobile img {
  display: block;
  width: 100%;
  height: auto;
}

.error-nav {
  min-height: 78px;
  padding: 16px 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  border-top: 1px solid rgba(72, 86, 139, 0.38);
  background: rgba(6, 10, 27, 0.38);
}

.error-nav__link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  color: rgba(218, 220, 236, 0.78);
  text-decoration: none;
  font-size: 16px;
  font-weight: 700;
  border-bottom: 1px dashed rgba(129, 136, 184, 0.42);
}

.error-nav__link:hover,
.error-nav__link--active { color: #f36ba8; border-color: rgba(243, 107, 168, 0.65); }
.error-nav__divider { width: 1px; height: 20px; background: rgba(115, 125, 173, 0.38); }

@media (max-width: 1100px) {
  .error-card__body {
    min-height: 540px;
    background-position: left top, 68% center;
  }

  .error-copy {
    width: min(480px, 100%);
  }
}

@media (max-width: 900px) {
  .error-page { padding: 16px; }
  .error-card { border-radius: 24px; }

  .error-card__body {
    min-height: 0;
    display: block;
    padding: 34px 24px 24px;
    background-image: linear-gradient(
      180deg,
      rgba(8, 12, 34, 0.98) 0%,
      rgba(8, 12, 34, 0.95) 52%,
      rgba(8, 12, 34, 0.9) 100%
    );
    background-size: 100% 100%;
    background-position: left top;
  }

  .error-copy {
    width: 100%;
    max-width: none;
  }

  .error-title { max-width: 14ch; }

  .error-art-mobile {
    display: block;
    margin-top: 22px;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(72, 86, 139, 0.32);
    background:
      radial-gradient(circle at 70% 30%, rgba(45, 134, 255, 0.12), transparent 40%),
      rgba(8, 12, 34, 0.72);
  }
}

@media (max-width: 560px) {
  .error-code { margin-bottom: 22px; height: 42px; min-width: 68px; font-size: 20px; }
  .error-title { font-size: clamp(36px, 11vw, 48px); }
  .error-actions { flex-direction: column; }
  .error-button { width: 100%; }

  .error-art-mobile {
    margin-top: 18px;
    border-radius: 18px;
  }

  .error-nav {
    min-height: 68px;
    gap: 14px;
    padding: 14px 18px;
  }

  .error-nav__link { font-size: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .error-button { transition: none; }
}
</style>
