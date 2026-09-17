<script setup lang="ts">
// The /data-rights request form and status lookup (§48). Asks only for what a
// request needs: a reply address and the identifiers the data is keyed on.
// There is no upload and no document field by design.
import {
  DISPUTE_TYPES,
  IDENTIFIER_TYPES,
  MAX_DETAILS,
  MAX_IDENTIFIERS,
  REQUEST_TYPES,
  buildDataRightsPayload,
  isRequestReference,
} from "~~/shared/legal/dataRightsRequest";
import { legalLocale } from "~~/shared/legal/legalContent";

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
    submit: "Отправить запрос",
    sending: "Отправляем…",
    errors: {
      requestType: "Выберите тип запроса.",
      requesterEmail: "Укажите корректный email.",
      identifiers: "Укажите хотя бы один телефон или аккаунт.",
      disputeType: "Выберите, что именно неверно.",
      details: "Текст слишком длинный.",
      generic: "Не удалось отправить запрос. Попробуйте позже или напишите нам на почту.",
      rate: "Слишком много запросов. Попробуйте позже.",
    },
    doneTitle: "Запрос принят",
    doneText: "Сохраните номер запроса — по нему можно узнать статус.",
    reference: "Номер запроса",
    due: "Ответим до",
    statusTitle: "Статус запроса",
    statusPlaceholder: "PR-…",
    check: "Проверить",
    statusNotFound: "Запрос не найден.",
    statusInvalid: "Неверный номер запроса.",
    statuses: {
      received: "Получен",
      identity_verification_required: "Нужно подтвердить, что идентификаторы ваши — мы напишем на указанный email",
      in_review: "Рассматривается",
      fulfilled: "Выполнен",
      partially_fulfilled: "Выполнен частично",
      rejected_with_reason: "Отклонён с объяснением причины",
    } as Record<string, string>,
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
    submit: "Send request",
    sending: "Sending…",
    errors: {
      requestType: "Choose a request type.",
      requesterEmail: "Enter a valid email address.",
      identifiers: "Enter at least one phone number or account.",
      disputeType: "Choose what exactly is wrong.",
      details: "The text is too long.",
      generic: "The request could not be sent. Please try later or write to us by email.",
      rate: "Too many requests. Please try later.",
    },
    doneTitle: "Request received",
    doneText: "Keep the request reference — you can use it to check the status.",
    reference: "Request reference",
    due: "We will reply by",
    statusTitle: "Request status",
    statusPlaceholder: "PR-…",
    check: "Check",
    statusNotFound: "Request not found.",
    statusInvalid: "Invalid request reference.",
    statuses: {
      received: "Received",
      identity_verification_required: "We need to confirm the identifiers are yours — we will write to the email you gave",
      in_review: "In review",
      fulfilled: "Fulfilled",
      partially_fulfilled: "Partially fulfilled",
      rejected_with_reason: "Rejected, with the reason explained",
    } as Record<string, string>,
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
const sending = ref(false);
const result = ref<{ reference: string; dueAt: string } | null>(null);

function addIdentifier() {
  if (identifiers.value.length < MAX_IDENTIFIERS) identifiers.value.push({ type: "phone", value: "" });
}
function removeIdentifier(index: number) {
  identifiers.value.splice(index, 1);
  if (!identifiers.value.length) identifiers.value.push({ type: "phone", value: "" });
}

const formatDate = (value: string) => new Date(value).toLocaleDateString(lang.value === "ru" ? "ru-RU" : "en-GB", { year: "numeric", month: "long", day: "numeric" });

async function submit() {
  errors.value = [];
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
  sending.value = true;
  try {
    const response = await $fetch<{ ok: boolean; reference: string; dueAt: string }>("/privacy-request", { method: "POST", body: built.payload });
    result.value = { reference: response.reference, dueAt: response.dueAt };
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode;
    const fields = (error as { data?: { errors?: string[] } })?.data?.errors;
    errors.value = status === 429 ? ["rate"] : Array.isArray(fields) && fields.length ? fields : ["generic"];
  } finally {
    sending.value = false;
  }
}

const statusReference = ref("");
const statusText = ref("");
async function checkStatus() {
  statusText.value = "";
  const reference = statusReference.value.trim();
  if (!isRequestReference(reference)) {
    statusText.value = t.value.statusInvalid;
    return;
  }
  try {
    const response = await $fetch<{ status: string; dueAt: string }>("/privacy-request-status", { query: { reference } });
    statusText.value = `${t.value.statuses[response.status] ?? response.status} · ${t.value.due}: ${formatDate(response.dueAt)}`;
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode;
    statusText.value = status === 404 ? t.value.statusNotFound : status === 429 ? t.value.errors.rate : t.value.errors.generic;
  }
}

const errorMessages = computed(() => errors.value.map((key) => (t.value.errors as Record<string, string>)[key] ?? t.value.errors.generic));
</script>

<template>
  <section id="request" class="rights-form">
    <h2 class="rights-form__title">{{ t.formTitle }}</h2>

    <div v-if="result" class="rights-form__done" role="status">
      <h3>{{ t.doneTitle }}</h3>
      <p>{{ t.doneText }}</p>
      <p class="rights-form__reference"><span>{{ t.reference }}:</span> <code>{{ result.reference }}</code></p>
      <p>{{ t.due }}: {{ formatDate(result.dueAt) }}</p>
    </div>

    <form v-else class="rights-form__form" novalidate @submit.prevent="submit">
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

      <button type="submit" class="rights-form__submit ui-focusable" :disabled="sending">{{ sending ? t.sending : t.submit }}</button>
    </form>

    <form class="rights-form__status" @submit.prevent="checkStatus">
      <h2 class="rights-form__title">{{ t.statusTitle }}</h2>
      <div class="rights-form__identifier">
        <input v-model="statusReference" class="ui-control ui-focusable" type="text" maxlength="40" :placeholder="t.statusPlaceholder" :aria-label="t.reference">
        <button type="submit" class="rights-form__secondary ui-focusable">{{ t.check }}</button>
      </div>
      <p v-if="statusText" class="rights-form__hint" role="status">{{ statusText }}</p>
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
.rights-form__form,
.rights-form__status {
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
.rights-form__status .rights-form__identifier {
  grid-template-columns: minmax(0, 1fr) auto;
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
.rights-form__submit:disabled {
  opacity: 0.6;
  cursor: progress;
}
.rights-form__errors {
  margin: 0;
  padding-left: 18px;
  color: var(--accent-pink);
  font-size: 14px;
}
.rights-form__done {
  padding: 22px;
  border: 1px solid var(--accent-pink);
  border-radius: 10px;
  display: grid;
  gap: 8px;
  h3 {
    font-size: 18px;
    font-weight: 500;
  }
}
.rights-form__reference code {
  font-size: 15px;
  user-select: all;
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .rights-form__form,
  .rights-form__status {
    padding: 16px;
  }
  .rights-form__identifier {
    grid-template-columns: 1fr;
  }
}
</style>
