<script setup lang="ts">
import CustomButton from "~/components/common/CustomButton.vue";
import FileInput from "~/components/common/FileInput.vue";
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import type {MergeJsonUi} from "~/composables/mergeJson/useMergeJsonState";

const props = defineProps<{ui: MergeJsonUi}>();
const {t} = useI18n();

const viewModeItems = computed(() => [
  {label: t("services.mergeJson.viewModes.json"), value: "json"},
  {label: t("services.mergeJson.viewModes.flat"), value: "flat"},
]);

function onDownload() {
  props.ui.download({filename: t("services.mergeJson.download.filename")});
}
</script>

<template>
  <div class="merge__toolbar">
    <div class="merge__toolbar-row">
      <file-input
          :label-key="'services.mergeJson.inputs.fileA'"
          :hint-key="'services.mergeJson.inputs.hint'"
          :error="ui.errorA"
          :max-bytes="50 * 1024 * 1024"
          :accept="ui.accept"
          @files="ui.onFilesA"
      />
      <file-input
          :label-key="'services.mergeJson.inputs.fileB'"
          :hint-key="'services.mergeJson.inputs.hint'"
          :error="ui.errorB"
          :max-bytes="50 * 1024 * 1024"
          :accept="ui.accept"
          @files="ui.onFilesB"
      />
    </div>

    <div class="merge__toolbar-row">
      <u-select
          v-model="ui.viewMode"
          class="merge__select"
          :items="viewModeItems"
          :title="t('services.mergeJson.titles.viewMode')"
      />
      <custom-checkbox
          v-model="ui.minify"
          :label-key="'services.mergeJson.controls.minify'"
          :title="t('services.mergeJson.titles.minify')"
          @update:modelValue="ui.onMinifyToggle"
      />
      <custom-button
          variant="ghost"
          :_class="'merge__btn'"
          :disabled="!ui.canFix"
          :title="t('services.mergeJson.titles.fixJson')"
          @click="ui.fixCurrent"
      >
        {{ t("services.mergeJson.actions.fixJson") }}
      </custom-button>
    </div>

    <div class="merge__group">
      <div class="merge__group-label">{{ t("services.mergeJson.controls.truth") }}</div>
      <div class="merge__group-row">
        <custom-button
            variant="secondary"
            :_class="`merge__chip ${ui.truth === 'A' ? 'merge__chip_active' : ''}`"
            :title="t('services.mergeJson.titles.truthA')"
            @click="ui.takeAllFrom('A')"
        >
          {{ t("services.mergeJson.controls.truthA") }}
        </custom-button>
        <custom-button
            variant="secondary"
            :_class="`merge__chip ${ui.truth === 'B' ? 'merge__chip_active' : ''}`"
            :title="t('services.mergeJson.titles.truthB')"
            @click="ui.takeAllFrom('B')"
        >
          {{ t("services.mergeJson.controls.truthB") }}
        </custom-button>
      </div>
    </div>

    <div class="merge__group">
      <div class="merge__group-label">{{ t("services.mergeJson.controls.sort") }}</div>
      <div class="merge__group-row">
        <custom-button
            variant="ghost"
            :_class="`merge__chip ${ui.sortMode === 'asc' ? 'merge__chip_active' : ''}`"
            :title="t('services.mergeJson.titles.sortAsc')"
            @click="ui.setSort('asc')"
        >
          {{ t("services.mergeJson.controls.sortAsc") }}
        </custom-button>
        <custom-button
            variant="ghost"
            :_class="`merge__chip ${ui.sortMode === 'desc' ? 'merge__chip_active' : ''}`"
            :title="t('services.mergeJson.titles.sortDesc')"
            @click="ui.setSort('desc')"
        >
          {{ t("services.mergeJson.controls.sortDesc") }}
        </custom-button>
      </div>
    </div>

    <custom-checkbox
        v-model="ui.onlyDiff"
        :label-key="'services.mergeJson.controls.onlyDiff'"
        :title="t('services.mergeJson.titles.onlyDiff')"
    />

    <div class="merge__search-wrap">
      <custom-input
          v-model="ui.query"
          class="merge__search"
          :label-key="'services.mergeJson.controls.search'"
          :placeholder-key="'services.mergeJson.controls.searchPh'"
          :title="t('services.mergeJson.titles.search')"
          clearable
      />
      <div v-if="ui.query.trim()" class="merge__matches">
        {{ ui.matchesCount ? `${ui.matchIndex + 1}/${ui.matchesCount}` : "0" }}
      </div>
    </div>
    <div class="merge__spacer" />

    <custom-button variant="secondary" :_class="'merge__btn'" :disabled="!ui.selectedKey" :title="t('services.mergeJson.titles.useA')" @click="ui.useA">
      {{ t("services.mergeJson.row.useA") }}
    </custom-button>
    <custom-button variant="secondary" :_class="'merge__btn'" :disabled="!ui.selectedKey" :title="t('services.mergeJson.titles.useB')" @click="ui.useB">
      {{ t("services.mergeJson.row.useB") }}
    </custom-button>
    <custom-button variant="ghost" :_class="'merge__btn'" :disabled="!ui.selectedKey" :title="t('services.mergeJson.titles.reset')" @click="ui.resetSelected">
      {{ t("services.mergeJson.row.reset") }}
    </custom-button>
    <custom-button variant="ghost" :_class="'merge__btn'" :title="t('services.mergeJson.titles.addKey')" @click="ui.showAddKey = true">
      {{ t("services.mergeJson.actions.addKey") }}
    </custom-button>
    <custom-button variant="ghost" :_class="'merge__btn'" :disabled="!ui.canRename" :title="t('services.mergeJson.titles.rename')" @click="ui.openRename">
      {{ t("services.mergeJson.actions.rename") }}
    </custom-button>
    <custom-button variant="ghost" :_class="'merge__btn'" :disabled="!ui.canDeleteBlock" :title="t('services.mergeJson.titles.deleteBlock')" @click="ui.openDeleteBlock">
      {{ t("services.mergeJson.actions.deleteBlock") }}
    </custom-button>
    <custom-button variant="ghost" :_class="'merge__btn'" :disabled="!ui.resultTextJson.trim()" :title="t('services.mergeJson.titles.validate')" @click="ui.validateResult">
      {{ t("services.mergeJson.actions.validate") }}
    </custom-button>
    <custom-button variant="primary" :_class="'merge__btn'" :disabled="!ui.canDownload" :title="t('services.mergeJson.titles.download')" @click="onDownload">
      {{ t("services.mergeJson.actions.download") }}
    </custom-button>
  </div>
</template>

<style scoped>
.merge__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
}

.merge__toolbar-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  width: -webkit-fill-available;
}

.merge__spacer { flex: 1 1 auto; }
.merge__btn { height: 34px; }
.merge__select { min-width: 160px; }

.merge__chip {
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
}

.merge__chip_active { background-color: var(--color-primary); }

.merge__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
}

.merge__group-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.merge__group-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.merge__search { min-width: 240px; }

.merge__search-wrap {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.merge__matches {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.75;
  padding-bottom: 6px;
}

@media (max-width: 1100px) {
  .merge__search { min-width: 180px; }
}
</style>
