<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <USelectMenu>.
//
// Supports the API the app actually uses: `items` of objects or plain strings,
// `value-key`/`label-key`, optional search, single or multiple selection. It is
// a listbox built on a native button + popup rather than a native <select>,
// because the call sites rely on multi-select and on rendering a custom label.
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: unknown;
  items?: any[];
  valueKey?: string;
  labelKey?: string;
  placeholder?: string;
  /**
   * Floating label, matching UInput's and USelect's. Always in its raised
   * position: the trigger shows a selection or a placeholder, so there is never
   * an empty field for the label to rest in.
   */
  label?: string;
  searchInput?: boolean | Record<string, unknown>;
  multiple?: boolean;
  disabled?: boolean;
  ui?: unknown;
}>(), {
  items: () => [],
  labelKey: "label",
  searchInput: true,
});

const emit = defineEmits<{ (e: "update:modelValue", value: unknown): void }>();

const open = ref(false);
const search = ref("");
const root = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);
const activeIndex = ref(0);

const searchable = computed(() => props.searchInput !== false && (props.items?.length ?? 0) > 7);

function valueOf(item: any) {
  if (item == null || typeof item !== "object") return item;
  return props.valueKey ? item[props.valueKey] : item;
}
function labelOf(item: any) {
  if (item == null) return "";
  if (typeof item !== "object") return String(item);
  return String(item[props.labelKey] ?? item.label ?? valueOf(item) ?? "");
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return props.items || [];
  return (props.items || []).filter((item) => labelOf(item).toLowerCase().includes(term));
});

const selectedValues = computed<unknown[]>(() =>
  props.multiple ? (Array.isArray(props.modelValue) ? props.modelValue : []) : [props.modelValue],
);

function isSelected(item: any) {
  return selectedValues.value.some((value) => value === valueOf(item));
}

// The trigger shows the selected label(s); an unmatched value still prints, so
// a stale selection never renders as an empty control.
const triggerLabel = computed(() => {
  const items = props.items || [];
  const labels = selectedValues.value
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => {
      const match = items.find((item) => valueOf(item) === value);
      return match ? labelOf(match) : String(value);
    });
  return labels.join(", ");
});

function choose(item: any) {
  const value = valueOf(item);
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    const at = current.indexOf(value);
    if (at >= 0) current.splice(at, 1);
    else current.push(value);
    emit("update:modelValue", current);
    return;
  }
  emit("update:modelValue", value);
  close();
}

async function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (!open.value) return;
  search.value = "";
  activeIndex.value = Math.max(0, filtered.value.findIndex(isSelected));
  await nextTick();
  searchEl.value?.focus();
}

function close() {
  open.value = false;
  search.value = "";
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      void toggle();
    }
    return;
  }
  if (event.key === "Escape") { close(); return; }
  if (event.key === "ArrowDown") { event.preventDefault(); activeIndex.value = Math.min(activeIndex.value + 1, filtered.value.length - 1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); activeIndex.value = Math.max(activeIndex.value - 1, 0); }
  else if (event.key === "Enter") {
    event.preventDefault();
    const item = filtered.value[activeIndex.value];
    if (item !== undefined) choose(item);
  }
}

function onDocumentPointer(event: PointerEvent) {
  if (!open.value) return;
  const target = event.target as Node;
  // The popup is teleported out of `root`, so it has to be checked separately —
  // otherwise clicking an option would count as an outside click and close the
  // menu before the option could be chosen.
  if (root.value?.contains(target) || popupEl.value?.contains(target)) return;
  close();
}

// The popup lives on <body> rather than beside the trigger. Any ancestor with
// `overflow: hidden` — the advanced filter card, a modal body, a scroll area —
// would otherwise clip it, and there is no way for a component to know which of
// its ancestors does that. Being on <body> it has to be positioned by hand.
const popupEl = ref<HTMLElement | null>(null);
const popupStyle = ref<Record<string, string>>({});

const POPUP_GAP = 4;
const POPUP_MAX_H = 300;

function updatePosition() {
  const trigger = root.value?.firstElementChild as HTMLElement | undefined;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - POPUP_GAP;
  const above = rect.top - POPUP_GAP;
  // Flip above the trigger only when that genuinely gives more room, so a menu
  // near the bottom of the window stays usable instead of being squeezed.
  const flip = below < Math.min(POPUP_MAX_H, 200) && above > below;
  popupStyle.value = {
    position: "fixed",
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${Math.max(140, Math.min(POPUP_MAX_H, flip ? above : below))}px`,
    ...(flip
      ? { bottom: `${window.innerHeight - rect.top + POPUP_GAP}px` }
      : { top: `${rect.bottom + POPUP_GAP}px` }),
  };
}

watch(open, async (isOpen) => {
  if (import.meta.server) return;
  if (isOpen) {
    updatePosition();
    await nextTick();
    updatePosition(); // again once the popup has a size, in case it has to flip
    document.addEventListener("pointerdown", onDocumentPointer);
    // Capture phase: the trigger may sit inside a scrolling panel, whose scroll
    // events do not bubble to window.
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
  } else {
    document.removeEventListener("pointerdown", onDocumentPointer);
    window.removeEventListener("scroll", updatePosition, true);
    window.removeEventListener("resize", updatePosition);
  }
});
onBeforeUnmount(() => {
  if (import.meta.server) return;
  document.removeEventListener("pointerdown", onDocumentPointer);
  window.removeEventListener("scroll", updatePosition, true);
  window.removeEventListener("resize", updatePosition);
});
</script>

<template>
  <div ref="root" class="u-select-menu" :class="[{ 'u-select-menu_floating': label }, $attrs.class]">
    <button
        type="button"
        class="u-select-menu__trigger ui-control ui-focusable"
        :class="{ 'ui-control_floating': label }"
        :disabled="disabled"
        :aria-expanded="open"
        aria-haspopup="listbox"
        :aria-label="label || undefined"
        @click="toggle"
        @keydown="onKeydown"
    >
      <span class="u-select-menu__value" :class="{ 'u-select-menu__value_empty': !triggerLabel }">
        {{ triggerLabel || placeholder || "" }}
      </span>
      <UIcon name="i-lucide-chevron-down" class="u-select-menu__chevron" :class="{ 'u-select-menu__chevron_open': open }" />
    </button>

    <!-- Same floating label as UInput and USelect, so a filter row does not mix
         captions above the control with labels on its border. Always raised:
         a trigger shows either a selection or its placeholder, never nothing. -->
    <template v-if="label">
      <span class="u-select-menu__label" aria-hidden="true">{{ label }}</span>
      <fieldset class="u-select-menu__outline" aria-hidden="true">
        <legend class="u-select-menu__notch"><span>{{ label }}</span></legend>
      </fieldset>
    </template>

    <Teleport to="body">
    <div
      v-if="open"
      ref="popupEl"
      class="u-select-menu__popup"
      role="listbox"
      :aria-multiselectable="multiple ? 'true' : undefined"
      :style="popupStyle"
    >
      <input
          v-if="searchable"
          ref="searchEl"
          v-model="search"
          class="u-select-menu__search"
          type="text"
          autocomplete="off"
          @keydown="onKeydown"
      />
      <ul class="u-select-menu__list">
        <li v-if="!filtered.length" class="u-select-menu__empty">—</li>
        <li
            v-for="(item, index) in filtered"
            :key="String(valueOf(item)) + index"
            role="option"
            :aria-selected="isSelected(item)"
            class="u-select-menu__option"
            :class="{ 'u-select-menu__option_active': index === activeIndex, 'u-select-menu__option_selected': isSelected(item) }"
            @mouseenter="activeIndex = index"
            @click="choose(item)"
        >
          <span
            class="u-select-menu__choice"
            :class="[
              multiple ? 'u-select-menu__choice_checkbox' : 'u-select-menu__choice_radio',
              { 'u-select-menu__choice_selected': isSelected(item) },
            ]"
            aria-hidden="true"
          >
            <UIcon v-if="multiple && isSelected(item)" name="i-lucide-check" class="u-select-menu__check" />
            <span v-else-if="!multiple && isSelected(item)" class="u-select-menu__radio-dot" />
          </span>
          <span class="u-select-menu__option-label">{{ labelOf(item) }}</span>
        </li>
      </ul>
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
.u-select-menu { position: relative; min-width: 0; }

/* Base surface comes from .ui-control. */
.u-select-menu__trigger { text-align: left; cursor: pointer; }

/* One line + ellipsis: a multi-value selection must never grow the row. */
.u-select-menu__value {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.u-select-menu__value_empty { color: var(--ui-control-placeholder); }

.u-select-menu__chevron {
  flex: none;
  font-size: 1em;
  color: var(--ui-control-placeholder);
  transition: transform var(--ui-transition);
}
.u-select-menu__chevron_open { transform: rotate(180deg); }

/* ---- Floating label -------------------------------------------------------
   Mirrors USelect's: always raised, since the trigger is never empty. The
   button carries the accessible name via aria-label, so this text is decorative
   and hidden from the accessibility tree rather than announced twice. */

.u-select-menu_floating .u-select-menu__trigger { border-color: transparent; }

.u-select-menu__label {
  position: absolute;
  /* Plus the trigger's own border, so the label lines up with the value under
     it exactly as UInput's does. */
  left: calc(var(--ui-control-px) + 1px);
  top: 0;
  transform: translateY(-50%) scale(var(--ui-floating-scale));
  transform-origin: left center;
  max-width: calc(100% - var(--ui-control-px) * 2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-control-placeholder);
  font-size: var(--ui-control-font);
  line-height: 1.2;
  pointer-events: none;
  transition: color var(--ui-transition);
}
.u-select-menu_floating:focus-within .u-select-menu__label { color: var(--accent-pink, #e0679a); }

.u-select-menu__outline {
  position: absolute;
  /* Half the legend above the box: a fieldset paints its top border through the
     middle of its legend, not at the edge. */
  top: calc(var(--ui-notch-h) / -2);
  right: 0;
  bottom: 0;
  left: 0;
  margin: 0;
  padding: 0 calc(var(--ui-control-px) - 5px);
  border: 1px solid var(--ui-control-border);
  border-radius: var(--ui-control-radius);
  min-inline-size: 0;
  pointer-events: none;
  transition: border-color var(--ui-transition);
}
/* Focus shows on the outline; the shared ring would sit outside it and read as
   a second border. */
.u-select-menu_floating:focus-within { box-shadow: none; }
.u-select-menu_floating:focus-within .u-select-menu__outline {
  border-width: 2px;
  border-color: var(--accent-pink, #e0679a);
}

.u-select-menu__notch {
  padding: 0 5px;
  font-size: calc(var(--ui-control-font) * var(--ui-floating-scale));
  height: var(--ui-notch-h);
  line-height: var(--ui-notch-h);
  white-space: nowrap;
  visibility: hidden;
}

.u-select-menu__popup {
  /* Position comes from `popupStyle` — the popup is on <body>, not beside the
     trigger. Above the modal's 1000 so a select inside a dialog still opens. */
  position: fixed;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 5px;
  border: 1px solid var(--ui-control-border);
  border-radius: var(--ui-control-radius);
  background: var(--bg-panel, #131730);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
}

.u-select-menu__search {
  flex: none;
  width: 100%;
  margin-bottom: 5px;
  padding: 6px 8px;
  border: 1px solid var(--ui-control-border);
  border-radius: 6px;
  background: var(--ui-control-bg);
  color: inherit;
  font-family: inherit;
  font-size: 12.5px;
  outline: none;
}

.u-select-menu__list {
  /* The popup's own max-height is measured against the real space beside the
     trigger; the list just takes what is left of it and scrolls. */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0;
  padding: 0;
  list-style: none;
}

.u-select-menu__option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: var(--ui-control-font);
  cursor: pointer;
}
.u-select-menu__option_active { background: rgba(255, 255, 255, 0.07); }
.u-select-menu__option_selected { color: var(--accent-pink, #e0679a); }
.u-select-menu__choice {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border: 1px solid var(--ui-control-border);
  color: var(--accent-pink, #e0679a);
}
.u-select-menu__choice_radio { border-radius: 50%; }
.u-select-menu__choice_checkbox { border-radius: 4px; }
.u-select-menu__choice_selected { border-color: var(--accent-pink, #e0679a); }
.u-select-menu__radio-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.u-select-menu__option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.u-select-menu__check { flex: none; font-size: 0.85em; }
.u-select-menu__empty { padding: 8px; color: var(--ui-control-placeholder); font-size: 12.5px; text-align: center; }
</style>
