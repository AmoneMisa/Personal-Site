<script setup lang="ts">
import AddKeyModal from "~/components/mergeJson/AddKeyModal.vue";
import { useServiceSeo } from "~/composables/services/useServiceSeo";
import MergeJsonPane from "~/components/mergeJson/MergeJsonPane.vue";
import MergeJsonToolbar from "~/components/mergeJson/MergeJsonToolbar.vue";
import {useMergeJsonState} from "~/composables/mergeJson/useMergeJsonState";

const {t} = useI18n();

useServiceSeo("mergeJson");
const ui = proxyRefs(useMergeJsonState());

const monacoMode = computed(() => (ui.viewMode === "flat" ? "flat" : "json"));
</script>

<template>
  <u-container class="merge">
    <service-page-header
        backdrop="treasure"
        title="services.mergeJson.title"
        headline="services.mergeJson.headline"
        description="services.mergeJson.subtitle"
    />

    <section class="merge__card">
      <merge-json-toolbar :ui="ui" />

      <div class="merge__triple">
        <merge-json-pane
            :title="t('services.mergeJson.table.colA')"
            :mode="monacoMode"
            :text="ui.viewTextA"
            :selected-key="ui.selectedKey"
            :hidden-keys="ui.hiddenKeysA"
            :decorations="ui.decorationsA"
            :reveal-path="ui.revealKey"
            @nav="ui.jumpToMatch"
            @select="ui.selectKey"
        />

        <merge-json-pane
            center
            :title="t('services.mergeJson.table.colResult')"
            :mode="monacoMode"
            :model-value="ui.viewMode === 'flat' ? ui.resultTextFlat : ui.resultTextJson"
            :selected-key="ui.selectedKey"
            :hidden-keys="ui.hiddenKeysR"
            :decorations="ui.decorationsR"
            :reveal-path="ui.revealKey"
            :readonly="false"
            :error="ui.errorR"
            @nav="ui.jumpToMatch"
            @update:modelValue="ui.viewMode === 'flat' ? ui.onResultFlatChange($event) : ui.onResultJsonChange($event)"
            @select="ui.selectKey"
        />

        <merge-json-pane
            :title="t('services.mergeJson.table.colB')"
            :mode="monacoMode"
            :text="ui.viewTextB"
            :selected-key="ui.selectedKey"
            :hidden-keys="ui.hiddenKeysB"
            :decorations="ui.decorationsB"
            :reveal-path="ui.revealKey"
            @nav="ui.jumpToMatch"
            @select="ui.selectKey"
        />
      </div>
    </section>

    <add-key-modal v-model="ui.showAddKey" @submit="ui.onAddKey"/>
    <component
        v-if="ui.modal.component"
        :is="ui.modal.component"
        :model-value="ui.modal.open"
        v-bind="ui.modal.props"
        @update:modelValue="(v) => (v ? (ui.modal.open = true) : ui.closeModal())"
        @close="ui.closeModal"
        @confirm="(payload) => { ui.modal.onConfirm(payload); ui.closeModal(); }"
    />

  </u-container>
</template>

<style scoped>
.merge {
  padding-top: 24px;
  padding-bottom: 96px;
}

.merge__subtitle {
  max-width: 760px;
  font-size: 14px;
}

.merge__card {
  margin-top: 18px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.merge__triple {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 12px;
  min-width: 0;
}

@media (max-width: 1100px) {
  .merge__triple {
    grid-template-columns: 1fr;
  }

}

</style>
