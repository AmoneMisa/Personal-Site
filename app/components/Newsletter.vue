<script setup lang="ts">
const {t} = useI18n();
</script>

<template>
  <div class="newsletter flex flex-col justify-center">
    <h3 class="newsletter__title">{{ t('footer.newsletter.title') }}</h3>

    <div class="newsletter__form">
      <u-input
          type="email"
          name="newsletter-email"
          :placeholder="t('footer.newsletter.placeholder')"
          :ui="{base: 'newsletter__input'}"
      />

      <u-button
          icon="i-heroicons-arrow-right"
          size="lg"
          color="primary"
          type="submit"
          :aria-label="t('footer.newsletter.title')"
          class="newsletter__button px-5"
      />
    </div>
  </div>
</template>

<style lang="scss">
.newsletter__title {
  font-weight: 500;
  font-size: 20px;
  padding-right: 31%;
  line-height: 28px;
  margin-bottom: 16px;
  color: var(--text-white);

  @media (max-width: 1024px) {
    font-size: 18px;
    line-height: 24px;
  }
  @media (max-width: 768px) {
    font-size: 16px;
    line-height: 20px;
  }
}

.newsletter__input {
  flex-grow: 1;
  width: auto;
  margin-right: 10px;
  height: 50px;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 230px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0 15px;
  background-color: transparent;
  transition: border-color .3s ease;

  &:hover {
    border-color: var(--color-primary);
  }
}

.newsletter__form {
  display: flex;
  align-items: center;
}

.newsletter__button {
  height: 50px;
  line-height: 50px;
}
</style>