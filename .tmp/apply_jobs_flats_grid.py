from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# Vacancies: four responsive columns on wide screens.
replace_once(
    "app/pages/jobs/index.vue",
    """.jobs__grid {\n  display: grid; gap: 12px; grid-template-columns: 1fr; align-items: stretch;\n  grid-auto-rows: 1fr; /* every card the same height across all rows */\n  @media (min-width: 640px) { grid-template-columns: repeat(2, 1fr); }\n  @media (min-width: 1024px) { grid-template-columns: repeat(3, 1fr); }\n}\n""",
    """.jobs__grid {\n  display: grid; gap: 12px; grid-template-columns: 1fr; align-items: stretch;\n  grid-auto-rows: 1fr; /* every card the same height across all rows */\n  @media (min-width: 640px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n  @media (min-width: 1024px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }\n  @media (min-width: 1440px) { grid-template-columns: repeat(4, minmax(0, 1fr)); }\n}\n""",
)

# Vacancies: title always owns the full card width; score/actions live below it.
replace_once(
    "app/pages/jobs/index.vue",
    """.job-card__head {\n  display: grid; grid-template-columns: minmax(0, 1fr) auto;\n  /* Centred, not start-aligned: the action buttons are taller than the title's\n     line box, so a shared top edge left the title text above the icon centres. */\n  align-items: center; column-gap: 10px; row-gap: 4px;\n}\n.job-card__actions {\n  justify-self: end; display: flex; flex-wrap: wrap; justify-content: flex-end;\n  align-items: center; gap: 5px; max-width: 100%;\n}\n""",
    """.job-card__head {\n  display: grid; grid-template-columns: minmax(0, 1fr);\n  align-items: start; row-gap: 8px;\n}\n.job-card__actions {\n  width: 100%; justify-self: stretch; display: flex; flex-wrap: wrap; justify-content: flex-end;\n  align-items: center; gap: 5px; max-width: 100%;\n}\n.job-card__actions .job-card__ats { margin-right: auto; }\n""",
)
replace_once(
    "app/pages/jobs/index.vue",
    """.job-card__title {\n  min-width: 0; overflow-wrap: anywhere;\n  font-weight: 600; font-size: 16px; line-height: 1.35;\n""",
    """.job-card__title {\n  width: 100%; min-width: 0; overflow-wrap: break-word; word-break: normal;\n  font-weight: 600; font-size: 16px; line-height: 1.35;\n""",
)

# Apartments: same 1 → 2 → 3 → 4 responsive grid.
replace_once(
    "app/pages/flat-finder/index.vue",
    """.flats__grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: stretch; grid-auto-rows: 1fr; }\n@media (min-width: 640px) { .flats__grid { grid-template-columns: repeat(2, 1fr); } }\n@media (min-width: 1024px) { .flats__grid { grid-template-columns: repeat(3, 1fr); } }\n""",
    """.flats__grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: stretch; grid-auto-rows: 1fr; }\n@media (min-width: 640px) { .flats__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }\n@media (min-width: 1024px) { .flats__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }\n@media (min-width: 1440px) { .flats__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }\n""",
)
