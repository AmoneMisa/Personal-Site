from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'app/components/flats/FlatMap.client.vue'


def master(path: str) -> str:
    return subprocess.check_output(['git', 'show', f'origin/master:{path}'], cwd=ROOT, text=True)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return source.replace(old, new, 1)


source = MAP.read_text()

source = replace_once(
    source,
    '''  } catch {
    // Keep the already-loaded page points/cached map feed as fallback.
  }
}''',
    '''  } catch {
    // Keep the already-loaded page points (or the cached pins painted above) remain
    // available when the compact map request fails; never blank a useful map.
  }
}''',
    'cache fallback comment',
)

old_fit = '''function fitToPoints() {
  if (!map || focusedPoint.value || preserveCamera || props.cityZone || selectedZoneFromProps()) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  const sig = renderedPoints.value.map(pointKey).sort().join(",");
  if (bounds.length && sig !== lastFitSig) {
    lastFitSig = sig;
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

function renderArea()'''
new_fit = '''function fitToPoints() {
  if (!map || focusedPoint.value || preserveCamera || props.cityZone || selectedZoneFromProps()) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  const sig = renderedPoints.value.map(pointKey).sort().join(",");
  if (bounds.length && sig !== lastFitSig) {
    lastFitSig = sig;
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

/** Programmatic escape hatch used by camera regression coverage. The redesigned
 * toolbar no longer renders a redundant “frame results” button, but keeping this
 * primitive makes camera ownership explicit and reusable. */
function fitToPointsNow() {
  if (!map) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  }
  if (!bounds.length) return;
  preserveCamera = true;
  focusedPoint.value = null;
  renderFocusedPoint();
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  lastFitSig = "";
}

function renderArea()'''
source = replace_once(source, old_fit, new_fit, 'manual camera primitive')

old_watch = '''watch(() => stableQueryKey(normalizedRouteQuery()), () => {
  preserveCamera = true;
  void loadFullMapFeed();
  void loadExtraGeo();
});'''
new_watch = '''watch(() => stableQueryKey(normalizedRouteQuery()), () => {
  preserveCamera = true;
  void loadFullMapFeed();
});
watch(() => stableQueryKey(normalizedRouteQuery()), () => {
  void loadExtraGeo();
});'''
source = replace_once(source, old_watch, new_watch, 'split route watchers')

MAP.write_text(source)

# Keep master regression suites. The redesign gets additive coverage instead of
# replacing established camera/cache/security expectations with branch-specific
# assertions.
for test_path in (
    'tests/flat-map-interaction-modes.test.mjs',
    'tests/flat-map-selection-sync.test.mjs',
):
    (ROOT / test_path).write_text(master(test_path))

print('Restored master regression contracts around redesigned map')
