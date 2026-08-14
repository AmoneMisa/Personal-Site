<script setup lang="ts">
import RedesignEmoji from "~/components/redesign/RedesignEmoji.vue";
import { useHomeContent } from "~/composables/useHomeContent";
import { useExperienceYears } from "~/composables/useExperienceYears";

const content = useHomeContent();
const hero = computed(() => content.value.hero);
const { years } = useExperienceYears();
const heroStats = computed(() =>
  hero.value.stats.map((s) => ({
    value: s.value.replace("{years}", String(years.value)),
    label: s.label,
  }))
);
</script>

<template>
  <section class="rd-section hero" id="hero-anchor">
    <div class="rd-wrap">
      <div class="hero-grid">
        <div>
          <div class="eyebrow mono">{{ hero.eyebrow }}</div>
          <h1>{{ hero.h1before }}<span class="accent">{{ hero.h1accent }}</span></h1>
          <p class="lead">{{ hero.lead }}</p>
          <div class="hero-actions">
            <a class="btn-primary" href="#contact">{{ hero.ctaPrimary }}</a>
            <a class="btn-text" href="#profile-skills">{{ hero.ctaText }}</a>
          </div>
          <div class="stat-row">
            <div class="stat" v-for="(s, i) in heroStats" :key="i">
              <b>{{ s.value }}</b>
              <span class="mono">{{ s.label }}</span>
            </div>
          </div>
        </div>

        <div class="hero-portrait">
          <div class="portrait-frame">
            <nuxt-img
                class="portrait-img"
                src="/images/photo.png"
                alt="Marharyta Kubai"
                width="896"
                height="1195"
                sizes="(max-width: 960px) 88vw, 420px"
                format="webp"
                :quality="80"
                fetchpriority="high"
                preload
            />
          </div>
          <div class="portrait-caption">
            <redesign-emoji cp="1f63b" :size="15" alt="кот" />
            {{ hero.portraitCaption }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.hero {
  padding: 76px 0 68px;
}
.hero-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 56px;
  align-items: center;
}
.eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
  margin-bottom: 16px;
}
h1 {
  font-size: clamp(34px, 5.2vw, 52px);
  line-height: 1.08;
  font-weight: 600;
  letter-spacing: -0.015em;
  margin-bottom: 22px;
  color: var(--text-primary);
}
h1 .accent {
  color: var(--accent-pink);
}
.lead {
  font-size: 17px;
  color: var(--text-soft);
  max-width: 520px;
  margin-bottom: 32px;
  line-height: 1.62;
}
.hero-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 40px;
  flex-wrap: wrap;
  align-items: center;
}
.btn-primary {
  background: var(--accent-pink);
  color: #1a0e14;
  font-weight: 500;
  padding: 11px 22px;
  border-radius: 6px;
  font-size: 14.5px;
}
.btn-text {
  color: var(--text-primary);
  font-size: 14.5px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 2px;
}
.btn-text:hover {
  border-color: var(--text-primary);
}
.stat-row {
  display: flex;
  gap: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
}
.stat {
  max-width: 220px;
}
.stat b {
  display: block;
  font-family: "Golos Text", sans-serif;
  font-weight: 600;
  font-size: 15.5px;
  line-height: 1.25;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.stat span {
  font-size: 12px;
  color: var(--text-muted);
}
.hero-portrait {
  position: relative;
}
.portrait-frame {
  aspect-ratio: 4 / 5;
  border-radius: 16px;
  overflow: hidden;
  background: var(--bg-panel);
  border: 1px solid var(--line);
}
.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}
.portrait-caption {
  margin-top: 14px;
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 960px) {
  .hero {
    padding: 40px 0 36px;
  }
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 36px;
  }
}
</style>
