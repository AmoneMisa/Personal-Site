export interface RelativeDateLabels {
  today: () => string;
  yesterday: () => string;
  daysAgo: (days: number) => string;
  monthsAgo: (months: number) => string;
}

export function formatRelativeDate(value: string | Date | null | undefined, labels: RelativeDateLabels): string {
  if (!value) return "";
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return labels.today();
  if (days === 1) return labels.yesterday();
  if (days < 30) return labels.daysAgo(days);
  return labels.monthsAgo(Math.floor(days / 30));
}
