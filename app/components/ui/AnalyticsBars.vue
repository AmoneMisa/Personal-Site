<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartOptions } from "chart.js";
import { Bar } from "vue-chartjs";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface BarItem {
  label: string;
  value?: number;
  min?: number;
  max?: number;
  color?: string;
}

const props = withDefaults(defineProps<{
  items: BarItem[];
  format?: (value: number) => string;
}>(), {
  format: (value: number) => Math.round(value).toLocaleString(),
});

const hasRanges = computed(() => props.items.some((item) => Number.isFinite(item.min) && Number.isFinite(item.max)));

const data = computed(() => ({
  labels: props.items.map((item) => item.label),
  datasets: [{
    data: props.items.map((item) => {
      if (Number.isFinite(item.min) && Number.isFinite(item.max)) return [Number(item.min), Number(item.max)];
      return Number(item.value || 0);
    }),
    backgroundColor: props.items.map((item) => item.color || "#24a7d6"),
    borderRadius: 5,
    borderSkipped: false,
    barThickness: 10,
  }],
}));

const options = computed<ChartOptions<"bar">>(() => ({
  indexAxis: "y",
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(5,10,31,.96)",
      borderColor: "rgba(85,111,174,.55)",
      borderWidth: 1,
      callbacks: {
        label: (context) => {
          const raw = context.raw as number | [number, number];
          if (Array.isArray(raw)) return `${context.label}: ${props.format(Number(raw[0]))} — ${props.format(Number(raw[1]))}`;
          return `${context.label}: ${props.format(Number(context.parsed.x || 0))}`;
        },
      },
    },
  },
  scales: {
    x: {
      beginAtZero: !hasRanges.value,
      grid: { color: "rgba(128,149,208,.1)" },
      border: { display: false },
      ticks: {
        color: "#8794b7",
        precision: 0,
        callback: (value) => props.format(Number(value)),
      },
    },
    y: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: "#aeb9d8", autoSkip: false },
    },
  },
}));
</script>

<template>
  <div class="analytics-bars">
    <ClientOnly><Bar :data="data" :options="options" /></ClientOnly>
  </div>
</template>

<style scoped>
.analytics-bars { position: relative; height: 205px; min-width: 0; }
</style>
