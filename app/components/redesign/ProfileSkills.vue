<script setup lang="ts">
import { useHomeContent } from "~/composables/useHomeContent";

const content = useHomeContent();
const s = computed(() => content.value.skillsSection);
// 4 topical cards in a 2x2 grid; the last card (Languages) is shown separately.
const topical = computed(() => s.value.cards.slice(0, 4));
const languages = computed(() => s.value.cards[s.value.cards.length - 1]);
</script>

<template>
  <section class="rd-section profile-skills" id="profile-skills">
    <div class="rd-wrap">
      <div class="profile-skills__header">
        <div class="profile-skills__eyebrow mono">{{ s.eyebrow }}</div>
        <h2 class="profile-skills__title">{{ s.title }}</h2>
        <p class="profile-skills__subtitle">{{ s.subtitle }}</p>
      </div>

      <div class="profile-skills__grid">
        <article v-for="card in topical" :key="card.title" class="profile-skills__card">
          <h4 class="profile-skills__card-title mono">{{ card.title }}</h4>
          <ul class="profile-skills__list">
            <li v-for="item in card.items" :key="item" class="profile-skills__list-item">{{ item }}</li>
          </ul>
        </article>
      </div>

      <div class="profile-skills__languages">
        <h4 class="profile-skills__languages-title mono">{{ languages.title }}</h4>
        <ul class="profile-skills__language-list">
          <li v-for="item in languages.items" :key="item" class="profile-skills__language">{{ item }}</li>
        </ul>
      </div>

      <div class="profile-skills__cta">
        <span class="profile-skills__cta-text">{{ s.ctaLead }}</span>
        <a class="profile-skills__cta-link" href="#contact">{{ s.ctaText }}</a>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.profile-skills__header {
  margin-bottom: 42px;
  max-width: 600px;
}
.profile-skills__eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.profile-skills__title {
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.profile-skills__subtitle {
  color: var(--text-muted);
  margin-top: 10px;
  font-size: 14.5px;
}
.profile-skills__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.profile-skills__card {
  background: var(--bg-deep);
  padding: 24px;
}
.profile-skills__card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--accent-pink);
  margin-bottom: 14px;
  letter-spacing: 0.01em;
}
.profile-skills__list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.profile-skills__list-item {
  font-size: 13.5px;
  color: var(--text-muted);
  padding-left: 14px;
  position: relative;
  margin-bottom: 10px;
  line-height: 1.5;
}
.profile-skills__list-item::before {
  content: "—";
  position: absolute;
  left: 0;
  color: var(--line);
}
.profile-skills__languages {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  margin-top: 24px;
  padding: 18px 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.profile-skills__languages-title {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.profile-skills__language-list {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  list-style: none;
  padding: 0;
  margin: 0;
}
.profile-skills__language {
  font-size: 13.5px;
  color: var(--text-primary);
}
.profile-skills__cta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 28px;
  flex-wrap: wrap;
}
.profile-skills__cta-text {
  font-size: 14px;
  color: var(--text-muted);
}
.profile-skills__cta-link {
  color: var(--text-primary);
  font-size: 14.5px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 2px;
}
.profile-skills__cta-link:hover {
  border-color: var(--text-primary);
}

@media (max-width: 760px) {
  .profile-skills__grid {
    grid-template-columns: 1fr;
  }
}
</style>
