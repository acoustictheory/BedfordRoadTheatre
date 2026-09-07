import {
  getApps,
  getApp,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getMessaging, getToken, isSupported as isMessagingSupported, onMessage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  addDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
const app = getApps().length ? getApp() : initializeApp(BRM_CONFIG.FIREBASE),
  auth = getAuth(app),
  db = getFirestore(app);
let productionId,
  userId,
  rooms = [],
  activeRoom,
  stopMessages,
  stopReads,
  stopReactions,
  stopTyping,
  activeMessages = [],
  roomReads = new Map(),
  messageReactions = new Map(),
  typingMembers = new Map(),
  people = new Map(),
  listReadCache = new Map(),
  replyingTo = null,
  messageSearch = "",
  typingTimer,
  lastTypingWrite = 0;
let foregroundMessagingStarted = false;
const chatBackgrounds = [
  ["room", "Space theme", "Theatre & fantasy"], ["royal-villain", "Royal Villain", "Theatre & fantasy"],
  ["enchanted-stage", "Enchanted Stage", "Theatre & fantasy"], ["dragon-fire", "Dragon Fire", "Theatre & fantasy"],
  ["auradon-castle", "Royal Academy", "Theatre & fantasy"], ["isle-graffiti", "Island Graffiti", "Theatre & fantasy"],
  ["magic-mirror", "Magic Mirror", "Theatre & fantasy"], ["spotlight-score", "Spotlight Score", "Theatre & fantasy"],
  ["red-curtain", "Red Curtain", "Theatre & fantasy"],
  ["spring-opening-night", "Spring Opening Night", "Seasonal celebrations"], ["summer-showtime", "Summer Showtime", "Seasonal celebrations"],
  ["autumn-playbill", "Autumn Playbill", "Seasonal celebrations"], ["winter-gala", "Winter Gala", "Seasonal celebrations"],
  ["symphony-night", "Symphony Night", "Music collection"], ["piano-nocturne", "Piano Nocturne", "Music collection"],
  ["jazz-stage", "Jazz Stage", "Music collection"], ["choral-harmony", "Choral Harmony", "Music collection"],
];
const esc = (v) => BRM.escape(String(v ?? "")),
  roomPalette = [
    "#9b1c31",
    "#6d4aff",
    "#087f8c",
    "#cc6b18",
    "#28784a",
    "#b22a8f",
    "#3467c7",
    "#7a4b24",
    "#c23b52",
    "#5751a8",
    "#14756d",
    "#a85414",
    "#477a27",
    "#943c86",
    "#246c9e",
    "#765617",
    "#ad2f74",
    "#536f38",
  ],
  roomColor = (room) => {
    if (/^#[0-9a-f]{6}$/i.test(room?.groupColor || "")) return room.groupColor;
    const key = String(room?.id || room?.title || "group");
    return roomPalette[
      [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        roomPalette.length
    ];
  },
  roomIcon = (room) => {
    if (String(room?.groupIcon || "").trim())
      return String(room.groupIcon).trim().slice(0, 4);
    const key = `${room?.sourceId || ""} ${room?.title || ""}`.toLowerCase();
    if (key.includes("musical theatre") || key.includes("theatre arts"))
      return "🎭";
    if (key.includes("pit orchestra")) return "🎼";
    if (
      key.includes("general cast") ||
      key.includes("principal") ||
      key.includes("ensemble")
    )
      return "🎤";
    if (key.includes("choreograph")) return "💃";
    if (key.includes("featured dancer")) return "✨";
    if (key.includes("stage management")) return "📋";
    if (key.includes("stage crew") || key.includes("stage hand")) return "🎬";
    if (key.includes("light")) return "💡";
    if (key.includes("sound")) return "🎧";
    if (key.includes("prop")) return "🗝";
    if (key.includes("scenic painting")) return "🎨";
    if (
      key.includes("set design") ||
      key.includes("set crew") ||
      key.includes("sets")
    )
      return "🏗";
    if (key.includes("hair") || key.includes("makeup")) return "💄";
    if (key.includes("wardrobe")) return "🧵";
    if (key.includes("costume")) return "👗";
    if (key.includes("projection") || key.includes("video")) return "📽";
    if (key.includes("photo")) return "📷";
    if (key.includes("ticket") || key.includes("box office")) return "🎟";
    if (key.includes("front of house") || key.includes("usher")) return "🚪";
    if (
      key.includes("publicity") ||
      key.includes("marketing") ||
      key.includes("pr &")
    )
      return "📣";
    return room?.type === "direct" ? "💬" : "🎭";
  },
  roomSecondaryColor = (room) =>
    /^#[0-9a-f]{6}$/i.test(room?.groupSecondaryColor || "")
      ? room.groupSecondaryColor
      : roomColor(room),
  person = (id) =>
    people.get(String(id)) || { displayName: "Member", photoURL: "" },
  personAvatar = (id, size = "small") => {
    const profile = person(id);
    return BRM.avatar(profile.displayName, profile.photoURL, size);
  },
  roomAvatar = (room, className = "conversation-dot") => {
    const color = roomColor(room),
      image = String(room?.groupImage || "");
    return `<span class="${className} ${room?.type === "space" ? "space-dot" : ""}" style="--room-accent:${color}">${image.startsWith("data:image/") ? `<img src="${esc(image)}" alt="">` : roomIcon(room)}</span>`;
  },
  clock = (v) => {
    const d = v?.toDate?.() || new Date(v || 0);
    return d.getTime()
      ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "";
  };
async function attachDevice() {
  const id =
    new URLSearchParams(location.search).get("appInstall") ||
    localStorage.getItem("brmAppInstall");
  if (!id || !auth.currentUser) return;
  localStorage.setItem("brmAppInstall", id);
  await fetch(BRM_CONFIG.FIREBASE_COMMUNICATION_DEVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
    },
    body: JSON.stringify({ installId: id }),
  }).catch(() => {});
}
function webInstallId() {
  let id = localStorage.getItem("brmWebInstallId");
  if (!/^[a-f0-9-]{20,100}$/i.test(id || "")) {
    id = crypto.randomUUID();
    localStorage.setItem("brmWebInstallId", id);
  }
  return id;
}
async function enableDesktopNotifications() {
  if (!(await isMessagingSupported()) || !("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Desktop notifications are not supported by this browser.");
  if (await Notification.requestPermission() !== "granted") throw new Error("Notifications were not allowed. Enable them in this site's browser settings, then try again.");
  const registration = await navigator.serviceWorker.ready, messaging = getMessaging(app), options = { serviceWorkerRegistration: registration }, vapidKey = String(BRM_CONFIG.FIREBASE_WEB_PUSH_VAPID_KEY || "").trim();
  if (vapidKey) options.vapidKey = vapidKey;
  const token = await getToken(messaging, options);
  if (!token) throw new Error("The browser did not return a notification token. Try refreshing this page.");
  const installId = webInstallId(), endpoint = BRM_CONFIG.FIREBASE_COMMUNICATION_DEVICE_URL;
  let response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ installId, token, platform: "web" }) });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not register this browser.");
  response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }, body: JSON.stringify({ installId, notifications: true, bubbles: false }) });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not connect notifications to your account.");
  if (!foregroundMessagingStarted) {
    foregroundMessagingStarted = true;
    onMessage(messaging, payload => BRM.toast(`${payload.data?.senderName || "New message"}: ${payload.data?.body || "Open Community to read it."}`, "info"));
  }
}
function backgroundKey() { return `brmChatBackground.${activeRoom?.id || "default"}`; }
function applyChatBackground() {
  const host = document.querySelector("[data-communications]");
  if (host) host.dataset.chatBackground = localStorage.getItem(backgroundKey()) || "room";
}
function chooseChatBackground() {
  if (!activeRoom) return BRM.toast("Choose a conversation first.", "info");
  const selected = localStorage.getItem(backgroundKey()) || "room",
    categories = [...new Set(chatBackgrounds.map(([, , category]) => category))],
    choices = categories.map(category => `<section class="chat-background-section"><h3>${category}</h3><div class="chat-background-grid">${chatBackgrounds.filter(([, , group]) => group === category).map(([id, label]) => `<button type="button" class="chat-background-choice ${id === selected ? "selected" : ""}" data-background="${id}"><span data-preview="${id}"></span><strong>${label}</strong></button>`).join("")}</div></section>`).join(""),
    modal = BRM.openModal(`<span class="eyebrow">Chat appearance</span><h2>Choose a background</h2><p class="field-help">Your choice is saved separately for this conversation.</p><div class="chat-background-library">${choices}</div>`);
  modal.querySelectorAll("[data-background]").forEach(button => button.onclick = () => { localStorage.setItem(backgroundKey(), button.dataset.background); applyChatBackground(); modal.closeModal(); });
}
function roomTile(r) {
  return `<button class="conversation-row ${r.id === activeRoom?.id ? "active" : ""}" data-group-theme="${esc(r.groupTheme || "aurora")}" style="--room-accent:${roomColor(r)};--room-secondary:${roomSecondaryColor(r)}" data-room="${esc(r.id)}">${roomAvatar(r)}<span><strong>${esc(r.title || "Conversation")}</strong><small style="display:block">${esc(r.lastMessage || r.description || "Official group space")}</small></span>${r.unreadCount ? `<span class="unread-pill">${r.unreadCount}</span>` : '<span class="room-chevron">›</span>'}</button>`;
}
function renderRooms() {
  const host = document.querySelector("[data-room-list]"),
    search = (
      document.querySelector("[data-room-search]")?.value || ""
    ).toLowerCase(),
    visible = rooms.filter(
      (r) =>
        !search || `${r.title} ${r.lastMessage}`.toLowerCase().includes(search),
    ),
    classes = visible.filter(
      (r) => r.type === "space" && r.category === "class",
    ),
    ensembles = visible.filter(
      (r) => r.type === "space" && r.category === "ensemble",
    ),
    production = visible.filter(
      (r) => r.type === "space" && r.category === "production",
    ),
    chats = visible.filter((r) => r.type !== "space"),
    unread = rooms.reduce((n, r) => n + (r.unreadCount || 0), 0),
    section = (icon, title, subtitle, list) =>
      list.length
        ? `<div class="comm-section-title"><span>${icon}</span><div><strong>${title}</strong><small>${subtitle}</small></div></div><div class="space-stack">${list.map(roomTile).join("")}</div>`
        : "";
  document.querySelector("[data-unread-total]").textContent = unread
    ? `${unread} unread message${unread === 1 ? "" : "s"}`
    : "Inbox is caught up";
  host.innerHTML = visible.length
    ? `${section("◆", "Classes", "Musical Theatre and Theatre Arts", classes)}${section("♪", "Ensembles", "Cast, orchestra, choreography and featured dancers", ensembles)}${section("◇", "Production Team", "Stage management, design and technical crews", production)}${section("●", "Conversations", "Administrator-created chats", chats)}`
    : '<div class="empty-chat">No matching conversations.</div>';
  host
    .querySelectorAll("[data-room]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openRoom(rooms.find((r) => r.id === b.dataset.room))),
    );
}
function renderActiveMessages() {
  const stream = document.querySelector("[data-messages]");
  if (!stream) return;
  const nearBottom =
      stream.scrollHeight - stream.scrollTop - stream.clientHeight < 90,
    previousHeight = stream.scrollHeight,
    visibleMessages = messageSearch
      ? activeMessages.filter((message) =>
          `${message.senderName || ""} ${message.text || ""}`
            .toLowerCase()
            .includes(messageSearch),
        )
      : activeMessages;
  stream.innerHTML = visibleMessages.length
    ? visibleMessages
        .map((message) => {
          const mine = message.senderId === userId,
            messageTime = message.createdAt?.seconds || 0,
            seenBy = (activeRoom?.memberIds || []).filter(
              (id) =>
                id !== message.senderId &&
                (roomReads.get(id)?.lastReadAt?.seconds || 0) >= messageTime,
            ),
            receipts = seenBy.length
              ? `<button type="button" class="message-seen" data-seen-message="${esc(message.id)}" title="See read details"><span>Seen</span>${seenBy
                  .slice(0, 8)
                  .map((id) => personAvatar(id, "small"))
                  .join(
                    "",
                  )}${seenBy.length > 8 ? `<b>+${seenBy.length - 8}</b>` : ""}</button>`
              : mine
                ? '<div class="message-seen pending"><span>Sent</span></div>'
                : "";
          const groupedReactions = new Map();
          for (const reaction of messageReactions.get(message.id) || []) {
            if (!groupedReactions.has(reaction.emoji))
              groupedReactions.set(reaction.emoji, []);
            groupedReactions.get(reaction.emoji).push(reaction.userId);
          }
          const reactions = groupedReactions.size
            ? `<div class="reaction-summary">${[...groupedReactions].map(([emoji, users]) => `<button type="button" class="reaction-chip ${users.includes(userId) ? "mine" : ""}" data-react-message="${esc(message.id)}" data-react-emoji="${esc(emoji)}" title="${users.map((id) => esc(person(id).displayName)).join(", ")}"><span>${emoji}</span><b>${users.length}</b></button>`).join("")}</div>`
            : "";
          const reply = message.replyTo?.text
            ? `<div class="message-reply-quote"><strong>${esc(message.replyTo.senderName || "Member")}</strong><span>${esc(message.replyTo.text)}</span></div>`
            : "";
          return `<div class="message-row ${mine ? "mine" : ""}" data-message-id="${esc(message.id)}">${mine ? "" : personAvatar(message.senderId)}<div class="message-stack"><article class="message ${mine ? "mine" : ""} ${message.pinned ? "pinned" : ""}">${reply}<div class="message-meta">${message.pinned ? "📌 " : ""}${esc(message.senderName || person(message.senderId).displayName)} · ${clock(message.createdAt)}</div><div>${esc(message.text).replace(/\n/g, "<br>")}</div></article>${reactions}<div class="message-actions"><button type="button" data-reply-message="${esc(message.id)}">↩ Reply</button><span class="quick-reactions">${["👍", "❤️", "😂", "🎭"].map((emoji) => `<button type="button" data-react-message="${esc(message.id)}" data-react-emoji="${emoji}">${emoji}</button>`).join("")}</span><button type="button" data-copy-message="${esc(message.id)}">Copy</button>${BRM.isAdmin() ? `<button type="button" data-pin-message="${esc(message.id)}">${message.pinned ? "Unpin" : "Pin"}</button><button type="button" class="danger" data-delete-message="${esc(message.id)}">Delete</button>` : ""}</div>${receipts}</div>${mine ? personAvatar(message.senderId) : ""}</div>`;
        })
        .join("")
    : `<div class="empty-chat">${messageSearch ? "No messages match your search." : "Start the conversation."}</div>`;
  BRM.hydrateProfilePhotos(stream);
  stream.querySelectorAll("[data-seen-message]").forEach(button =>
    button.addEventListener("click", () => showReadDetails(button.dataset.seenMessage)),
  );
  stream.querySelectorAll("[data-reply-message]").forEach((button) =>
    button.addEventListener("click", () => {
      replyingTo = activeMessages.find(
        (message) => message.id === button.dataset.replyMessage,
      );
      renderReplyComposer();
      document.querySelector('.composer textarea[name="message"]')?.focus();
    }),
  );
  stream.querySelectorAll("[data-copy-message]").forEach((button) =>
    button.addEventListener("click", async () => {
      const message = activeMessages.find(
        (item) => item.id === button.dataset.copyMessage,
      );
      if (message) await navigator.clipboard.writeText(message.text || "");
      BRM.toast("Message copied.", "success");
    }),
  );
  stream
    .querySelectorAll("[data-react-message]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        toggleReaction(button.dataset.reactMessage, button.dataset.reactEmoji),
      ),
    );
  stream.querySelectorAll("[data-pin-message]").forEach((button) =>
    button.addEventListener("click", async () => {
      const message = activeMessages.find(
        (item) => item.id === button.dataset.pinMessage,
      );
      if (message)
        await updateDoc(messageDocument(message.id), {
          pinned: !message.pinned,
        });
    }),
  );
  stream.querySelectorAll("[data-delete-message]").forEach((button) =>
    button.addEventListener("click", async () => {
      if (confirm("Permanently delete this message?"))
        await deleteDoc(messageDocument(button.dataset.deleteMessage));
    }),
  );
  renderPinnedMessage();
  if (nearBottom && !messageSearch) stream.scrollTop = stream.scrollHeight;
  else stream.scrollTop += stream.scrollHeight - previousHeight;
}
function showReadDetails(messageId) {
  const message = activeMessages.find(item => item.id === messageId);
  if (!message) return;
  const sentAt = message.createdAt?.seconds || 0,
    readers = (activeRoom?.memberIds || []).filter(id => id !== message.senderId && (roomReads.get(id)?.lastReadAt?.seconds || 0) >= sentAt),
    modal = BRM.openModal(`<span class="eyebrow">Message details</span><h2>Seen by ${readers.length}</h2><div class="seen-detail-list">${readers.length ? readers.map(id => { const read = roomReads.get(id)?.lastReadAt?.toDate?.(); return `<div class="seen-detail-person">${personAvatar(id)}<span><strong>${esc(person(id).displayName)}</strong><small>${read ? `Seen ${read.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "Seen"}</small></span><b>✓✓</b></div>`; }).join("") : "<p>No one has seen this message yet.</p>"}</div>`);
  BRM.hydrateProfilePhotos(modal);
}
function messageDocument(messageId) {
  return doc(
    db,
    "productions",
    productionId,
    "communicationConversations",
    activeRoom.id,
    "messages",
    messageId,
  );
}
async function toggleReaction(messageId, emoji) {
  const reactionRef = doc(
    db,
    "productions",
    productionId,
    "communicationConversations",
    activeRoom.id,
    "reactions",
    `${messageId}_${userId}`,
  );
  const current = (messageReactions.get(messageId) || []).find(
    (reaction) => reaction.userId === userId,
  );
  if (current?.emoji === emoji) await deleteDoc(reactionRef);
  else
    await setDoc(reactionRef, {
      messageId,
      userId,
      emoji,
      updatedAt: serverTimestamp(),
    });
}
function renderPinnedMessage() {
  const host = document.querySelector("[data-pinned-message]");
  if (!host) return;
  const pinned = [...activeMessages]
    .reverse()
    .find((message) => message.pinned);
  host.classList.toggle("hidden", !pinned);
  host.innerHTML = pinned
    ? `<button type="button" data-jump-pinned><span>📌 Pinned by production</span><strong>${esc(pinned.text).slice(0, 150)}</strong></button>`
    : "";
  host
    .querySelector("[data-jump-pinned]")
    ?.addEventListener("click", () =>
      document
        .querySelector(`[data-message-id="${CSS.escape(pinned.id)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
}
function renderTyping() {
  const host = document.querySelector("[data-typing]");
  if (!host) return;
  const now = Date.now(),
    active = [...typingMembers.values()].filter(
      (entry) => entry.userId !== userId && entry.expiresAt?.toMillis?.() > now,
    );
  host.innerHTML = active.length
    ? `<span class="typing-avatars">${active.slice(0, 3).map(entry => personAvatar(entry.userId)).join("")}</span><span>${active.slice(0, 2).map(entry => esc(entry.displayName)).join(" and ")}${active.length > 2 ? ` +${active.length - 2}` : ""} ${active.length === 1 ? "is" : "are"} typing</span><i class="typing-dots"><b></b><b></b><b></b></i>`
    : "";
  if (active.length) BRM.hydrateProfilePhotos(host);
  host.classList.toggle("active", active.length > 0);
}
function typingDocument(roomId = activeRoom?.id) {
  return doc(
    db,
    "productions",
    productionId,
    "communicationConversations",
    roomId,
    "typing",
    userId,
  );
}
async function announceTyping() {
  if (!activeRoom) return;
  const now = Date.now(),
    roomId = activeRoom.id;
  if (now - lastTypingWrite > 1400) {
    lastTypingWrite = now;
    await setDoc(typingDocument(roomId), {
      userId,
      displayName: person(userId).displayName,
      expiresAt: Timestamp.fromMillis(now + 4500),
      updatedAt: serverTimestamp(),
    });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(
    () => deleteDoc(typingDocument(roomId)).catch(() => {}),
    2600,
  );
}
function renderReplyComposer() {
  const host = document.querySelector("[data-reply-preview]");
  if (!host) return;
  host.innerHTML = replyingTo
    ? `<div><strong>Replying to ${esc(replyingTo.senderName || person(replyingTo.senderId).displayName)}</strong><span>${esc(replyingTo.text).slice(0, 120)}</span></div><button type="button" data-cancel-reply aria-label="Cancel reply">×</button>`
    : "";
  host.classList.toggle("hidden", !replyingTo);
  host.querySelector("[data-cancel-reply]")?.addEventListener("click", () => {
    replyingTo = null;
    renderReplyComposer();
  });
}
function openRoom(room) {
  activeRoom = room;
  const communications = document.querySelector("[data-communications]");
  communications.classList.add("chat-open");
  communications.style.setProperty("--room-accent", roomColor(room));
  communications.style.setProperty(
    "--room-secondary",
    roomSecondaryColor(room),
  );
  communications.dataset.groupTheme = room.groupTheme || "aurora";
  applyChatBackground();
  renderRooms();
  document.querySelector("[data-chat-avatar]").outerHTML = roomAvatar(
    room,
    "chat-avatar",
  ).replace('class="chat-avatar', 'data-chat-avatar class="chat-avatar');
  document.querySelector("[data-chat-title]").textContent = room.title;
  document.querySelector("[data-chat-subtitle]").textContent =
    room.type === "direct"
      ? "Private conversation"
      : `${room.memberIds?.length || 0} members · Admin managed`;
  const aestheticButton = document.querySelector("[data-customize-room]");
  if (aestheticButton) aestheticButton.disabled = false;
  stopMessages?.();
  stopReads?.();
  stopReactions?.();
  stopTyping?.();
  activeMessages = [];
  replyingTo = null;
  messageSearch = "";
  const search = document.querySelector("[data-message-search]");
  if (search) search.value = "";
  renderReplyComposer();
  roomReads = new Map();
  messageReactions = new Map();
  typingMembers = new Map();
  stopReads = onSnapshot(
    collection(
      db,
      "productions",
      productionId,
      "communicationConversations",
      room.id,
      "reads",
    ),
    (snapshot) => {
      roomReads = new Map(
        snapshot.docs.map((entry) => [entry.id, entry.data()]),
      );
      if (roomReads.has(userId))
        listReadCache.set(room.id, roomReads.get(userId));
      renderActiveMessages();
    },
  );
  stopReactions = onSnapshot(
    collection(
      db,
      "productions",
      productionId,
      "communicationConversations",
      room.id,
      "reactions",
    ),
    (snapshot) => {
      messageReactions = new Map();
      snapshot.docs.forEach((entry) => {
        const reaction = entry.data(),
          list = messageReactions.get(reaction.messageId) || [];
        list.push(reaction);
        messageReactions.set(reaction.messageId, list);
      });
      renderActiveMessages();
    },
  );
  stopTyping = onSnapshot(
    collection(
      db,
      "productions",
      productionId,
      "communicationConversations",
      room.id,
      "typing",
    ),
    (snapshot) => {
      typingMembers = new Map(
        snapshot.docs.map((entry) => [entry.id, entry.data()]),
      );
      renderTyping();
    },
  );
  stopMessages = onSnapshot(
    query(
      collection(
        db,
        "productions",
        productionId,
        "communicationConversations",
        room.id,
        "messages",
      ),
      orderBy("createdAt", "desc"),
      limit(150),
    ),
    (snap) => {
      activeMessages = snap.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .reverse();
      renderActiveMessages();
      setDoc(
        doc(
          db,
          "productions",
          productionId,
          "communicationConversations",
          room.id,
          "reads",
          userId,
        ),
        {
          lastReadAt: serverTimestamp(),
          lastMessageId: snap.docs.at(-1)?.id || null,
        },
        { merge: true },
      ).catch(() => {});
    },
  );
}

async function optimizeGroupImage(file) {
  if (!file?.type?.startsWith("image/"))
    throw new Error("Choose an image file.");
  const source = await new Promise((resolve, reject) => {
    const image = new Image(),
      url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read."));
    };
    image.src = url;
  });
  const size = 320,
    canvas = document.createElement("canvas"),
    context = canvas.getContext("2d");
  canvas.width = canvas.height = size;
  const scale = Math.max(
      size / source.naturalWidth,
      size / source.naturalHeight,
    ),
    width = source.naturalWidth * scale,
    height = source.naturalHeight * scale;
  context.drawImage(
    source,
    (size - width) / 2,
    (size - height) / 2,
    width,
    height,
  );
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function customizeRoom() {
  if (!activeRoom || !BRM.isAdmin()) return;
  let pendingImage = activeRoom.groupImage || "",
    removeImage = false;
  const modal = BRM.openModal(
    `<span class="eyebrow">Group theme studio</span><h2>${esc(activeRoom.title)}</h2><p>Build a recognizable visual identity for this conversation.</p><div class="group-aesthetic-editor"><div class="group-theme-preview" data-theme-preview data-group-theme="${esc(activeRoom.groupTheme || "aurora")}" style="--room-accent:${roomColor(activeRoom)};--room-secondary:${roomSecondaryColor(activeRoom)}"><div class="group-picture-preview" data-group-preview>${pendingImage ? `<img src="${esc(pendingImage)}" alt="">` : roomIcon(activeRoom)}</div><strong>${esc(activeRoom.title)}</strong><small>Group preview</small></div><div class="group-theme-fields"><div class="grid grid-2"><div class="field"><label>Primary colour</label><input type="color" value="${roomColor(activeRoom)}" data-group-color></div><div class="field"><label>Secondary colour</label><input type="color" value="${roomSecondaryColor(activeRoom)}" data-group-secondary></div></div><div class="grid grid-2"><div class="field"><label>Theme style</label><select data-group-theme><option value="aurora">Aurora glow</option><option value="spotlight">Stage spotlight</option><option value="velvet">Velvet curtain</option><option value="solid">Clean colour</option></select></div><div class="field"><label>Icon identifier</label><input data-group-icon maxlength="4" value="${esc(activeRoom.groupIcon || roomIcon(activeRoom))}" placeholder="🎭"></div></div><div class="group-icon-choices" data-icon-choices>${["🎭", "🎤", "🎼", "💃", "✨", "🎬", "📋", "💡", "🎧", "🎨", "👗", "📣"].map((icon) => `<button type="button" data-icon="${icon}">${icon}</button>`).join("")}</div><div class="form-actions"><label class="button button-secondary">Choose picture<input class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" data-group-image></label><button class="button button-ghost" type="button" data-remove-picture>Use icon instead</button></div><small class="field-hint">Pictures are automatically cropped and optimized to 320 × 320.</small></div></div><div class="form-actions"><button class="button button-primary" data-save-aesthetic>Save group theme</button></div>`,
    { wide: true },
  );
  const preview = modal.querySelector("[data-group-preview]"),
    themePreview = modal.querySelector("[data-theme-preview]"),
    color = modal.querySelector("[data-group-color]"),
    secondary = modal.querySelector("[data-group-secondary]"),
    theme = modal.querySelector("[data-group-theme]"),
    icon = modal.querySelector("[data-group-icon]");
  theme.value = activeRoom.groupTheme || "aurora";
  const updatePreview = () => {
    themePreview.style.setProperty("--room-accent", color.value);
    themePreview.style.setProperty("--room-secondary", secondary.value);
    themePreview.dataset.groupTheme = theme.value;
    if (!pendingImage) preview.textContent = icon.value.trim() || "🎭";
  };
  color.oninput =
    secondary.oninput =
    theme.onchange =
    icon.oninput =
      updatePreview;
  modal.querySelectorAll("[data-icon]").forEach((button) =>
    button.addEventListener("click", () => {
      icon.value = button.dataset.icon;
      pendingImage = "";
      removeImage = true;
      updatePreview();
    }),
  );
  modal.querySelector("[data-group-image]").onchange = async (event) => {
    try {
      pendingImage = await optimizeGroupImage(event.target.files[0]);
      removeImage = false;
      preview.innerHTML = `<img src="${esc(pendingImage)}" alt="">`;
    } catch (error) {
      BRM.toast(error.message, "error");
    }
  };
  modal.querySelector("[data-remove-picture]").onclick = () => {
    pendingImage = "";
    removeImage = true;
    updatePreview();
  };
  modal.querySelector("[data-save-aesthetic]").onclick = async () => {
    const changes = {
      groupColor: color.value,
      groupSecondaryColor: secondary.value,
      groupTheme: theme.value,
      groupIcon: icon.value.trim().slice(0, 4) || "🎭",
      updatedAt: serverTimestamp(),
    };
    if (pendingImage) changes.groupImage = pendingImage;
    else if (removeImage || activeRoom.groupImage) changes.groupImage = "";
    await updateDoc(
      doc(
        db,
        "productions",
        productionId,
        "communicationConversations",
        activeRoom.id,
      ),
      changes,
    );
    activeRoom = { ...activeRoom, ...changes };
    openRoom(activeRoom);
    modal.closeModal();
    BRM.toast("Group appearance updated.", "success");
  };
}
async function send(e) {
  e.preventDefault();
  if (!activeRoom) return;
  const box = e.currentTarget.elements.message,
    text = box.value.trim();
  if (!text) return;
  box.value = "";
  const senderName =
    BRM.context?.profile?.DisplayName || BRM.context?.username || "Member";
  const replyTo = replyingTo
    ? {
        messageId: replyingTo.id,
        senderId: replyingTo.senderId,
        senderName:
          replyingTo.senderName || person(replyingTo.senderId).displayName,
        text: String(replyingTo.text || "").slice(0, 180),
      }
    : null;
  replyingTo = null;
  renderReplyComposer();
  clearTimeout(typingTimer);
  deleteDoc(typingDocument()).catch(() => {});
  await addDoc(
    collection(
      db,
      "productions",
      productionId,
      "communicationConversations",
      activeRoom.id,
      "messages",
    ),
    {
      senderId: userId,
      senderName,
      text,
      ...(replyTo ? { replyTo } : {}),
      createdAt: serverTimestamp(),
    },
  );
  await updateDoc(
    doc(
      db,
      "productions",
      productionId,
      "communicationConversations",
      activeRoom.id,
    ),
    {
      lastMessage: text.slice(0, 180),
      lastMessageAt: serverTimestamp(),
      lastSenderId: userId,
      updatedAt: serverTimestamp(),
    },
  );
}
async function createRoom() {
  const profiles = (await getDocs(collection(db, "profiles"))).docs.map((d) =>
      d.data(),
    ),
    users = (await getDocs(collection(db, "users"))).docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => String(u.status ?? u.Status).toLowerCase() === "active"),
    names = new Map(
      profiles.map((p) => [
        p.userID || p.UserID,
        p.displayName || p.DisplayName,
      ]),
    );
  const modal = BRM.openModal(
    `<span class="eyebrow">Administrator only</span><h2>New conversation</h2><form data-room-form><div class="field"><label>Name</label><input name="title" required maxlength="100"></div><div class="field"><label>Type</label><select name="type"><option value="group">Group</option><option value="direct">Private student conversation</option><option value="broadcast">Announcement channel</option></select></div><div class="field"><label>Members</label><div style="max-height:280px;overflow:auto">${users
      .filter((u) => u.id !== userId)
      .map(
        (u) =>
          `<label class="checkbox-row"><input type="checkbox" name="members" value="${esc(u.id)}"> ${esc(names.get(u.id) || u.username)}</label>`,
      )
      .join(
        "",
      )}</div></div><div class="form-actions"><button class="button button-primary">Create conversation</button></div></form>`,
    { wide: true },
  );
  modal.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      members = [...new Set([userId, ...f.getAll("members")])];
    await addDoc(
      collection(db, "productions", productionId, "communicationConversations"),
      {
        title: String(f.get("title")).trim(),
        type: f.get("type"),
        memberIds: members,
        adminIds: [userId],
        createdBy: userId,
        status: "Active",
        groupColor: roomPalette[Math.floor(Math.random() * roomPalette.length)],
        groupSecondaryColor:
          roomPalette[Math.floor(Math.random() * roomPalette.length)],
        groupTheme: "aurora",
        groupIcon: "💬",
        lastMessage: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    );
    modal.closeModal();
    BRM.toast("Conversation created.");
  };
}
async function reconcile(assignments) {
  const response = await fetch(BRM_CONFIG.FIREBASE_COMMUNICATION_GROUPS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
      },
      body: JSON.stringify({ productionId, assignments }),
    }),
    result = await response.json();
  if (!response.ok || !result.success)
    throw new Error(result.error || "Spaces could not synchronize.");
  return result;
}
async function manageSpaces() {
  const [profilesSnap, usersSnap, assignmentSnap] = await Promise.all([
      getDocs(collection(db, "profiles")),
      getDocs(collection(db, "users")),
      getDocs(
        collection(db, "productions", productionId, "communicationAssignments"),
      ),
    ]),
    profiles = profilesSnap.docs.map((d) => d.data()),
    names = new Map(
      profiles.map((p) => [
        p.userID || p.UserID,
        p.displayName || p.DisplayName,
      ]),
    ),
    users = usersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter(
        (u) =>
          String(u.status ?? u.Status).toLowerCase() === "active" &&
          String(u.isFullAdmin ?? u.IsFullAdmin).toLowerCase() !== "true",
      ),
    assignmentMap = new Map(
      assignmentSnap.docs.map((d) => [
        d.id,
        [
          ...new Set(
            (d.data().spaceKeys || []).map((key) =>
              key.startsWith("musical-theatre-")
                ? "musical-theatre"
                : key.startsWith("theatre-arts-")
                  ? "theatre-arts"
                  : key,
            ),
          ),
        ],
      ]),
    ),
    fixed = [
      ["musical-theatre", "Musical Theatre 10/20/30"],
      ["theatre-arts", "Theatre Arts 20/30"],
      ["choreography", "Choreography"],
      ["featured-dancers", "Featured Dancers"],
      ["pit-orchestra", "Pit Orchestra"],
      ["stage-crew", "Stage Crew & Stage Hands"],
      ["scenic-painting", "Scenic Painting"],
      ["hair-makeup", "Hair & Makeup"],
      ["projections-video", "Projections & Video"],
      ["photography-videography", "Photography & Videography"],
      ["tickets-box-office", "Tickets & Box Office"],
      ["wardrobe-crew", "Wardrobe Crew"],
    ];
  let selected = fixed[0][0];
  const modal = BRM.openModal(
      `<span class="eyebrow">Automatic membership</span><h2>Manage class & ensemble Spaces</h2><p>Production Team and department-based Ensemble Spaces follow People & Access automatically. Use this for classes, choreography and featured dancers.</p><div class="field"><label>Space</label><select data-space>${fixed.map(([id, title]) => `<option value="${id}">${title}</option>`).join("")}</select></div><div class="member-picker" data-members></div><div class="form-actions"><button class="button button-primary" data-save>Save membership</button></div>`,
      { wide: true },
    ),
    render = () => {
      modal.querySelector("[data-members]").innerHTML = users
        .map(
          (u) =>
            `<label class="checkbox-row"><input type="checkbox" value="${esc(u.id)}" ${(assignmentMap.get(u.id) || []).includes(selected) ? "checked" : ""}> ${esc(names.get(u.id) || u.username)}</label>`,
        )
        .join("");
    };
  modal.querySelector("[data-space]").onchange = (e) => {
    selected = e.target.value;
    render();
  };
  modal.querySelector("[data-save]").onclick = async () => {
    const chosen = new Set(
        [...modal.querySelectorAll("[data-members] input:checked")].map(
          (i) => i.value,
        ),
      ),
      assignments = users.map((u) => ({
        userId: u.id,
        spaceKeys: [
          ...(assignmentMap.get(u.id) || []).filter((k) => k !== selected),
          ...(chosen.has(u.id) ? [selected] : []),
        ],
      }));
    await reconcile(assignments);
    modal.closeModal();
    BRM.toast("Space membership synchronized.");
  };
  render();
}
async function settings() {
  const ref = doc(
      db,
      "productions",
      productionId,
      "communicationSettings",
      userId,
    ),
    current = (await getDoc(ref)).data() || {},
    modal = BRM.openModal(
      `<span class="eyebrow">Community notifications</span><h2>Conversation settings</h2><form><label class="checkbox-row"><input type="checkbox" name="notifications" ${current.notifications !== false ? "checked" : ""}> Message notifications</label><label class="checkbox-row"><input type="checkbox" name="bubbles" ${current.bubbles !== false ? "checked" : ""}> Android conversation bubbles</label><button type="button" class="button button-secondary desktop-notification-button" data-enable-desktop>Enable desktop notifications</button><small class="field-help" data-notification-status>${typeof Notification === "undefined" ? "This browser does not support notifications." : Notification.permission === "granted" ? "Desktop notifications are allowed on this browser." : "Allow this browser to notify you when Community is closed."}</small><div class="form-actions"><button class="button button-primary">Save</button></div></form>`,
    );
  modal.querySelector("[data-enable-desktop]").onclick = async (event) => {
    const button = event.currentTarget, status = modal.querySelector("[data-notification-status]");
    button.disabled = true;
    status.textContent = "Connecting this browser securely…";
    try {
      await enableDesktopNotifications();
      status.textContent = "Desktop notifications are connected to your Bedford account.";
      BRM.toast("Desktop notifications enabled.");
    } catch (error) {
      status.textContent = error.message;
      BRM.toast(error.message, "error");
    } finally { button.disabled = false; }
  };
  modal.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      preferences = {
        notifications: f.has("notifications"),
        bubbles: f.has("bubbles"),
      };
    await setDoc(
      ref,
      { ...preferences, updatedAt: serverTimestamp() },
      { merge: true },
    );
    const id = localStorage.getItem("brmAppInstall");
    if (id)
      await fetch(BRM_CONFIG.FIREBASE_COMMUNICATION_DEVICE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
        },
        body: JSON.stringify({ installId: id, ...preferences }),
      }).catch(() => {});
    modal.closeModal();
    BRM.toast("Settings saved.");
  };
}
document.addEventListener("DOMContentLoaded", () =>
  BRM.initPrivatePage(async (context) => {
    await auth.authStateReady();
    if (!auth.currentUser)
      throw new Error(
        "Secure messaging session unavailable. Sign out and sign in again.",
      );
    userId = String(context.userId || auth.currentUser.uid);
    productionId = context.production?.ProductionID;
    if (!productionId) throw new Error("Active production unavailable.");
    const currentProfile = context.profile || {};
    people.set(String(userId), {
      displayName: currentProfile.DisplayName || context.username || "Member",
      photoURL: currentProfile.PhotoURL || "",
    });
    getDocs(collection(db, "profiles"))
      .then((profileSnapshot) => {
        people = new Map([
          ...people,
          ...profileSnapshot.docs.map((entry) => {
            const profile = entry.data(),
              id = profile.userID || profile.UserID || entry.id;
            return [
              String(id),
              {
                displayName:
                  profile.displayName ||
                  profile.DisplayName ||
                  `${profile.firstName || profile.FirstName || ""} ${profile.lastName || profile.LastName || ""}`.trim() ||
                  "Member",
                photoURL:
                  profile.photoURL ||
                  profile.PhotoURL ||
                  (profile.photoFileID || profile.PhotoFileID
                    ? `drivefile:${profile.photoFileID || profile.PhotoFileID}`
                    : ""),
              },
            ];
          }),
        ]);
        renderActiveMessages();
      })
      .catch(() => {});
    document.querySelector("#app-main").innerHTML =
      `<header class="community-header"><div><span class="eyebrow">BEDFORD COMMUNITY</span><h1>Community Messages</h1><p>${BRM.isAdmin() ? "Admin view · all assigned Spaces" : "Spaces and administrator conversations"}</p></div><div class="community-actions"><button class="icon-button" data-settings title="Notification settings">⚙</button>${BRM.isAdmin() ? '<button class="icon-button" data-manage title="Manage automatic Spaces">♚</button><button class="icon-button" data-new title="New conversation">＋</button>' : ""}</div></header><section class="panel communications" data-communications><aside class="conversation-list"><div class="conversation-list-head"><div class="unread-overview"><span class="unread-orbit">✓</span><div><strong data-unread-total>Inbox is caught up</strong><small>Official messages for your production</small></div></div><input class="search-input" data-room-search placeholder="Search Spaces and conversations"></div><div data-room-list></div></aside><section class="chat-pane"><header class="chat-head"><button class="button button-ghost button-small comm-mobile-back" data-back>‹ Messages</button><span class="chat-avatar" data-chat-avatar>🎭</span><div class="chat-identity"><strong data-chat-title>Select a conversation</strong><small data-chat-subtitle style="display:block"></small></div><input class="chat-message-search" data-message-search type="search" placeholder="Search messages" aria-label="Search this conversation">${BRM.isAdmin() ? '<button class="icon-button chat-aesthetic-button" data-customize-room title="Edit group theme, icon and picture" disabled>✦</button>' : ""}</header><div class="pinned-message hidden" data-pinned-message></div><div class="message-stream" data-messages><div class="empty-chat"><span class="empty-chat-icon">●</span><strong>Your Bedford community</strong><small>Choose a Space to begin.</small></div></div><form class="composer"><div class="typing-indicator" data-typing></div><div class="reply-preview hidden" data-reply-preview></div><button type="button" class="composer-plus" title="Attachments coming next">＋</button><textarea name="message" maxlength="4000" placeholder="Message this Space…" required></textarea><button class="send-button" aria-label="Send">➤</button></form></section></section>`;
    document.querySelector("[data-message-search]").insertAdjacentHTML("afterend", '<button class="icon-button chat-background-button" data-chat-background title="Choose your chat background">▦</button>');
    document.querySelector(".composer").onsubmit = send;
    document.querySelector('.composer textarea[name="message"]').oninput =
      announceTyping;
    document.querySelector("[data-back]").onclick = () =>
      document
        .querySelector("[data-communications]")
        .classList.remove("chat-open");
    document.querySelector("[data-settings]").onclick = settings;
    document.querySelector("[data-chat-background]").onclick = chooseChatBackground;
    document.querySelector("[data-room-search]").oninput = renderRooms;
    document.querySelector("[data-message-search]").oninput = (event) => {
      messageSearch = event.target.value.trim().toLowerCase();
      renderActiveMessages();
    };
    document.querySelector("[data-new]")?.addEventListener("click", createRoom);
    document
      .querySelector("[data-customize-room]")
      ?.addEventListener("click", customizeRoom);
    document
      .querySelector("[data-manage]")
      ?.addEventListener("click", manageSpaces);
    await attachDevice();
    if (BRM.isAdmin())
      reconcile()
        .then((r) =>
          BRM.toast(`${r.spaces} automatic Spaces are synchronized.`, "info"),
        )
        .catch((e) => BRM.toast(e.message, "error"));
    onSnapshot(
      query(
        collection(
          db,
          "productions",
          productionId,
          "communicationConversations",
        ),
        where("memberIds", "array-contains", userId),
      ),
      async (snap) => {
        rooms = await Promise.all(
          snap.docs.map(async (d) => {
            const room = { id: d.id, ...d.data() },
              read = listReadCache.has(d.id)
                ? listReadCache.get(d.id)
                : (
                    await getDoc(
                      doc(
                        db,
                        "productions",
                        productionId,
                        "communicationConversations",
                        d.id,
                        "reads",
                        userId,
                      ),
                    )
                  ).data();
            listReadCache.set(d.id, read || {});
            room.unreadCount =
              room.lastSenderId !== userId &&
              (room.lastMessageAt?.seconds || 0) >
                (read?.lastReadAt?.seconds || 0)
                ? 1
                : 0;
            return room;
          }),
        );
        const supersededClassSpaces = new Set([
          "musical-theatre-10",
          "musical-theatre-20",
          "musical-theatre-30",
          "theatre-arts-20",
          "theatre-arts-30",
        ]);
        rooms = rooms
          .filter(
            (r) =>
              String(r.status || "Active").toLowerCase() === "active" &&
              !supersededClassSpaces.has(String(r.sourceId || "")) &&
              ![...supersededClassSpaces].some((key) =>
                String(r.id).endsWith(`assignment-${key}`),
              ),
          )
          .sort(
            (a, b) =>
              (b.lastMessageAt?.seconds || b.updatedAt?.seconds || 0) -
              (a.lastMessageAt?.seconds || a.updatedAt?.seconds || 0),
          );
        renderRooms();
        const wanted = new URLSearchParams(location.search).get("conversation"),
          room = rooms.find((r) => r.id === wanted);
        if (room && !activeRoom) openRoom(room);
      },
    );
  }),
);
