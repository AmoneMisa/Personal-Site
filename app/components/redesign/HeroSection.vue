<script setup lang="ts">
import RedesignEmoji from "~/components/redesign/RedesignEmoji.vue";
import { useHomeContent } from "~/composables/useHomeContent";
import { useExperienceYears } from "~/composables/useExperienceYears";

const content = useHomeContent();
const hero = computed(() => content.value.hero);
const { years } = useExperienceYears();
const heroStats = computed(() =>
  hero.value.stats.map((s) => ({
    value: s.value.replace("%years%", String(years.value)),
    label: s.label,
  }))
);
</script>

<template>
  <section class="rd-section hero" id="hero-anchor">
    <ocean-page-backdrop variant="ambient" />
    <div class="rd-wrap">
      <div class="hero__grid">
        <div class="hero__content">
          <div class="hero__eyebrow mono">{{ hero.eyebrow }}</div>
          <h1 class="hero__title">{{ hero.h1before }}<span class="hero__accent">{{ hero.h1accent }}</span></h1>
          <p class="hero__lead">{{ hero.lead }}</p>
          <div class="hero__actions">
            <a class="hero__button hero__button_primary" href="#contact">{{ hero.ctaPrimary }}</a>
            <a class="hero__button hero__button_text" href="#profile-skills">{{ hero.ctaText }}</a>
          </div>
          <div class="hero__stats">
            <div class="hero__stat" v-for="(s, i) in heroStats" :key="i">
              <b class="hero__stat-value">{{ s.value }}</b>
              <span class="hero__stat-label mono">{{ s.label }}</span>
            </div>
          </div>
        </div>

        <div class="hero__portrait">
          <div class="hero__portrait-frame">
            <nuxt-img
                class="hero__portrait-image"
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
          <div class="hero__portrait-caption">
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
  position: relative;
  isolation: isolate;
  overflow: visible;
  padding: 76px 0 68px;
}
.hero > .rd-wrap {
  position: relative;
  z-index: 1;
}
.hero__grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 56px;
  align-items: center;
}
.hero__eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
  margin-bottom: 16px;
}
.hero__title {
  font-size: clamp(34px, 5.2vw, 52px);
  line-height: 1.08;
  font-weight: 600;
  letter-spacing: -0.015em;
  margin-bottom: 22px;
  color: var(--text-primary);
}
.hero__accent {
  color: var(--accent-pink);
}
.hero__lead {
  font-size: 17px;
  color: var(--text-soft);
  max-width: 520px;
  margin-bottom: 32px;
  line-height: 1.62;
}
.hero__actions {
  display: flex;
  gap: 16px;
  margin-bottom: 40px;
  flex-wrap: wrap;
  align-items: center;
}
.hero__button_primary {
  background: var(--accent-pink);
  color: #1a0e14;
  font-weight: 500;
  padding: 11px 22px;
  border-radius: 6px;
  font-size: 14.5px;
}
.hero__button_text {
  color: var(--text-primary);
  font-size: 14.5px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 2px;
}
.hero__button_text:hover {
  border-color: var(--text-primary);
}
.hero__stats {
  display: flex;
  gap: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
}
.hero__stat {
  max-width: 220px;
}
.hero__stat-value {
  display: block;
  font-family: "Golos Text", sans-serif;
  font-weight: 600;
  font-size: 15.5px;
  line-height: 1.25;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.hero__stat-label {
  font-size: 12px;
  color: var(--text-muted);
}
.hero__portrait {
  position: relative;
}
.hero__portrait-frame {
  aspect-ratio: 4 / 5;
  border-radius: 16px;
  overflow: hidden;
  background: var(--bg-panel);
  border: 1px solid var(--line);
}
.hero__portrait-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}
.hero__portrait-caption {
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
  .hero__grid {
    grid-template-columns: 1fr;
    gap: 36px;
  }
}
</style>
