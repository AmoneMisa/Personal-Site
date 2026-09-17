<script setup lang="ts">
// The /data-rights request form (§48). Asks only for what a request needs: a
// reply address and the identifiers the data is keyed on, with no upload and
// no document field. Submitting opens the visitor's mail client with the
// request addressed to the operator's privacy contact; the site stores and
// sends nothing, because there is no admin interface to read a stored queue.
import {
  DISPUTE_TYPES,
  IDENTIFIER_TYPES,
  MAX_DETAILS,
  MAX_IDENTIFIERS,
  REQUEST_TYPES,
  buildDataRightsMailto,
  buildDataRightsPayload,
} from "~~/shared/legal/dataRightsRequest";
import { legalLocale } from "~~/shared/legal/legalContent";
import type { LegalIdentity } from "~~/shared/legal/legalIdentity";

const TEXT = {
  ru: {
    formTitle: "Отправить запрос",
    requestType: "Что вы хотите сделать",
    types: {
      access: "Узнать, какие данные обо мне есть",
      rectification: "Исправить неточные данные",
      erasure: "Удалить данные",
      restriction: "Ограничить обработку",
      objection: "Возразить против обработки",
      portability: "Выгрузить мои данные",
      dispute: "Оспорить сведения о личности или рисках",
    },
    disputeType: "Что именно неверно",
    disputes: {
      wrong_phone_association: "К моему номеру привязаны не мои данные",
      wrong_identity_merge: "Меня объединили с другим человеком",
      incorrect_role: "Неверная роль (собственник, агент и т. п.)",
      stale_username: "Устаревшее имя пользователя",
      wrong_property_association: "Мне приписано чужое объявление",
      incorrect_risk_evidence: "Неверные сведения о риске",
    },
    email: "Email для ответа",
    emailHint: "Сюда придёт ответ. Больше мы ничего о вас не спрашиваем.",
    identifiers: "Ваши телефоны и аккаунты",
    identifiersHint: "По ним мы найдём данные. Телефон — в международном формате, например +998 90 123 45 67.",
    identifierTypes: { phone: "Телефон", telegram: "Telegram", email: "Email", whatsapp: "WhatsApp", viber: "Viber", facebook: "Facebook", threads: "Threads" },
    value: "Значение",
    addIdentifier: "Добавить ещё",
    remove: "Удалить",
    details: "Подробности (необязательно)",
    detailsHint: "Например, какие данные неверны и как правильно.",
    notice: "Мы проверим, что указанные телефоны и аккаунты ваши, прежде чем что-либо раскрыть или изменить. Документы не нужны.",
    submit: "Подготовить письмо",
    errors: {
      requestType: "Выберите тип запроса.",
      requesterEmail: "Укажите корректный email.",
      identifiers: "Укажите хотя бы один телефон или аккаунт.",
      disputeType: "Выберите, что именно неверно.",
      details: "Текст слишком длинный.",
      unavailable: "Адрес для запросов пока не настроен.",
    },
    doneText: "Откроется ваша почтовая программа с готовым письмом — проверьте и отправьте его. Ответим в течение месяца.",
  },
  en: {
    formTitle: "Send a request",
    requestType: "What would you like to do",
    types: {
      access: "Find out what data you hold about me",
      rectification: "Correct inaccurate data",
      erasure: "Remove my data",
      restriction: "Restrict processing",
      objection: "Object to processing",
      portability: "Export my data",
      dispute: "Challenge identity or risk information",
    },
    disputeType: "What exactly is wrong",
    disputes: {
      wrong_phone_association: "Data that is not mine is linked to my number",
      wrong_identity_merge: "I was merged with another person",
      incorrect_role: "Wrong role (owner, agent, etc.)",
      stale_username: "Outdated username",
      wrong_property_association: "A listing that is not mine is attributed to me",
      incorrect_risk_evidence: "Incorrect risk information",
    },
    email: "Email for our reply",
    emailHint: "We will reply here. We ask for nothing else about you.",
    identifiers: "Your phone numbers and accounts",
    identifiersHint: "We find data by these. Phone numbers in international format, for example +998 90 123 45 67.",
    identifierTypes: { phone: "Phone", telegram: "Telegram", email: "Email", whatsapp: "WhatsApp", viber: "Viber", facebook: "Facebook", threads: "Threads" },
    value: "Value",
    addIdentifier: "Add another",
    remove: "Remove",
    details: "Details (optional)",
    detailsHint: "For example, which data is wrong and what is correct.",
    notice: "We will check that these phone numbers and accounts are yours before disclosing or changing anything. No documents are needed.",
    submit: "Prepare email",
    errors: {
      requestType: "Choose a request type.",
      requesterEmail: "Enter a valid email address.",
      identifiers: "Enter at least one phone number or account.",
      disputeType: "Choose what exactly is wrong.",
      details: "The text is too long.",
      unavailable: "The request address is not configured yet.",
    },
    doneText: "Your mail app opens with the email ready — check it and send it. We reply within one month.",
  },
};

const { locale } = useI18n();
const lang = computed(() => legalLocale(locale.value));
const t = computed(() => TEXT[lang.value]);

const requestType = ref<string>("access");
const disputeType = ref<string>("");
const requesterEmail = ref("");
const identifiers = ref<{ type: string; value: string }[]>([{ type: "phone", value: "" }]);
const details = ref("");
const errors = ref<string[]>([]);
const prepared = ref(false);

const { data: identity } = await useFetch<LegalIdentity>("/legal-identity", { key: "legal-identity" });

function addIdentifier() {
  if (identifiers.value.length < MAX_IDENTIFIERS) identifiers.value.push({ type: "phone", value: "" });
}
function removeIdentifier(index: number) {
  identifiers.value.splice(index, 1);
  if (!identifiers.value.length) identifiers.value.push({ type: "phone", value: "" });
}

function submit() {
  errors.value = [];
  prepared.value = false;
  const built = buildDataRightsPayload({
    requestType: requestType.value,
    requesterEmail: requesterEmail.value,
    identifiers: identifiers.value,
    disputeType: disputeType.value,
    details: details.value,
  });
  if (!built.ok) {
    errors.value = built.errors;
    return;
  }
  const href = buildDataRightsMailto(identity.value?.contactEmail ?? "", built.payload);
  if (!href) {
    errors.value = ["unavailable"];
    return;
  }
  prepared.value = true;
  window.location.href = href;
}

const errorMessages = computed(() => errors.value.map((key) => (t.value.errors as Record<string, string>)[key] ?? t.value.errors.unavailable));
</script>

<template>
  <section id="request" class="rights-form">
    <h2 class="rights-form__title">{{ t.formTitle }}</h2>

    <form class="rights-form__form" novalidate @submit.prevent="submit">
      <label class="rights-form__field">
        <span class="rights-form__label">{{ t.requestType }}</span>
        <select v-model="requestType" class="ui-control ui-focusable" name="requestType">
          <option v-for="type in REQUEST_TYPES" :key="type" :value="type">{{ t.types[type] }}</option>
        </select>
      </label>

      <label v-if="requestType === 'dispute'" class="rights-form__field">
        <span class="rights-form__label">{{ t.disputeType }}</span>
        <select v-model="disputeType" class="ui-control ui-focusable" name="disputeType" :aria-invalid="errors.includes('disputeType')">
          <option value="" disabled>—</option>
          <option v-for="type in DISPUTE_TYPES" :key="type" :value="type">{{ t.disputes[type] }}</option>
        </select>
      </label>

      <label class="rights-form__field">
        <span class="rights-form__label">{{ t.email }}</span>
        <input v-model="requesterEmail" class="ui-control ui-focusable" type="email" name="requesterEmail" autocomplete="email" maxlength="254" required :aria-invalid="errors.includes('requesterEmail')" aria-describedby="rights-email-hint">
        <span id="rights-email-hint" class="rights-form__hint">{{ t.emailHint }}</span>
      </label>

      <fieldset class="rights-form__field rights-form__identifiers">
        <legend class="rights-form__label">{{ t.identifiers }}</legend>
        <p class="rights-form__hint">{{ t.identifiersHint }}</p>
        <div v-for="(identifier, index) in identifiers" :key="index" class="rights-form__identifier">
          <select v-model="identifier.type" class="ui-control ui-focusable" :aria-label="t.identifiers">
            <option v-for="type in IDENTIFIER_TYPES" :key="type" :value="type">{{ t.identifierTypes[type] }}</option>
          </select>
          <input v-model="identifier.value" class="ui-control ui-focusable" type="text" maxlength="200" :aria-label="`${t.identifierTypes[identifier.type as keyof typeof t.identifierTypes]} — ${t.value}`" :aria-invalid="errors.includes('identifiers')">
          <button type="button" class="rights-form__secondary ui-focusable" @click="removeIdentifier(index)">{{ t.remove }}</button>
        </div>
        <button v-if="identifiers.length < MAX_IDENTIFIERS" type="button" class="rights-form__secondary ui-focusable" @click="addIdentifier">{{ t.addIdentifier }}</button>
      </fieldset>

      <label class="rights-form__field">
        <span class="rights-form__label">{{ t.details }}</span>
        <textarea v-model="details" class="ui-control ui-focusable rights-form__textarea" name="details" rows="4" :maxlength="MAX_DETAILS" aria-describedby="rights-details-hint" />
        <span id="rights-details-hint" class="rights-form__hint">{{ t.detailsHint }}</span>
      </label>

      <p class="rights-form__notice">{{ t.notice }}</p>

      <ul v-if="errorMessages.length" class="rights-form__errors" role="alert">
        <li v-for="message in errorMessages" :key="message">{{ message }}</li>
      </ul>

      <button type="submit" class="rights-form__submit ui-focusable">{{ t.submit }}</button>
      <p v-if="prepared" class="rights-form__hint" role="status">{{ t.doneText }}</p>
    </form>
  </section>
</template>

<style scoped lang="scss">
.rights-form {
  scroll-margin-top: 88px;
  margin: 12px 0 40px;
  display: grid;
  gap: 32px;
}
.rights-form__title {
  font-size: 21px;
  font-weight: 500;
  margin-bottom: 4px;
}
.rights-form__form {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-deep);
}
.rights-form__field {
  display: grid;
  gap: 6px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.rights-form__label {
  font-size: 14px;
  color: var(--text-primary);
}
.rights-form__hint,
.rights-form__notice {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.rights-form__identifiers {
  gap: 10px;
}
.rights-form__identifier {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}
.rights-form__textarea {
  resize: vertical;
  min-height: 96px;
  padding-block: 8px;
}
.rights-form__secondary {
  justify-self: start;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.rights-form__secondary:hover {
  color: var(--text-primary);
  border-color: var(--accent-pink);
}
.rights-form__submit {
  justify-self: start;
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  background: var(--accent-pink);
  color: #0b1026;
  font-weight: 500;
  cursor: pointer;
}
.rights-form__errors {
  margin: 0;
  padding-left: 18px;
  color: var(--accent-pink);
  font-size: 14px;
}
@media (max-width: 600px) {
  .rights-form__form {
    padding: 16px;
  }
  .rights-form__identifier {
    grid-template-columns: 1fr;
  }
}
</style>
