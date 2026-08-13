<script setup lang="ts">
import type {TabsItem} from '#ui/components/Tabs.vue';
import {nextTick, onBeforeUnmount, onMounted, ref} from 'vue';
import PageHeader from "~/components/common/PageHeader.vue";

defineProps<{
  tabs: TabsItem[]
  title?: string
  headline?: string
  description?: string
}>();

const {t} = useI18n();

const tabsScroll = useTemplateRef<HTMLElement>('tabsScroll');
const tabLine = useTemplateRef<HTMLElement>('tabLineElement');

const currentIndex = ref(0);

function moveTabLine(index: number) {
  const wrap = tabsScroll.value;
  const line = tabLine.value;
  if (!wrap || !line) return;

  const triggers = wrap.querySelectorAll<HTMLElement>('.tabs__trigger');
  const active = triggers[index];
  if (!active) return;

  const center = active.offsetLeft + active.offsetWidth / 2;
  const w = 12;
  line.style.width = `${w}px`;
  line.style.transform = `translateX(${Math.round(center - w / 2)}px)`;
}

function ensureTabVisible(index: number) {
  const wrap = tabsScroll.value;
  if (!wrap) return;

  const triggers = wrap.querySelectorAll<HTMLElement>('.tabs__trigger');
  const active = triggers[index];
  if (!active) return;

  const left = active.offsetLeft;
  const right = left + active.offsetWidth;
  const viewLeft = wrap.scrollLeft;
  const viewRight = wrap.scrollLeft + wrap.clientWidth;

  if (left < viewLeft) {
    wrap.scrollTo({left: left - 16, behavior: 'smooth'});
  } else if (right > viewRight) {
    wrap.scrollTo({left: right - wrap.clientWidth + 16, behavior: 'smooth'});
  }
}

async function onTabChange(index: number) {
  currentIndex.value = index;
  await nextTick();

  moveTabLine(index);
  ensureTabVisible(index);
}

function handleResize() {
  nextTick(() => moveTabLine(currentIndex.value));
}

onMounted(async () => {
  await nextTick();
  moveTabLine(0);
  window.addEventListener('resize', handleResize, {passive: true});
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <u-container class="tabs-section max-w-6xl mx-auto mb-0" v-if="tabs && tabs.length">
    <page-header
        :title="title"
        :headline="headline"
        :description="description"
        :isCentered="true"
    />

    <div class="tabs-row">
      <div ref="tabsScroll" class="tabs-scroll">
        <div class="tabs-head">
          <u-tabs
              :items="tabs"
              @update:modelValue="onTabChange"
              :ui="{ trigger: 'tabs__trigger', list: 'tabs__list mt-4', indicator: 'hidden' }"
          >
            <template #default="{ item }">
              {{ t(item.labelKey) }}
            </template>
            <template #content="{ item }">
              <section class="tabs-card">
                <div class="tabs-card__inner">
                  <div class="tabs-card__content">
                    <h3 class="tabs-card__title mb-4 mt-2">
                      {{ t(item.titleKey) }}
                    </h3>
                    <p v-if="item?.textKey" class="tabs-card__description text-white/70">{{ t(item.textKey) }}</p>
                    <ul v-if="item.list" class="flex flex-col tabs-card__list mb-6">
                      <li class="flex items-center gap-2" v-for="(li, idx) in item.list" :key="idx">
                        <u-icon name="i-lucide-fish-symbol" class="text-primary w-4 h-4" />
                        <span>{{ t(li.textKey) }}</span>
                      </li>
                    </ul>
                  </div>
                  <div class="tabs-card__media">
                    <NuxtImg
                        class="tabs-card__img"
                        :src="item.image"
                        :alt="t(item.titleKey)"
                        format="webp"
                        :quality="80"
                        width="487"
                        height="304"
                        sizes="(max-width: 520px) 100vw, 487px"
                        :widths="[320, 400, 487, 640, 974]"
                        loading="lazy"
                        decoding="async"
                    />
                  </div>
                </div>
              </section>
            </template>
          </u-tabs>
          <div class="tabs-line-wrap">
            <div ref="tabLineElement" class="tabs-line"/>
          </div>
        </div>
      </div>
    </div>
  </u-container>
</template>

<style lang="scss">

</style>