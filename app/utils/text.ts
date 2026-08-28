/** Capitalizes only the first letter of a string, leaving the rest untouched.
 * Used for display-only presentation of free-text fields (flat/candidate/job
 * descriptions) where the source may start with a lowercase letter. */
export function capitalizeFirst(value: string | null | undefined): string {
  const text = String(value ?? '')
  const match = text.match(/\p{L}/u)
  if (!match || match.index == null) return text
  const index = match.index
  return text.slice(0, index) + text.charAt(index).toLocaleUpperCase() + text.slice(index + 1)
}
