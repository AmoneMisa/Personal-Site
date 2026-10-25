<script setup lang="ts">
// Crawlable explanation + FAQ under a page. `i18nKey` points at a message block
// (e.g. `services.mergeJson.about`) with title, p1..pN, faqTitle, faq.q1/a1...
const props = defineProps<{ i18nKey: string }>();
const { t, te } = useI18n();

const base = computed(() => props.i18nKey);

function collect(build: (n: number) => string[]): string[][] {
  const rows: string[][] = [];
  for (let n = 1; n <= 8; n += 1) {
    const keys = build(n);
    if (!keys.every((key) => te(key))) break;
    rows.push(keys.map((key) => t(key)));
  }
  return rows;
}

const paragraphs = computed(() => collect((n) => [`${base.value}.p${n}`]).map(([text]) => text));
const faq = computed(() =>
  collect((n) => [`${base.value}.faq.q${n}`, `${base.value}.faq.a${n}`]).map(([q, a]) => ({ q, a })),
);
</script>

<template>
  <section v-if="paragraphs.length" class="tool-about">
    <h2 class="tool-about__title">{{ t(`${base}.title`) }}</h2>
    <p v-for="(text, i) in paragraphs" :key="i" class="tool-about__text">{{ text }}</p>

    <template v-if="faq.length">
      <h3 class="tool-about__faq-title">{{ t(`${base}.faqTitle`) }}</h3>
      <details v-for="(item, i) in faq" :key="i" class="tool-about__faq">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
    </template>
  </section>
</template>

<style lang="scss">
.tool-about {
  width: min(100%, 880px);
  margin: 48px auto 0;
  padding-inline: 24px;
  box-sizing: border-box;
}

.tool-about__title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.tool-about__text {
  line-height: 1.65;
  margin-bottom: 12px;
  opacity: 0.88;
}

.tool-about__faq-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 28px 0 8px;
}

.tool-about__faq {
  border-top: 1px solid var(--color-border, var(--line));
  padding: 10px 0;

  summary {
    cursor: pointer;
    font-weight: 500;
  }

  p {
    margin-top: 8px;
    line-height: 1.6;
    opacity: 0.88;
  }
}

@media (max-width: 767px) {
  .tool-about {
    padding-inline: 16px;
    margin-top: 32px;
  }
}
</style>
