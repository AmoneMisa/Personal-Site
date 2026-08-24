<script setup lang="ts">
import { ArcElement, Chart as ChartJS, Legend, Tooltip, type ChartOptions } from "chart.js";
import { Doughnut } from "vue-chartjs";
ChartJS.register(ArcElement, Tooltip, Legend);
interface DonutItem { label: string; value: number; color: string }
const props = defineProps<{ items: DonutItem[]; centerLabel?: string }>();
const data = computed(() => ({ labels: props.items.map((item) => item.label), datasets: [{ data: props.items.map((item) => item.value), backgroundColor: props.items.map((item) => item.color), borderColor: "#0c1230", borderWidth: 3, hoverOffset: 5 }] }));
const options = computed<ChartOptions<"doughnut">>(() => ({ responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { position: "right", labels: { color: "#aeb9d8", usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 13 } }, tooltip: { backgroundColor: "rgba(5,10,31,.96)", borderColor: "rgba(85,111,174,.55)", borderWidth: 1, callbacks: { label: (context) => `${context.label}: ${context.formattedValue} ${props.centerLabel || ""}`.trim() } } } }));
</script>
<template><div class="analytics-donut"><ClientOnly><Doughnut :data="data" :options="options" /></ClientOnly></div></template>
<style scoped>.analytics-donut{position:relative;height:205px;min-width:0}@media(max-width:420px){.analytics-donut{height:230px}}</style>
