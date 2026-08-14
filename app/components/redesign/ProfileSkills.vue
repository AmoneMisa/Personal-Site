<script setup lang="ts">
import { useHomeContent } from "~/composables/useHomeContent";
import { useExperienceYears } from "~/composables/useExperienceYears";

const content = useHomeContent();
const s = computed(() => content.value.skillsSection);
const { label: expLabel } = useExperienceYears();
</script>

<template>
  <section class="rd-section" id="profile-skills">
    <div class="rd-wrap">
      <div class="section-head">
        <div class="eyebrow mono">{{ s.eyebrow }}</div>
        <h2>{{ s.title }}</h2>
        <p>{{ s.subtitle }}</p>
        <div class="highlight-strip">
          <div v-for="h in s.highlights" :key="h" class="highlight-item mono">
            <span class="dash" />{{ h }}
          </div>
          <div class="highlight-item mono">
            <span class="dash" />{{ expLabel }} {{ s.highlightYearsSuffix }}
          </div>
        </div>
      </div>

      <div class="skills-grid">
        <div v-for="card in s.cards" :key="card.title" class="skill-card">
          <h4 class="mono">{{ card.title }}</h4>
          <ul>
            <li v-for="item in card.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>

      <div class="skills-cta">
        <span>{{ s.ctaLead }}</span>
        <a class="btn-text" href="#contact">{{ s.ctaText }}</a>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.section-head {
  margin-bottom: 42px;
  max-width: 600px;
}
.eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
h2 {
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.section-head p {
  color: var(--text-muted);
  margin-top: 10px;
  font-size: 14.5px;
}
.highlight-strip {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.highlight-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--text-primary);
}
.highlight-item .dash {
  width: 10px;
  height: 1px;
  background: var(--accent-pink);
  flex-shrink: 0;
}
.skills-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.skill-card {
  background: var(--bg-deep);
  padding: 24px;
}
.skill-card h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--accent-pink);
  margin-bottom: 14px;
  letter-spacing: 0.01em;
}
.skill-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.skill-card li {
  font-size: 13.5px;
  color: var(--text-muted);
  padding-left: 14px;
  position: relative;
  margin-bottom: 10px;
  line-height: 1.5;
}
.skill-card li::before {
  content: "—";
  position: absolute;
  left: 0;
  color: var(--line);
}
.skills-cta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 28px;
  flex-wrap: wrap;
}
.skills-cta span {
  font-size: 14px;
  color: var(--text-muted);
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

@media (max-width: 960px) {
  .skills-grid {
    grid-template-columns: 1fr;
  }
}
</style>
