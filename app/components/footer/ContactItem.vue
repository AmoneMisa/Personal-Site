<script setup lang="ts">
const iconModules = import.meta.glob('~/assets/icons/*.svg')

function iconComponent(name: string) {
  const key = Object.keys(iconModules).find((path) => path.endsWith(`${name}.svg`));
  if (!key) return null;
  return defineAsyncComponent(iconModules[key]);
}

const {t} = useI18n();

const props = defineProps({
  contacts: {
    type: Array,
    required: true
  }
});
</script>

<template>
  <li v-for="contact in contacts" :key="contact.id" class="footer__contact-item">
    <a
        v-if="contact.type === 'address'"
        href="#"
        class="footer__contact-link"
    >
      <span v-if="contact.labelKey">{{ t(contact.labelKey) }}</span>
      {{ contact.value }}
    </a>

    <a
        v-else-if="contact.type === 'email'"
        :href="`mailto:${contact.value}`"
        class="footer__contact-link"
    >
      <span v-if="contact.labelKey">{{ t(contact.labelKey) }}</span>
      {{ contact.value }}
    </a>

    <a
        v-else-if="contact.type === 'phone'"
        :href="`tel:${contact.value}`"
        class="footer__contact-link"
    >
      <span v-if="contact.labelKey">{{ t(contact.labelKey) }}</span>
      {{ contact.value }}
    </a>

    <a v-else-if="contact.type === 'social'"
       :href="contact.value"
       class="footer__contact-social"
       target="_blank"
       rel="noopener noreferrer"
       :title="contact?.labelKey ? t(contact.labelKey) : contact.value"
    >
      <component :is="iconComponent(contact.socialType.toLowerCase())" class="footer__social-icon"/>
    </a>

    <span v-else-if="contact.type === 'other'" class="footer__contact-link">
      {{ contact.value }} {{ t(contact.labelKey) }}
    </span>
  </li>
</template>

<style scoped lang="scss">
.footer__contact-social {
  display: inline-flex;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: transform;
  cursor: pointer;

  &:hover {
    transform: scale(1.1);
    filter: brightness(115%);
  }
}

.footer__social-icon {
  width: 30px;
  height: 30px;
}
</style>
