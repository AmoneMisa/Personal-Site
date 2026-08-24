<script setup lang="ts">
const props = defineProps<{
  error?: {
    statusCode?: number
    statusMessage?: string
    message?: string
  }
}>();

const { locale } = useI18n();
const localePath = useLocalePath();

const code = computed(() => props.error?.statusCode ?? 500);
const is404 = computed(() => code.value === 404);
const isRu = computed(() => locale.value === "ru");

const copy = computed(() => {
  if (is404.value) {
    return isRu.value
      ? {
          kicker: "Упс!",
          title: "Страница уплыла",
          text: "Похоже, акулка утащила страницу, а котик уже мчится по следу.",
          hint: "Попробуйте вернуться на главную или открыть нужный раздел ещё раз.",
          primary: "На главную",
          secondary: "Назад",
        }
      : {
          kicker: "Oops!",
          title: "This page swam away",
          text: "Looks like the little shark carried this page off, and the cat is already on the trail.",
          hint: "Head back home or try opening the section you need again.",
          primary: "Home",
          secondary: "Back",
        };
  }

  return isRu.value
    ? {
        kicker: "Ошибка сервера",
        title: "Что-то пошло не так",
        text: "Похоже, акулка устроила переполох на сервере, а котик уже всё чинит.",
        hint: "Попробуйте обновить страницу или вернуться позже — скоро всё снова будет мур-мур.",
        primary: "На главную",
        secondary: "Повторить",
      }
    : {
        kicker: "Server error",
        title: "Something went wrong",
        text: "Looks like the little shark caused some chaos on the server, and the cat is already fixing it.",
        hint: "Try refreshing the page or come back a little later — everything should be purring again soon.",
        primary: "Home",
        secondary: "Retry",
      };
});

const artworkSrc = computed(() =>
  is404.value ? "/images/errors/error-404.png" : "/images/errors/error-500.png",
);

const details = computed(
  () => props.error?.statusMessage || props.error?.message || "Server Error",
);

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

    <section class="error-card" :class="{ 'error-card--404': is404 }">
      <div class="error-card__body">
        <div class="error-copy">
          <span class="error-code">{{ code }}</span>

          <p class="error-kicker">{{ copy.kicker }}</p>
          <h1 class="error-title">{{ copy.title }}</h1>
          <p class="error-text">{{ copy.text }}</p>
          <p class="error-hint">{{ copy.hint }}</p>

          <div class="error-actions">
            <button type="button" class="error-button error-button--primary" @click="goHome">
              <u-icon name="i-lucide-house" aria-hidden="true" />
              <span>{{ copy.primary }}</span>
            </button>

            <button
              type="button"
              class="error-button error-button--secondary"
              @click="is404 ? goBack() : retry()"
            >
              <u-icon :name="is404 ? 'i-lucide-arrow-left' : 'i-lucide-refresh-cw'" aria-hidden="true" />
              <span>{{ copy.secondary }}</span>
            </button>
          </div>

          <details v-if="!is404" class="error-details">
            <summary>
              <u-icon name="i-lucide-chevron-down" aria-hidden="true" />
              <span>{{ isRu ? "Технические детали" : "Technical details" }}</span>
            </summary>
            <pre>{{ details }}</pre>
          </details>
        </div>

        <div class="error-art" aria-hidden="true">
          <span class="bubble bubble--one" />
          <span class="bubble bubble--two" />
          <span class="bubble bubble--three" />
          <img :src="artworkSrc" alt="" decoding="async" fetchpriority="high">
        </div>
      </div>

      <nav class="error-nav" :aria-label="isRu ? 'Навигация' : 'Navigation'">
        <NuxtLink :to="localePath('/')" class="error-nav__link error-nav__link--active">
          <u-icon name="i-lucide-house" aria-hidden="true" />
          <span>{{ isRu ? "Главная" : "Home" }}</span>
        </NuxtLink>
        <span class="error-nav__divider" aria-hidden="true" />
        <NuxtLink :to="localePath('/services')" class="error-nav__link">
          <u-icon name="i-lucide-layout-grid" aria-hidden="true" />
          <span>{{ isRu ? "Сервисы" : "Services" }}</span>
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
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(420px, 1.1fr);
  align-items: center;
  gap: clamp(20px, 3vw, 54px);
  padding: clamp(34px, 5vw, 72px) clamp(30px, 5vw, 74px) clamp(28px, 4vw, 54px);
}

.error-copy { position: relative; z-index: 2; max-width: 510px; }

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

.error-art {
  position: relative;
  min-height: 440px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-art::before {
  content: "";
  position: absolute;
  inset: 7% 1% 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(32, 126, 220, 0.16), rgba(10, 16, 43, 0) 68%);
  filter: blur(18px);
}

.error-art img {
  position: relative;
  z-index: 1;
  display: block;
  width: min(100%, 560px);
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 25px 30px rgba(0, 0, 0, 0.24));
}

.bubble {
  position: absolute;
  z-index: 2;
  display: block;
  border-radius: 50%;
  border: 1px solid rgba(98, 181, 255, 0.5);
  box-shadow: inset 2px 2px 3px rgba(255, 255, 255, 0.2), 0 0 12px rgba(54, 136, 255, 0.14);
}

.bubble--one { width: 15px; height: 15px; top: 14%; left: 18%; }
.bubble--two { width: 9px; height: 9px; top: 28%; right: 9%; }
.bubble--three { width: 20px; height: 20px; bottom: 20%; right: 18%; opacity: 0.55; }

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

@media (max-width: 900px) {
  .error-page { padding: 16px; }
  .error-card { border-radius: 24px; }
  .error-card__body { grid-template-columns: 1fr; min-height: 0; padding: 34px 24px 20px; gap: 4px; }
  .error-copy { max-width: none; }
  .error-title { max-width: 14ch; }
  .error-art { min-height: 300px; margin-top: 8px; }
  .error-art img { width: min(92vw, 500px); }
}

@media (max-width: 560px) {
  .error-code { margin-bottom: 22px; height: 42px; min-width: 68px; font-size: 20px; }
  .error-title { font-size: clamp(36px, 11vw, 48px); }
  .error-actions { flex-direction: column; }
  .error-button { width: 100%; }
  .error-art { min-height: 245px; }
  .error-nav { min-height: 68px; gap: 14px; }
  .error-nav__link { font-size: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .error-button { transition: none; }
}
</style>
