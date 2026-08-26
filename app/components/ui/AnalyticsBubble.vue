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
  trimExtremeX?: boolean;
}>(), {
  formatX: (value: number) => Math.round(value).toLocaleString(),
  formatY: (value: number) => String(value),
  xLabel: "",
  yLabel: "",
  countLabel: "Count",
  trimExtremeX: true,
});

function quantile(sorted: number[], ratio: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0] ?? 0;
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

/* A single malformed salary can otherwise stretch a linear axis into tens of
   millions and collapse every real point against zero. Use a deliberately loose
   Tukey fence (3× IQR) and only trim when the largest value is clearly beyond
   it. This keeps genuine country/role salary spread while rejecting parser or
   period-conversion outliers from the visualization. */
const extremeXUpperBound = computed<number | undefined>(() => {
  if (!props.trimExtremeX) return undefined;
  const values = props.series
    .flatMap((series) => series.points.map((point) => point.x))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  if (values.length < 4) return undefined;

  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  if (!(iqr > 0)) return undefined;

  const fence = q3 + iqr * 3;
  const max = values[values.length - 1] ?? 0;
  return max > fence ? fence : undefined;
});

const chartSeries = computed(() => {
  const upperBound = extremeXUpperBound.value;
  if (upperBound === undefined) return props.series;
  const filtered = props.series
    .map((series) => ({
      ...series,
      points: series.points.filter((point) => point.x <= upperBound),
    }))
    .filter((series) => series.points.length > 0);
  return filtered.length ? filtered : props.series;
});

const data = computed(() => ({
  datasets: chartSeries.value.map((series) => ({
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
      grace: "6%",
      title: { display: Boolean(props.xLabel), text: props.xLabel, color: "#aeb9d8" },
      grid: { color: "rgba(128,149,208,.1)" },
      border: { display: false },
      ticks: {
        color: "#8794b7",
        autoSkip: true,
        maxTicksLimit: 7,
        callback: (value) => props.formatX(Number(value)),
      },
    },
    y: {
      beginAtZero: true,
      grace: "4%",
      title: { display: Boolean(props.yLabel), text: props.yLabel, color: "#aeb9d8" },
      grid: { color: "rgba(128,149,208,.1)" },
      border: { display: false },
      ticks: {
        color: "#8794b7",
        precision: 0,
        autoSkip: true,
        maxTicksLimit: 7,
        callback: (value) => props.formatY(Number(value)),
      },
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
