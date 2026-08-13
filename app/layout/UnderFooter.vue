<script setup lang="ts">
import ContactItem from "~/components/footer/ContactItem.vue";

const contactsData = useContacts();
const contacts = computed(() => contactsData?.value?.contacts ?? []);
</script>

<template>
  <div class="under-footer" v-if="contacts && contacts.length">
    <div class="under-footer__column">
      <u-page-list class="under-footer__list under-footer__contact">
        <contact-item :contacts="contacts.filter(contact => contact.type === 'social') || []"/>
      </u-page-list>
    </div>

    <div class="under-footer__column">
      <u-page-list class="under-footer__list">
        <contact-item :contacts="contacts.filter(contact => contact.type === 'other') || []"/>
      </u-page-list>
    </div>
  </div>
</template>

<style scoped lang="scss">
.under-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  gap: 20px;
  flex-wrap: wrap;
}

@media screen and (max-width: 560px) {
  .under-footer {
    text-align: center;
  }
}

.under-footer__list {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-direction: row !important;
}
</style>