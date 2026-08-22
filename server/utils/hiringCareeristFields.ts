/** Removes listing pagination and legacy inline JavaScript after the last CV. */
export function trimCareeristProfileText(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const boundary = lines.findIndex((line) => (
    /^Показать еще$/iu.test(line)
    || /^<!--/u.test(line)
    || /^\$\s*\(\s*document\s*\)/iu.test(line)
    || /^window\./iu.test(line)
  ))
  const profileLines = lines.slice(0, boundary >= 0 ? boundary : undefined)
  const clean: string[] = []
  let keptDate = false
  for (let index = 0; index < profileLines.length; index += 1) {
    const line = profileLines[index]!
    if (/^(?:отправить приглашение|подробнее)$/iu.test(line)) continue
    if (/^\d{1,2}\s+\p{L}+,\s+20\d{2}$/iu.test(line)) {
      if (keptDate) continue
      keptDate = true
    }
    if (/^возраст$/iu.test(line) && /^0(?:\s|\()/u.test(profileLines[index + 1] || '')) {
      index += 1
      continue
    }
    clean.push(line)
  }
  return clean.join('\n').trim()
}

/** Careerist listings put the desired role immediately after their date. */
export function careeristRoleFromText(text: string): string | null {
  const lines = trimCareeristProfileText(text).split('\n').map((line) => line.trim()).filter(Boolean)
  const date = lines.findIndex((line) => /^\d{1,2}\s+\p{L}+,\s+20\d{2}$/iu.test(line))
  const role = date >= 0 ? lines[date + 1] : undefined
  if (!role || role.length > 180 || /^(?:город|возраст|опыт работы)$/iu.test(role)) return null
  return role
}
