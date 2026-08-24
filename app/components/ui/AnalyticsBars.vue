<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartOptions } from "chart.js";
import { Bar } from "vue-chartjs";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
interface BarItem { label: string; value: number; color?: string }
const props = defineProps<{ items: BarItem[] }>();
const data = computed(() => ({ labels: props.items.map((item) => item.label), datasets: [{ data: props.items.map((item) => item.value), backgroundColor: props.items.map((item) => item.color || "#24a7d6"), borderRadius: 5, borderSkipped: false, barThickness: 10 }] }));
const options: ChartOptions<"bar"> = { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(5,10,31,.96)", borderColor: "rgba(85,111,174,.55)", borderWidth: 1 } }, scales: { x: { beginAtZero: true, grid: { color: "rgba(128,149,208,.1)" }, border: { display: false }, ticks: { color: "#8794b7", precision: 0 } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: "#aeb9d8", autoSkip: false } } } };
</script>
<template><div class="analytics-bars"><ClientOnly><Bar :data="data" :options="options" /></ClientOnly></div></template>
<style scoped>.analytics-bars{position:relative;height:205px;min-width:0}</style>
