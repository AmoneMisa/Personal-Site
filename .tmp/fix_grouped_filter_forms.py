from pathlib import Path
for path in [Path('app/pages/jobs/index.vue'), Path('app/pages/hiring/index.vue')]:
    text = path.read_text(encoding='utf-8')
    marker = '      </div>\n\n\n    <p'
    if marker not in text:
        raise RuntimeError(f'{path}: grouped form marker not found')
    text = text.replace(marker, '      </div>\n    </form>\n\n    <p', 1)
    path.write_text(text, encoding='utf-8')
