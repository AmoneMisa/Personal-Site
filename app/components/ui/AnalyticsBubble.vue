<script setup lang="ts">
import { BubbleController, Chart as ChartJS, Legend, LinearScale, PointElement, Tooltip, type ChartOptions } from "chart.js";
import { Bubble } from "vue-chartjs";

ChartJS.register(BubbleController, LinearScale, PointElement, Tooltip, Legend);

interface BubblePoint {
  x: number;
  y: number;
  count: number;
}

interface BubbleSeries {
  label: string;
  color: string;
  points: BubblePoint[];
}

interface BubbleDatum extends BubblePoint {
  r: number;
}

const props = withDefaults(defineProps<{
  series: BubbleSeries[];
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  xLabel?: string;
  yLabel?: string;
  countLabel?: string;
}>(), {
  formatX: (value: number) => Math.round(value).toLocaleString(),
  formatY: (value: number) => String(value),
  xLabel: "",
  yLabel: "",
  countLabel: "Count",
});

const data = computed(() => ({
  datasets: props.series.map((series) => ({
    label: series.label,
    data: series.points.map((point): BubbleDatum => ({
      ...point,
      r: Math.min(22, 4 + Math.sqrt(point.count) * 3.2),
    })),
    backgroundColor: `${series.color}88`,
    borderColor: series.color,
    borderWidth: 1.5,
    hoverBorderWidth: 2,
  })),
}));

const options = computed<ChartOptions<"bubble">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "nearest", intersect: true },
  plugins: {
    legend: {
      display: true,
      position: "bottom",
      labels: { color: "#aeb9d8", usePointStyle: true, boxWidth: 8, boxHeight: 8 },
    },
    tooltip: {
      backgroundColor: "rgba(5,10,31,.96)",
      borderColor: "rgba(85,111,174,.55)",
      borderWidth: 1,
      callbacks: {
        label: (context) => {
          const raw = context.raw as BubbleDatum;
          return [
            `${context.dataset.label}`,
            `${props.xLabel}: ${props.formatX(raw.x)}`,
            `${props.yLabel}: ${props.formatY(raw.y)}`,
            `${props.countLabel}: ${raw.count}`,
          ];
        },
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      title: { display: Boolean(props.xLabel), text: props.xLabel, color: "#aeb9d8" },
      grid: { color: "rgba(128,149,208,.1)" },
      border: { display: false },
      ticks: { color: "#8794b7", callback: (value) => props.formatX(Number(value)) },
    },
    y: {
      beginAtZero: true,
      title: { display: Boolean(props.yLabel), text: props.yLabel, color: "#aeb9d8" },
      grid: { color: "rgba(128,149,208,.1)" },
      border: { display: false },
      ticks: { color: "#8794b7", precision: 0, callback: (value) => props.formatY(Number(value)) },
    },
  },
}));
</script>

<template>
  <div class="analytics-bubble">
    <ClientOnly><Bubble :data="data" :options="options" /></ClientOnly>
  </div>
</template>

<style scoped>
.analytics-bubble { position: relative; min-width: 0; height: 340px; }
@media (max-width: 620px) { .analytics-bubble { height: 280px; } }
</style>
