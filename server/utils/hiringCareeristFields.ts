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

/** Careerist listings put the desired role immediately after their date. */
export function careeristRoleFromText(text: string): string | null {
  const lines = trimCareeristProfileText(text).split('\n').map((line) => line.trim()).filter(Boolean)
  const date = lines.findIndex((line) => /^\d{1,2}\s+\p{L}+,\s+20\d{2}$/iu.test(line))
  const role = date >= 0 ? lines[date + 1] : undefined
  if (!role || role.length > 180 || /^(?:город|возраст|опыт работы)$/iu.test(role)) return null
  return role
}
