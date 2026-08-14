<script setup lang="ts">
import Modal from "~/components/common/Modal.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import CustomButton from "~/components/common/CustomButton.vue";
import { computed, reactive, watch } from "vue";
import type { TemplateEngine } from "~/utils/emailEditor/preview/clientProfiles";

const { t } = useI18n();
const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  templateEngine: TemplateEngine;
}>();

const emit = defineEmits<{
  (e: "insert", payload: { snippet: string }): void;
}>();

const form = reactive({
  kind: "if" as "if" | "variable" | "loop" | "declare",
  variableName: "user",
  condition: "user.isActive",
  collection: "items",
  itemName: "item",
  declareType: "string" as "string" | "number" | "object" | "array",
});

watch(
    () => open.value,
    (v) => {
      if (!v) return;
      form.kind = "if";
    }
);

const isTemplateMode = computed(() => props.templateEngine !== "clean_html");

const kindItems = computed(() => [
  { label: t("services.emailEditor.modals.insertTemplate.kind.if"), value: "if" },
  { label: t("services.emailEditor.modals.insertTemplate.kind.variable"), value: "variable" },
  { label: t("services.emailEditor.modals.insertTemplate.kind.loop"), value: "loop" },
  { label: t("services.emailEditor.modals.insertTemplate.kind.declare"), value: "declare" },
]);

const declareTypeItems = computed(() => [
  { label: t("services.emailEditor.modals.insertTemplate.types.string"), value: "string" },
  { label: t("services.emailEditor.modals.insertTemplate.types.number"), value: "number" },
  { label: t("services.emailEditor.modals.insertTemplate.types.object"), value: "object" },
  { label: t("services.emailEditor.modals.insertTemplate.types.array"), value: "array" },
]);

function submit() {
  if (!isTemplateMode.value) return;

  const snippet = buildSnippet({
    engine: props.templateEngine,
    kind: form.kind,
    variableName: form.variableName,
    condition: form.condition,
    collection: form.collection,
    itemName: form.itemName,
    declareType: form.declareType,
  });

  emit("insert", { snippet });
  open.value = false;
}

function buildSnippet(input: any) {
  if (input.engine === "freemarker") {
    if (input.kind === "if") return `<#if ${input.condition}>\n  \n</#if>`;
    if (input.kind === "variable") return `\${${input.variableName}}`;
    if (input.kind === "loop") return `<#list ${input.collection} as ${input.itemName}>\n  \${${input.itemName}}\n</#list>`;
    if (input.declareType === "string") return `<#assign ${input.variableName} = "text">`;
    if (input.declareType === "number") return `<#assign ${input.variableName} = 123>`;
    if (input.declareType === "object") return `<#assign ${input.variableName} = {"key":"value"}>`;
    return `<#assign ${input.variableName} = ["a","b","c"]>`;
  }

  if (input.kind === "if") return `#if( ${input.condition} )\n  \n#end`;
  if (input.kind === "variable") return `$${input.variableName}`;
  if (input.kind === "loop") return `#foreach( $${input.itemName} in $${input.collection} )\n  $${input.itemName}\n#end`;
  if (input.declareType === "string") return `#set( $${input.variableName} = "text" )`;
  if (input.declareType === "number") return `#set( $${input.variableName} = 123 )`;
  if (input.declareType === "object") return `#set( $${input.variableName} = {"key":"value"} )`;
  return `#set( $${input.variableName} = ["a","b","c"] )`;
}
</script>

<template>
  <modal v-model:open="open" max-width-class="sm:max-w-xl">
    <template #title>{{ t("services.emailEditor.modals.insertTemplate.title") }}</template>

    <div v-if="!isTemplateMode" class="email-editor-template__notice">
      {{ t("services.emailEditor.modals.insertTemplate.notice") }}
    </div>

    <div v-else class="email-editor-template">
      <div class="email-editor-template__kind">
        <u-select
            v-model="form.kind"
            :items="kindItems"
            option-attribute="label"
            value-attribute="value"
        />
      </div>

      <custom-input
          v-if="form.kind === 'if'"
          v-model="form.condition"
          :label="t('services.emailEditor.modals.insertTemplate.fields.condition')"
      />
      <custom-input
          v-if="form.kind === 'variable'"
          v-model="form.variableName"
          :label="t('services.emailEditor.modals.insertTemplate.fields.variableName')"
      />

      <div v-if="form.kind === 'loop'" class="email-editor-template__row">
        <custom-input
            v-model="form.collection"
            :label="t('services.emailEditor.modals.insertTemplate.fields.collection')"
        />
        <custom-input
            v-model="form.itemName"
            :label="t('services.emailEditor.modals.insertTemplate.fields.itemName')"
        />
      </div>

      <div v-if="form.kind === 'declare'" class="email-editor-template__row">
        <custom-input
            v-model="form.variableName"
            :label="t('services.emailEditor.modals.insertTemplate.fields.variableName')"
        />
        <u-select
            v-model="form.declareType"
            :items="declareTypeItems"
            option-attribute="label"
            value-attribute="value"
        />
      </div>
    </div>

    <template #actions="{ close }">
      <custom-button variant="secondary" @click="close()">
        {{ t("services.emailEditor.modals.insertTemplate.cancel") }}
      </custom-button>
      <custom-button
          variant="full"
          :class="{ 'opacity-60 pointer-events-none': !isTemplateMode }"
          @click="submit"
      >
        {{ t("services.emailEditor.modals.insertTemplate.insert") }}
      </custom-button>
    </template>
  </modal>
</template>

<style scoped lang="scss">
.email-editor-template {
  display: grid;
  gap: 10px;
}

.email-editor-template__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.email-editor-template__notice {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 190, 90, 0.12);
  border: 1px solid rgba(255, 190, 90, 0.18);
}

</style>
