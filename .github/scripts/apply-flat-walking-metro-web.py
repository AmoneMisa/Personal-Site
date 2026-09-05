from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement target, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


types = "app/types/flats.ts"
replace_once(
    types,
    """  distanceM: number;\n  routeRefs: string[];\n""",
    """  distanceM: number;\n  walkingDistanceM?: number | null;\n  walkingDurationMin?: number | null;\n  routeRefs: string[];\n""",
)
replace_once(
    types,
    """  source?: string | null;\n}\n\nexport interface FlatPerPersonPrice""",
    """  source?: string | null;\n  walkingSource?: string | null;\n}\n\nexport interface FlatPerPersonPrice""",
)
replace_once(
    types,
    """  metro?: string | null;\n  nearbyMetro?: FlatTransportStop[];\n""",
    """  metro?: string | null;\n  metroWalkingDistanceM?: number | null;\n  metroWalkingDurationMin?: number | null;\n  nearbyMetro?: FlatTransportStop[];\n""",
)

page = "app/pages/flat-finder/index.vue"
replace_once(
    page,
    """const amenitiesListOr = (values?: string[] | null) => values?.length ? values.map(nearbyItemLabel).join(\", \") : t(\"notSpecified\");\nconst transportListOr = (listing: Listing, mode: string) => {\n""",
    """const amenitiesListOr = (values?: string[] | null) => values?.length ? values.map(nearbyItemLabel).join(\", \") : t(\"notSpecified\");\nconst walkingDistanceLabel = (meters: number) => {\n  if (meters < 1000) return `${Math.round(meters)} ${String(locale.value).startsWith(\"ru\") ? \"м\" : \"m\"}`;\n  const km = meters / 1000;\n  const value = Number.isInteger(km) ? km.toFixed(0) : km.toFixed(1);\n  return `${value} ${String(locale.value).startsWith(\"ru\") ? \"км\" : \"km\"}`;\n};\nconst metroSpecValue = (listing: Listing) => {\n  const name = metroLabelWithAlias(listing.metro, locale.value);\n  if (!name) return t(\"notSpecified\");\n  const distance = listing.metroWalkingDistanceM;\n  if (distance == null) return name;\n  const parts = [name, `🚶 ${walkingDistanceLabel(distance)}`];\n  if (listing.metroWalkingDurationMin != null) {\n    parts.push(`${Math.round(listing.metroWalkingDurationMin)} ${String(locale.value).startsWith(\"ru\") ? \"мин\" : \"min\"}`);\n  }\n  return parts.join(\" · \");\n};\nconst transportListOr = (listing: Listing, mode: string) => {\n""",
)
replace_once(
    page,
    """    return `${stop.name}${routes} · ${Math.round(stop.distanceM)} m`;\n""",
    """    if (stop.walkingDistanceM != null) {\n      const minutes = stop.walkingDurationMin == null\n        ? \"\"\n        : ` · ${Math.round(stop.walkingDurationMin)} ${String(locale.value).startsWith(\"ru\") ? \"мин\" : \"min\"}`;\n      return `${stop.name}${routes} · 🚶 ${walkingDistanceLabel(stop.walkingDistanceM)}${minutes}`;\n    }\n    return `${stop.name}${routes} · ${Math.round(stop.distanceM)} m`;\n""",
)
replace_once(
    page,
    """    row(\"location\", t(\"specMetro\"), strOr(metroLabelWithAlias(l.metro, locale.value))),\n""",
    """    row(\"location\", t(\"specMetro\"), metroSpecValue(l)),\n""",
)

print("Flat Finder web walking-metro patch applied.")
