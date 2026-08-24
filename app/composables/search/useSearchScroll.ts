import { onBeforeUnmount, onMounted, ref } from "vue";

export function useSearchScroll(threshold = 600) {
  const filtersEl = ref<HTMLElement | null>(null);
  const showBackToFilters = ref(false);

  function update() {
    showBackToFilters.value = window.scrollY > threshold;
  }

  function scrollToFilters() {
    filtersEl.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  onMounted(() => {
    window.addEventListener("scroll", update, { passive: true });
    update();
  });
  onBeforeUnmount(() => window.removeEventListener("scroll", update));

  return { filtersEl, showBackToFilters, scrollToFilters };
}
