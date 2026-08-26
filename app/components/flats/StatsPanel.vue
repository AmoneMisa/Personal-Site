const priceBandBars = computed(() => {
  const rows = props.statistics.priceBandsByDeal?.[dealScope.value] || [];
  const byKey = new Map(rows.map((row) => [row.key, row.count]));
  return priceLegend.value.slice().reverse().map((item) => ({
    label: item.label.split(":")[0] || item.label,
    value: byKey.get(item.key) || 0,
    color: item.color,
  }));
});
const priceBandSamples = computed(() => props.statistics.priceBandSamplesByDeal?.[dealScope.value] || 0);
const maxGeoCount = computed(() => Math.max(1, ...geography.value.map((row) => row.count)));
const total = computed(() => Math.max(1, props.statistics.total));
const ownership = computed(() => [
  { key: "owners", label: t("statsOwners"), value: props.statistics.ownership.owners },
  { key: "agencies", label: t("statsAgencies"), value: props.statistics.ownership.agencies },
  { key: "noCommission", label: t("statsNoCommission"), value: props.statistics.ownership.noCommission },
  { key: "commission", label: t("statsCommission"), value: props.statistics.ownership.commission },
]);