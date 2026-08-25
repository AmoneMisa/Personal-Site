<script setup lang="ts">
import { CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions } from "chart.js";
import { Line } from "vue-chartjs";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface LineSeries {
  label: string;
  color: string;
  values: Array<number | null>;
}

const props = withDefaults(defineProps<{
  series: LineSeries[];
  labels: string[];
  format?: (value: number) => string;
  surface?: boolean;
}>(), {
  format: (value: number) => Math.round(value).toLocaleString(),
  surface: false,
});

const data = computed(() => ({
  labels: props.labels,
  datasets: props.series.map((series) => ({
    label: series.label,
    data: series.values,
    borderColor: series.color,
    backgroundColor: `${series.color}22`,
    pointBackgroundColor: series.color,
    pointBorderColor: "#07102c",
    pointHoverRadius: 5,
    pointRadius: 3,
    borderWidth: 2.5,
    tension: 0.32,
    spanGaps: false,
    fill: props.series.length === 1,
  })),
}));

const options = computed<ChartOptions<"line">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  layout: { padding: { top: 4, right: 4, bottom: 0, left: 0 } },
  plugins: {
    legend: {
      display: props.series.length > 1,
      labels: { color: "#aeb9d8", usePointStyle: true, boxWidth: 8, boxHeight: 8 },
    },
    tooltip: {
      backgroundColor: "rgba(5,10,31,.96)",
      borderColor: "rgba(85,111,174,.55)",
      borderWidth: 1,
      callbacks: {
        label: (context) => `${context.dataset.label}: ${props.format(Number(context.parsed.y || 0))}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(128,149,208,.08)" },
      border: { color: "rgba(128,149,208,.2)" },
      ticks: { color: "#8794b7", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(128,149,208,.13)" },
      border: { display: false },
      ticks: { color: "#8794b7", callback: (value) => props.format(Number(value)) },
    },
  },
}));
</script>

<template>
  <div class="analytics-line" :class="{ 'analytics-line_surface': surface }">
    <ClientOnly>
      <Line :data="data" :options="options" />
    </ClientOnly>
  </div>
</template>

<style scoped>
.analytics-line {
  position: relative;
  min-width: 0;
  height: 220px;
}
.analytics-line_surface {
  height: 248px;
  padding: 12px 12px 8px;
  border: 1px solid rgba(85, 111, 174, 0.28);
  border-radius: 11px;
  background: linear-gradient(180deg, rgba(5, 10, 31, 0.52), rgba(9, 15, 43, 0.28));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}
@media (max-width: 620px) {
  .analytics-line {
    height: 185px;
  }
  .analytics-line_surface {
    height: 220px;
    padding: 10px 8px 6px;
  }
}
</style>
