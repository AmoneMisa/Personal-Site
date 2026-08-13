<script setup lang="ts">
import RedesignEmoji from "~/components/redesign/RedesignEmoji.vue";
import { useHomeContent } from "~/composables/useHomeContent";
import { useExperienceYears } from "~/composables/useExperienceYears";

const content = useHomeContent();
const hero = computed(() => content.value.hero);
const { label: expLabel } = useExperienceYears();
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
            <div class="stat">
              <b>{{ expLabel }}</b>
              <span class="mono">{{ hero.statPracticeLabel }}</span>
            </div>
            <div class="stat">
              <b>2</b>
              <span class="mono">{{ hero.statCompanies }}</span>
            </div>
          </div>
        </div>

        <div class="hero-portrait">
          <div class="portrait-frame">
            <redesign-emoji cp="1f988" :size="44" alt="акула" />
            <div class="portrait-placeholder">{{ hero.portraitPlaceholder }}</div>
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
  font-size: 38px;
  line-height: 1.24;
  font-weight: 400;
  margin-bottom: 20px;
}
h1 .accent {
  color: var(--accent-pink);
}
.lead {
  font-size: 16px;
  color: var(--text-muted);
  max-width: 500px;
  margin-bottom: 30px;
  line-height: 1.6;
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
.stat b {
  display: block;
  font-family: "Golos Text", sans-serif;
  font-weight: 400;
  font-size: 19px;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.stat span {
  font-size: 12px;
  color: var(--text-muted);
}
.hero-portrait {
  position: relative;
}
.portrait-frame {
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  overflow: hidden;
  background: var(--bg-panel);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14px;
}
.portrait-placeholder {
  font-size: 13.5px;
  color: var(--text-muted);
  text-align: center;
  padding: 0 24px;
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
  h1 {
    font-size: 30px;
  }
}
</style>
