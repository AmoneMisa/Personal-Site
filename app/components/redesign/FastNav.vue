<script setup lang="ts">
import { useHomeContent } from "~/composables/useHomeContent";

const content = useHomeContent();
const items = computed(() => {
  const labels = content.value.fastnav;
  const ids = ["hero-anchor", "profile-skills", "experience", "pet-projects", "tools", "contact"];
  return ids.map((id, i) => ({ id, label: labels[i] ?? id }));
});

const open = ref(false);
const active = ref("hero-anchor");
const root = ref<HTMLElement | null>(null);
const toggle = ref<HTMLElement | null>(null);

let observer: IntersectionObserver | null = null;

function onDocClick(e: MouseEvent) {
  const t = e.target as Node;
  if (root.value && !root.value.contains(t) && toggle.value && !toggle.value.contains(t)) {
    open.value = false;
  }
}

onMounted(() => {
  const els = items.value
    .map((i) => document.getElementById(i.id))
    .filter((el): el is HTMLElement => !!el);

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) active.value = (e.target as HTMLElement).id;
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  els.forEach((el) => observer!.observe(el));
  document.addEventListener("click", onDocClick);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener("click", onDocClick);
});
</script>

<template>
  <div class="fast-nav">
    <button
        ref="toggle"
        type="button"
        class="fast-nav__toggle"
        :class="{ 'fast-nav__toggle_open': open }"
        aria-label="Быстрая навигация по странице"
        :aria-expanded="open"
        @click="open = !open"
    >
      <span class="fast-nav__bar" /><span class="fast-nav__bar" /><span class="fast-nav__bar" />
    </button>

    <nav ref="root" class="fast-nav__panel" :class="{ 'fast-nav__panel_open': open }">
      <a
          v-for="it in items"
          :key="it.id"
          :href="`#${it.id}`"
          class="fast-nav__link"
          :class="{ 'fast-nav__link_active': active === it.id }"
          @click="open = false"
      >
        <span class="fast-nav__tick" />
        <span class="fast-nav__label mono">{{ it.label }}</span>
      </a>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.fast-nav__toggle {
  position: fixed;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--bg-panel);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-direction: column;
  gap: 4px;
}
.fast-nav__toggle:hover {
  border-color: var(--accent-pink);
}
.fast-nav__bar {
  width: 15px;
  height: 1.5px;
  background: var(--text-muted);
  transition: all 0.2s;
}
.fast-nav__toggle_open .fast-nav__bar {
  background: var(--accent-pink);
}
.fast-nav__toggle_open .fast-nav__bar:nth-child(1) {
  transform: translateY(5.5px) rotate(45deg);
}
.fast-nav__toggle_open .fast-nav__bar:nth-child(2) {
  opacity: 0;
}
.fast-nav__toggle_open .fast-nav__bar:nth-child(3) {
  transform: translateY(-5.5px) rotate(-45deg);
}

.fast-nav__panel {
  position: fixed;
  left: 70px;
  top: 50%;
  transform: translateY(-50%) scale(0.96);
  z-index: 55;
  background: var(--bg-panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s, transform 0.18s;
}
.fast-nav__panel_open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) scale(1);
}
.fast-nav__link {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fast-nav__tick {
  width: 12px;
  height: 1px;
  background: var(--line);
  transition: all 0.2s;
  flex-shrink: 0;
}
.fast-nav__link_active .fast-nav__tick {
  background: var(--accent-pink);
  width: 18px;
}
.fast-nav__label {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  transition: color 0.15s;
}
.fast-nav__link:hover .fast-nav__label,
.fast-nav__link_active .fast-nav__label {
  color: var(--text-primary);
}

@media (max-width: 960px) {
  .fast-nav {
    display: none;
  }
}
</style>
