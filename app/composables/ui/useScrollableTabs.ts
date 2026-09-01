import {nextTick, onBeforeUnmount, onMounted, ref} from "vue";

export function useScrollableTabs(triggerSelector = ".tabs__trigger") {
  const scrollRef = ref<HTMLElement | null>(null);
  const indicatorRef = ref<HTMLElement | null>(null);
  const activeIndex = ref(0);

  function triggers() {
    return scrollRef.value?.querySelectorAll<HTMLElement>(triggerSelector) ?? [];
  }

  function moveIndicator(index: number) {
    const active = triggers()[index];
    const indicator = indicatorRef.value;
    if (!active || !indicator) return;

    const width = 12;
    const center = active.offsetLeft + active.offsetWidth / 2;
    indicator.style.width = `${width}px`;
    indicator.style.transform = `translateX(${Math.round(center - width / 2)}px)`;
  }

  function ensureVisible(index: number) {
    const wrap = scrollRef.value;
    const active = triggers()[index];
    if (!wrap || !active) return;

    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    const viewLeft = wrap.scrollLeft;
    const viewRight = viewLeft + wrap.clientWidth;

    if (left < viewLeft) wrap.scrollTo({left: left - 16, behavior: "smooth"});
    else if (right > viewRight) {
      wrap.scrollTo({left: right - wrap.clientWidth + 16, behavior: "smooth"});
    }
  }

  async function select(index: number) {
    activeIndex.value = index;
    await nextTick();
    moveIndicator(index);
    ensureVisible(index);
  }

  function handleResize() {
    nextTick(() => moveIndicator(activeIndex.value));
  }

  onMounted(() => {
    select(activeIndex.value);
    window.addEventListener("resize", handleResize, {passive: true});
  });

  onBeforeUnmount(() => window.removeEventListener("resize", handleResize));

  return {scrollRef, indicatorRef, activeIndex, select};
}
