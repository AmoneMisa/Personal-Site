<script setup lang="ts">
import { CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions } from "chart.js";
import { Line } from "vue-chartjs";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);
interface LineSeries { label: string; color: string; values: Array<number | null> }
const props = withDefaults(defineProps<{ series: LineSeries[]; labels: string[]; format?: (value: number) => string }>(), { format: (value: number) => Math.round(value).toLocaleString() });
const data = computed(() => ({ labels: props.labels, datasets: props.series.map((series) => ({ label: series.label, data: series.values, borderColor: series.color, backgroundColor: `${series.color}22`, pointBackgroundColor: series.color, pointBorderColor: "#07102c", pointHoverRadius: 5, pointRadius: 3, borderWidth: 2.5, tension: .32, spanGaps: false, fill: props.series.length === 1 })) }));
const options = computed<ChartOptions<"line">>(() => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: props.series.length > 1, labels: { color: "#aeb9d8", usePointStyle: true, boxWidth: 8, boxHeight: 8 } }, tooltip: { backgroundColor: "rgba(5,10,31,.96)", borderColor: "rgba(85,111,174,.55)", borderWidth: 1, callbacks: { label: (context) => `${context.dataset.label}: ${props.format(Number(context.parsed.y || 0))}` } } }, scales: { x: { grid: { color: "rgba(128,149,208,.08)" }, border: { color: "rgba(128,149,208,.2)" }, ticks: { color: "#8794b7", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { beginAtZero: true, grid: { color: "rgba(128,149,208,.13)" }, border: { display: false }, ticks: { color: "#8794b7", callback: (value) => props.format(Number(value)) } } } }));
</script>
<template><div class="analytics-line"><ClientOnly><Line :data="data" :options="options" /></ClientOnly></div></template>
<style scoped>.analytics-line{position:relative;min-width:0;height:220px}@media(max-width:620px){.analytics-line{height:185px}}</style>
