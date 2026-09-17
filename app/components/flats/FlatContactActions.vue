<script setup lang="ts">
// Contact buttons so a renter can reach the owner directly. Each button only
// opens the platform's own call or compose screen; nothing is sent from here.
// A WhatsApp or Telegram link built from a phone number is labelled as an
// attempt ("try"), because a number does not prove the account exists.
import { cardContactButtons, type CardContactButton } from "~/utils/flats/contactActions";

const props = defineProps<{ actions: unknown }>();

const { locale } = useI18n();
const isEnglish = computed(() => String(locale.value).startsWith("en"));
const buttons = computed(() => cardContactButtons(props.actions));

const ICONS: Record<CardContactButton["channel"], string> = {
  phone: "i-lucide-phone",
  telegram: "i-lucide-send",
  whatsapp: "i-lucide-message-circle",
  viber: "i-lucide-message-circle",
  email: "i-lucide-mail",
  facebook: "i-lucide-message-circle",
  threads: "i-lucide-at-sign",
};

const NAMES: Record<CardContactButton["channel"], string> = {
  phone: "", telegram: "Telegram", whatsapp: "WhatsApp", viber: "Viber", email: "Email", facebook: "Facebook", threads: "Threads",
};

function label(button: CardContactButton): string {
  if (button.channel === "phone") return isEnglish.value ? "Call" : "Позвонить";
  return NAMES[button.channel];
}

function title(button: CardContactButton): string {
  if (button.derivedFromPhone) {
    return isEnglish.value
      ? `Try ${NAMES[button.channel]}: opened from the phone number, the account may not exist`
      : `Попробовать ${NAMES[button.channel]}: ссылка по номеру телефона, аккаунта может не быть`;
  }
  return isEnglish.value ? "Contact published by the advertiser" : "Контакт указан в объявлении";
}
</script>

<template>
  <ul v-if="buttons.length" class="flat-contacts" :aria-label="isEnglish ? 'Contact the advertiser' : 'Связаться с автором объявления'">
    <li v-for="button in buttons" :key="button.channel">
      <a
        class="flat-contacts__button"
        :class="{ 'flat-contacts__button_derived': button.derivedFromPhone }"
        :href="button.href"
        :title="title(button)"
        :target="button.external ? '_blank' : undefined"
        :rel="button.external ? 'noopener noreferrer nofollow' : 'nofollow'"
        @click.stop
      >
        <u-icon :name="ICONS[button.channel]" aria-hidden="true" />
        <span>{{ label(button) }}</span>
      </a>
    </li>
  </ul>
</template>

<style scoped lang="scss">
.flat-contacts {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.flat-contacts__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary);
  transition: border-color 0.15s, color 0.15s;
}
.flat-contacts__button:hover,
.flat-contacts__button:focus-visible {
  border-color: var(--accent-pink);
}
.flat-contacts__button_derived {
  border-style: dashed;
  color: var(--text-muted);
}
</style>
