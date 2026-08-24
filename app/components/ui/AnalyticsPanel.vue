<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string;
  collapseLabel: string;
  expandLabel: string;
  defaultExpanded?: boolean;
}>(), { defaultExpanded: true });
const expanded = ref(props.defaultExpanded);
</script>

<template>
  <section class="analytics-panel">
    <header class="analytics-panel__head">
      <button type="button" class="analytics-panel__title" :aria-expanded="expanded" @click="expanded = !expanded">
        <u-icon name="i-lucide-chart-no-axes-combined" />
        <span>{{ title }}</span>
      </button>
      <div class="analytics-panel__actions">
        <slot name="controls" :expanded="expanded" />
        <button type="button" class="analytics-panel__toggle" :aria-expanded="expanded" @click="expanded = !expanded">
          <span>{{ expanded ? collapseLabel : expandLabel }}</span>
          <u-icon :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />
        </button>
      </div>
    </header>
    <div v-if="expanded" class="analytics-panel__content"><slot /></div>
  </section>
</template>

<style scoped>
.analytics-panel { margin: 8px 0 24px; overflow: hidden; border: 1px solid rgba(85,111,174,.38); border-radius: 14px; background: linear-gradient(135deg,rgba(5,10,31,.97),rgba(12,18,48,.96) 58%,rgba(39,15,53,.93)); box-shadow:0 18px 45px rgba(0,0,0,.22) }
.analytics-panel__head { min-height: 58px; padding: 10px 14px 10px 18px; display:flex; align-items:center; justify-content:space-between; gap:14px }
.analytics-panel__title,.analytics-panel__toggle { border:0; background:transparent; color:var(--ui-text); cursor:pointer }
.analytics-panel__title { min-width:0; padding:4px 0; display:flex; align-items:center; gap:9px; font-size:17px; font-weight:750; text-align:left }
.analytics-panel__title :deep(svg) { flex:0 0 auto; color:#e0679a; font-size:21px }
.analytics-panel__actions { display:flex; align-items:center; justify-content:flex-end; gap:10px }
.analytics-panel__toggle { min-height:34px; padding:6px 8px; display:flex; align-items:center; gap:6px; color:var(--ui-text-muted); font-size:12px }
.analytics-panel__content { padding:0 16px 16px }
@media(max-width:700px){.analytics-panel__head{align-items:flex-start}.analytics-panel__actions{min-width:0;align-items:flex-end;flex-direction:column-reverse}.analytics-panel__toggle span{display:none}.analytics-panel__content{padding-inline:12px}}
</style>
