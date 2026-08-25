from pathlib import Path

path = Path('server/utils/hiringNormalize.ts')
text = path.read_text()
needle = 'function collectProfessions(source: string): string[] {'
positions = []
start = 0
while True:
    pos = text.find(needle, start)
    if pos < 0:
        break
    positions.append(pos)
    start = pos + len(needle)

if len(positions) > 1:
    second = positions[1]
    end = text.find('export function detectMentionedProfessions', second)
    if end < 0:
        raise SystemExit('detectMentionedProfessions anchor not found')
    text = text[:second] + text[end:]

for stale in ['PROFESSION_RULES', 'SPECIFIC_MANAGER_ROLES', 'SPECIFIC_DEVELOPER_ROLES', 'SPECIFIC_TECH_ROLES']:
    if stale in text:
        raise SystemExit(f'stale profession symbol remains: {stale}')

path.write_text(text)
