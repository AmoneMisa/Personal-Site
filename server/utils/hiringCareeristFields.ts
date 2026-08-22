/** Removes listing pagination and legacy inline JavaScript after the last CV. */
export function trimCareeristProfileText(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const boundary = lines.findIndex((line) => (
    /^Показать еще$/iu.test(line)
    || /^<!--/u.test(line)
    || /^\$\s*\(\s*document\s*\)/iu.test(line)
    || /^window\./iu.test(line)
  ))
  return lines.slice(0, boundary >= 0 ? boundary : undefined).join('\n').trim()
}
