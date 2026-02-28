<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import CustomInput from "~/components/common/CustomInput.vue";
import CustomButton from "~/components/common/CustomButton.vue";

type SessionStatus = "active" | "awaiting_username" | "moved_to_telegram" | "closed";

type ChatSession = {
  id: number;
  status: SessionStatus;
  tgUsername?: string | null;
};

type ChatMessage = {
  id?: number;
  localId?: string;
  sender: "client" | "owner";
  text: string;
  createdAt: string;
  pending?: boolean;
};

const props = withDefaults(
    defineProps<{
      titleKey?: string;
    }>(),
    {
      titleKey: "chat.title",
    }
);

const { public: publicConfig } = useRuntimeConfig();
const apiBase = computed(() => (publicConfig.apiBase || "").replace(/\/$/, ""));

const isOpen = ref(false);
const isLoading = ref(false);
const isSending = ref(false);
const hasUnread = ref(false);

const session = ref<ChatSession | null>(null);

const messages = ref<ChatMessage[]>([]);
const messageText = ref("");

const socket = ref<WebSocket | null>(null);
const socketConnected = ref(false);

const chatListRef = ref<HTMLElement | null>(null);
const clientId = ref<string>("");

const flowMode = computed<"choose" | "telegram" | "site" | "closed">(() => {
  const s = session.value;
  if (!s) return "choose";
  if (s.status === "active") return "site";
  if (s.status === "awaiting_username") return "telegram";
  return "closed";
});

const canSend = computed(() => {
  return flowMode.value === "site" && !isSending.value && !!messageText.value.trim();
});

function ensureClientId() {
  const key = "whiteslove_chat_client_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`);
  localStorage.setItem(key, id);
  return id;
}

function normalizeTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

async function scrollChatToBottom(smooth = true) {
  await nextTick();
  const el = chatListRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

function openChat() {
  isOpen.value = true;
  hasUnread.value = false;
  connectSocket();
  loadHistory();
}

function closeChat() {
  isOpen.value = false;
  disconnectSocket();
}

function toggleChat() {
  if (isOpen.value) closeChat();
  else openChat();
}

function pushSystemOwnerText(text: string) {
  messages.value.push({
    sender: "owner",
    text,
    createdAt: new Date().toISOString(),
  });
}

function ensureIntroIfNeeded() {
  if (session.value) return;

  const hasAny = messages.value.length > 0;
  if (!hasAny) {
    pushSystemOwnerText("Привет! Где вам удобнее общаться с разработчиком?");
  }
}

async function loadHistory() {
  isLoading.value = true;
  try {
    const res = await fetch(`${apiBase.value}/chat/history`, {
      method: "GET",
      headers: { "X-Client-Id": clientId.value },
      credentials: "include",
    });
    const data = await res.json();

    if (data?.ok) {
      session.value = data.session ?? null;
      messages.value = (data.messages ?? []) as ChatMessage[];

      ensureIntroIfNeeded();

      if (!session.value) {
        await scrollChatToBottom(false);
        return;
      }

      if (session.value.status === "awaiting_username") {
        if (!messages.value.some((m) => m.sender === "owner" && m.text.includes("@"))) {
          pushSystemOwnerText("Введите ваш никнейм в Telegram через @ — чтобы разработчик смог написать вам напрямую.");
        }
      }

      if (session.value.status === "moved_to_telegram") {
        pushSystemOwnerText(`Спасибо. Разработчик свяжется с вами как можно скорее с ника @WhitesLove`);
      }

      if (session.value.status === "closed") {
        pushSystemOwnerText("Диалог закрыт. Вы можете начать новый в любой момент.");
      }

      await scrollChatToBottom(false);
    }
  } finally {
    isLoading.value = false;
  }
}

async function startNewSession() {
  const res = await fetch(`${apiBase.value}/chat/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": clientId.value,
    },
    body: JSON.stringify({}),
    credentials: "include",
  });
  const data = await res.json();
  if (!data?.ok) return;

  session.value = data.session as ChatSession;
  messages.value = [];

  pushSystemOwnerText("Привет! Где вам удобнее общаться с разработчиком?");
  await scrollChatToBottom(false);
}

async function chooseSite() {
  const res = await fetch(`${apiBase.value}/chat/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": clientId.value,
    },
    body: JSON.stringify({}),
    credentials: "include",
  });
  const data = await res.json();
  if (!data?.ok) return;

  session.value = data.session as ChatSession;

  pushSystemOwnerText("Ок! Напишите сообщение — я передам его разработчику.");
  await scrollChatToBottom();
}

async function chooseTelegram() {
  const res = await fetch(`${apiBase.value}/chat/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": clientId.value,
    },
    body: JSON.stringify({}),
    credentials: "include",
  });
  const data = await res.json();
  if (!data?.ok) return;

  session.value = data.session as ChatSession;

  session.value.status = "awaiting_username";
  pushSystemOwnerText("Введите ваш никнейм в Telegram через @ — чтобы разработчик смог написать вам напрямую.");
  await scrollChatToBottom();
}

function isValidTgUsername(v: string) {
  return /^@[A-Za-z0-9_]{5,32}$/.test(v.trim());
}

async function submitTelegramUsername() {
  const tg = messageText.value.trim();
  if (!isValidTgUsername(tg)) {
    pushSystemOwnerText("Никнейм должен быть в формате @username (5–32 символа).");
    await scrollChatToBottom();
    return;
  }

  if (!session.value) {
    await chooseTelegram();
  }

  isSending.value = true;
  try {
    const res = await fetch(`${apiBase.value}/chat/set-channel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId.value,
      },
      body: JSON.stringify({ channel: "telegram", tgUsername: tg }),
      credentials: "include",
    });
    const data = await res.json();
    if (!data?.ok) return;

    messageText.value = "";

    session.value = data.session as ChatSession;

    pushSystemOwnerText(`Спасибо. Разработчик свяжется с вами как можно скорее с ника @WhitesLove`);
    await scrollChatToBottom();
  } finally {
    isSending.value = false;
  }
}

function makeLocalId() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

function markDeliveredByLocalId(localId?: string) {
  if (!localId) return;
  const m = messages.value.find((x) => x.localId === localId);
  if (m) m.pending = false;
}

function hasSameRecentMessage(sender: "client" | "owner", text: string, createdAtIso: string) {
  const last = [...messages.value].reverse().find((m) => m.sender === sender && m.text === text);
  if (!last) return false;
  const a = new Date(last.createdAt).getTime();
  const b = new Date(createdAtIso).getTime();
  return Math.abs(a - b) < 3000;
}

async function sendSiteMessage() {
  const text = messageText.value.trim();
  if (!text) return;

  if (!session.value || session.value.status !== "active") {
    await chooseSite();
  }

  const localId = makeLocalId();
  const optimistic: ChatMessage = {
    localId,
    sender: "client",
    text,
    createdAt: new Date().toISOString(),
    pending: true,
  };
  messages.value.push(optimistic);
  await scrollChatToBottom();

  isSending.value = true;
  try {
    const res = await fetch(`${apiBase.value}/chat/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId.value,
      },
      body: JSON.stringify({ text, clientMsgId: localId }),
      credentials: "include",
    });
    const data = await res.json();
    if (!data?.ok) return;

    messageText.value = "";
    markDeliveredByLocalId(localId);
  } finally {
    isSending.value = false;
  }
}

async function closeSessionFromSite() {
  if (!session.value) return;

  const res = await fetch(`${apiBase.value}/chat/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": clientId.value,
    },
    body: JSON.stringify({ reason: "closed_by_client" }),
    credentials: "include",
  });

  const data = await res.json();
  if (!data?.ok) return;

  session.value = data.session as ChatSession;
  pushSystemOwnerText("Диалог закрыт. Вы можете начать новый в любой момент.");
  await scrollChatToBottom();
}

function onEnter() {
  if (flowMode.value === "telegram") {
    submitTelegramUsername();
    return;
  }
  if (flowMode.value === "site") {
    sendSiteMessage();
    return;
  }
}

function connectSocket() {
  const originWs = window.location.origin.replace(
      /^http/i,
      (m) => (m.toLowerCase() === "https" ? "wss" : "ws")
  );

  const url = `${originWs}/chat-ws?clientId=${encodeURIComponent(clientId.value)}`;

  try {
    socket.value?.close();
  } catch {}

  socketConnected.value = false;
  socket.value = new WebSocket(url);

  socket.value.onopen = () => {
    socketConnected.value = true;
  };

  socket.value.onmessage = async (ev) => {
    let payload: any;
    try {
      payload = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (payload?.type === "message") {
      const createdAt = payload.createdAt ?? new Date().toISOString();
      const text = payload.text ?? "";
      const sender = payload.sender as "client" | "owner";

      if (payload.clientMsgId) {
        markDeliveredByLocalId(payload.clientMsgId);
      }

      if (!payload.clientMsgId && hasSameRecentMessage(sender, text, createdAt)) {
        return;
      }

      messages.value.push({
        id: payload.id ?? undefined,
        sender,
        text,
        createdAt,
      });

      if (!isOpen.value) hasUnread.value = true;
      await scrollChatToBottom();
      return;
    }

    if (payload?.type === "session_update") {
      session.value = payload.session as ChatSession;
      await scrollChatToBottom();
      return;
    }

    if (payload?.type === "session_closed") {
      session.value = payload.session as ChatSession;
      pushSystemOwnerText("Диалог закрыт. Вы можете начать новый в любой момент.");
      await scrollChatToBottom();
      return;
    }
  };

  socket.value.onclose = () => {
    socketConnected.value = false;
    if (!isOpen.value) return;
    setTimeout(() => {
      if (isOpen.value) connectSocket();
    }, 1200);
  };

  socket.value.onerror = () => {
    socketConnected.value = false;
  };
}

function disconnectSocket() {
  try {
    socket.value?.close();
  } catch {}
  socket.value = null;
  socketConnected.value = false;
}

onMounted(() => {
  clientId.value = ensureClientId();
});

onBeforeUnmount(() => {
  disconnectSocket();
});
</script>

<template>
  <button class="floating-chat-toggle" type="button" @click="toggleChat">
    <u-icon name="i-lucide-send" class="floating-chat-toggle__icon" />
    <span v-if="hasUnread" class="floating-chat-toggle__unread" />
  </button>

  <transition name="floating-chat-animation">
    <section v-if="isOpen" class="floating-chat-panel">
      <div class="floating-chat-panel__inner">
        <header class="floating-chat-header">
          <div class="floating-chat-header__left">
            <div class="floating-chat-header__title">
              <span>{{ $t(props.titleKey) }}</span>
            </div>

            <div class="floating-chat-header__status" :class="{ 'floating-chat-header__status_connected': socketConnected }">
              <u-icon
                  :name="socketConnected ? 'i-lucide-wifi' : 'i-lucide-wifi-off'"
                  class="floating-chat-header__status-icon"
              />
              <span>{{ socketConnected ? $t("chat.status.online") : $t("chat.status.connecting") }}</span>
            </div>
          </div>

          <div class="floating-chat-header__actions">
            <u-button
                v-if="session && (session.status === 'active' || session.status === 'awaiting_username')"
                variant="ghost"
                class="floating-chat-header__action"
                type="button"
                @click="closeSessionFromSite"
            >
              <u-icon name="i-lucide-ban" class="floating-chat-header__action-icon" />
            </u-button>

            <u-button
                variant="ghost"
                class="floating-chat-header__close"
                type="button"
                @click="closeChat"
            >
              <u-icon name="i-lucide-x" class="floating-chat-header__close-icon" />
            </u-button>
          </div>
        </header>

        <div ref="chatListRef" class="floating-chat-messages">
          <div v-if="isLoading" class="floating-chat-messages__loading">
            {{ $t("chat.loading") }}
          </div>

          <div
              v-for="(m, idx) in messages"
              :key="m.id ?? m.localId ?? idx"
              class="floating-chat-message"
              :class="{
              'floating-chat-message_client': m.sender === 'client',
              'floating-chat-message_owner': m.sender === 'owner'
            }"
          >
            <div class="floating-chat-message__bubble" :class="{ 'floating-chat-message__bubble_pending': !!m.pending }">
              <div class="floating-chat-message__text">{{ m.text }}</div>
              <div class="floating-chat-message__meta">
                <span>{{ normalizeTime(m.createdAt) }}</span>
                <span v-if="m.pending" class="floating-chat-message__pending">…</span>
              </div>
            </div>
          </div>
        </div>

        <footer class="floating-chat-footer">
          <div v-if="flowMode === 'choose'" class="floating-chat-choice">
            <div class="floating-chat-choice__text">
              Выберите, где удобнее общаться:
            </div>

            <div class="floating-chat-choice__actions">
              <custom-button class="floating-chat-choice__button" :variant="'primary'" @click="chooseSite">
                Остаться на сайте
              </custom-button>

              <custom-button class="floating-chat-choice__button" :variant="'secondary'" @click="chooseTelegram">
                Перейти в Telegram
              </custom-button>
            </div>
          </div>

          <div v-else-if="flowMode === 'closed'" class="floating-chat-closed">
            <custom-button class="floating-chat-closed__button" :variant="'primary'" @click="startNewSession">
              Начать новый диалог
            </custom-button>
          </div>

          <div v-else class="floating-chat-input">
            <div class="floating-chat-input__row" @keydown.enter.prevent="onEnter">
              <custom-input
                  class="floating-chat-input__text"
                  :model-value="messageText"
                  :placeholder="flowMode === 'telegram' ? '@username' : $t('chat.input.placeholder')"
                  @update:modelValue="(v: string) => (messageText = v)"
              />

              <custom-button
                  class="floating-chat-input__send"
                  :variant="'primary'"
                  :disabled="flowMode === 'telegram' ? !messageText.trim() : !canSend"
                  @click="flowMode === 'telegram' ? submitTelegramUsername() : sendSiteMessage()"
              >
                <u-icon name="i-lucide-send" class="floating-chat-input__send-icon" />
                <span>{{ $t("chat.send") }}</span>
              </custom-button>
            </div>
          </div>
        </footer>
      </div>
    </section>
  </transition>
</template>

<style scoped>
.floating-chat-toggle {
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: 54px;
  height: 54px;
  border-radius: 16px;
  border: 1px solid var(--color-primary-alt);
  background: rgba(14, 12, 21, 0.72);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  color: var(--color-primary);
  transition: transform 0.15s ease, filter 0.2s ease, box-shadow 0.2s ease;
}

.floating-chat-toggle:hover {
  filter: brightness(1.08);
  box-shadow: var(--shadow-primary);
}

.floating-chat-toggle:active {
  transform: translateY(1px);
}

.floating-chat-toggle__icon {
  width: 22px;
  height: 22px;
}

.floating-chat-toggle__unread {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--color-secondary);
  box-shadow: 0 0 0 4px rgba(205, 153, 255, 0.18);
}

.floating-chat-panel {
  position: fixed;
  right: 22px;
  bottom: 90px;
  width: min(420px, calc(100vw - 44px));
  height: min(560px, calc(100vh - 140px));
  border-radius: 18px;
  padding: 1.5px;
  background: var(--color-primary-gradient);
  z-index: 50;
  box-shadow: var(--shadow-primary);
}

.floating-chat-panel__inner {
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(14, 12, 21, 0.92);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
}

.light .floating-chat-panel__inner {
  background: rgba(255, 255, 255, 0.82);
}

.light .floating-chat-toggle {
  background: rgba(255, 255, 255, 0.82);
}

.floating-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--ui-border);
}

.floating-chat-header__left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.floating-chat-header__title {
  font-weight: 800;
  color: var(--color-white);
}

.floating-chat-header__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 800;
  color: var(--ui-text-muted);
}

.floating-chat-header__status_connected {
  color: var(--color-secondary);
}

.floating-chat-header__status-icon {
  width: 14px;
  height: 14px;
  opacity: 0.9;
}

.floating-chat-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.floating-chat-header__action {
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.floating-chat-header__action-icon {
  width: 18px;
  height: 18px;
}

.floating-chat-header__close {
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.floating-chat-header__close-icon {
  width: 18px;
  height: 18px;
}

.floating-chat-messages {
  flex: 1 1 auto;
  overflow: auto;
  padding: 14px;
}

.floating-chat-messages__loading {
  font-size: 12px;
  font-weight: 800;
  color: var(--ui-text-muted);
  padding: 10px 0;
}

.floating-chat-message {
  display: flex;
  margin: 8px 0;
}

.floating-chat-message_client {
  justify-content: flex-end;
}

.floating-chat-message_owner {
  justify-content: flex-start;
}

.floating-chat-message__bubble {
  max-width: 82%;
  border-radius: 14px;
  padding: 10px 12px 8px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.floating-chat-message__bubble_pending {
  opacity: 0.75;
}

.floating-chat-message_client .floating-chat-message__bubble {
  background: rgba(128, 90, 245, 0.16);
  border-color: rgba(205, 153, 255, 0.22);
}

.light .floating-chat-message__bubble {
  background: rgba(0, 0, 0, 0.03);
}

.light .floating-chat-message_client .floating-chat-message__bubble {
  background: rgba(128, 90, 245, 0.10);
}

.floating-chat-message__text {
  color: var(--color-white);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.35;
}

.floating-chat-message__meta {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  color: var(--ui-text-muted);
}

.floating-chat-message__pending {
  opacity: 0.9;
}

.floating-chat-footer {
  padding: 12px 12px 12px;
  border-top: 1px solid var(--ui-border);
}

.floating-chat-choice {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.floating-chat-choice__text {
  font-size: 12px;
  font-weight: 800;
  color: var(--ui-text-muted);
}

.floating-chat-choice__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.floating-chat-closed {
  display: flex;
}

.floating-chat-closed__button {
  width: 100%;
}

.floating-chat-input {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.floating-chat-input__row {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 10px;
  align-items: end;
}

.floating-chat-input__send-icon {
  width: 16px;
  height: 16px;
}

.floating-chat-animation-enter-active,
.floating-chat-animation-leave-active {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.floating-chat-animation-enter-from,
.floating-chat-animation-leave-to {
  transform: translateY(10px) scale(0.98);
  opacity: 0;
}

@media (max-width: 520px) {
  .floating-chat-panel {
    right: 12px;
    bottom: 82px;
    width: calc(100vw - 24px);
    height: calc(100vh - 120px);
  }

  .floating-chat-toggle {
    right: 12px;
    bottom: 12px;
  }

  .floating-chat-input__row {
    grid-template-columns: 1fr;
  }

  .floating-chat-choice__actions {
    grid-template-columns: 1fr;
  }
}
</style>