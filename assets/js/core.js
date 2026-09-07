window.BRM = window.BRM || {};

(function (BRM) {
  const CONFIG = window.BRM_CONFIG;
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !viewport.content.includes("viewport-fit=cover")) {
    viewport.content = `${viewport.content},viewport-fit=cover`;
  }
  BRM.context = null;
  BRM.BUILD_ID = CONFIG.BUILD_ID || "bedford-frontend";
  BRM.escape = (value) =>
    String(value ?? "").replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );
  BRM.titleCase = (value) =>
    String(value || "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  BRM.formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat("en-CA", {
          dateStyle: "medium",
          timeZone: "America/Regina",
        }).format(new Date(value))
      : "—";
  BRM.formatDateTime = (value) =>
    value
      ? new Intl.DateTimeFormat("en-CA", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/Regina",
        }).format(new Date(value))
      : "—";
  BRM.initials = (name) =>
    String(name || "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase();
  BRM.hasPermission = (key) =>
    Boolean(
      BRM.context?.permissions?.includes("admin.all") ||
      BRM.context?.permissions?.includes(key),
    );
  BRM.isAdmin = () => {
    let stored = null;

    try {
      stored = JSON.parse(sessionStorage.getItem("brmContext") || localStorage.getItem("brmContext") || "null");
    } catch {}

    const context = BRM.context || stored || {};
    const value = context.isAdmin;
    const normalizedAdminFlag =
      value === true ||
      String(value || "").toLowerCase() === "true" ||
      String(value || "").toUpperCase() === "TRUE";

    return Boolean(
      normalizedAdminFlag ||
      context.permissions?.includes("admin.all") ||
      stored?.permissions?.includes("admin.all"),
    );
  };

  BRM.toast = function (message, type = "success") {
    let tray = document.querySelector(".toast-tray");
    if (!tray) {
      tray = document.createElement("div");
      tray.className = "toast-tray";
      document.body.appendChild(tray);
    }
    const item = document.createElement("div");
    item.className = `toast toast-${type}`;
    item.textContent = message;
    tray.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 250);
    }, 3600);
  };

  BRM.loading = function (target, message = "Loading…") {
    const el =
      typeof target === "string" ? document.querySelector(target) : target;
    if (el)
      el.innerHTML = `<div class="loading-state"><span class="spinner"></span><span>${BRM.escape(message)}</span></div>`;
  };

  BRM.empty = function (title, text, icon = "◇") {
    return `<div class="empty-state"><span class="empty-icon">${icon}</span><h3>${BRM.escape(title)}</h3><p>${BRM.escape(text)}</p></div>`;
  };

  BRM.openModal = function (html, options = {}) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<section class="modal ${options.wide ? "modal-wide" : ""}" role="dialog" aria-modal="true"><button class="modal-close icon-button" aria-label="Close">×</button>${html}</section>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add("open"));
    const close = () => {
      backdrop.classList.remove("open");
      setTimeout(() => backdrop.remove(), 180);
    };
    backdrop.querySelector(".modal-close").addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.closeModal = close;
    return backdrop;
  };

  BRM.clearSession = function () {
    ["brmToken", "brmContext"].forEach((key) => localStorage.removeItem(key));
    ["brmToken", "brmContext"].forEach((key) => sessionStorage.removeItem(key));
    localStorage.removeItem("brmTrustedDevice");
    ["brmFirebaseUid", "brmFirebaseIdToken"].forEach((key) => sessionStorage.removeItem(key));
    sessionStorage.removeItem("brmSnapshotDisabledUntil");
    BRM.context = null;
    BRM.clearFastCaches?.();
    BRM.clearSiteCache?.();
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("bedford-profile-photos-"))
              .map((key) => caches.delete(key)),
          ),
        )
        .catch(() => {});
    }
  };

  BRM.getSessionValue = function (key) {
    return sessionStorage.getItem(key) || localStorage.getItem(key) || "";
  };
  BRM.signOutFirebase = async function () {
    const firebaseConfig = window.BRM_CONFIG?.FIREBASE;
    if (!firebaseConfig || window.BRM_CONFIG?.FIREBASE_MODE === "off") return;
    const [appModule, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),
    ]);
    const app = appModule.getApps().length
      ? appModule.getApp()
      : appModule.initializeApp(firebaseConfig);
    await authModule.signOut(authModule.getAuth(app));
  };
  BRM.storeSessionContext = function (context) {
    const target = sessionStorage.getItem("brmToken") ? sessionStorage : localStorage;
    target.setItem("brmContext", JSON.stringify(context));
  };

  BRM.setSession = function (token, context, trustedDevice = true) {
    const previousToken = BRM.getSessionValue("brmToken");

    if (previousToken && previousToken !== token) {
      BRM.clearSiteCache?.();
    }

    const target = trustedDevice ? localStorage : sessionStorage;
    const other = trustedDevice ? sessionStorage : localStorage;
    other.removeItem("brmToken"); other.removeItem("brmContext");
    target.setItem("brmToken", token);
    target.setItem("brmContext", JSON.stringify(context));
    localStorage.setItem("brmTrustedDevice", String(trustedDevice));
    BRM.context = context;
  };

  BRM.getStoredContext = function () {
    try {
      return JSON.parse(BRM.getSessionValue("brmContext") || "null");
    } catch {
      return null;
    }
  };

  BRM.readFastCache = function (key, maxAge = 6 * 60 * 60 * 1000) {
    try {
      const scope = `${BRM.context?.userId || 'user'}:${BRM.context?.production?.ProductionID || 'active'}`;
      const item = JSON.parse(localStorage.getItem(`brmFast:${scope}:${key}`) || 'null');
      return item && Date.now() - Number(item.savedAt || 0) <= maxAge ? item.value : null;
    } catch { return null; }
  };

  BRM.writeFastCache = function (key, value) {
    try {
      const scope = `${BRM.context?.userId || 'user'}:${BRM.context?.production?.ProductionID || 'active'}`;
      localStorage.setItem(`brmFast:${scope}:${key}`, JSON.stringify({ savedAt: Date.now(), value }));
    } catch {}
  };

  BRM.clearFastCaches = function () {
    try {
      Object.keys(localStorage).filter(key => key.startsWith('brmFast:')).forEach(key => localStorage.removeItem(key));
    } catch {}
  };

  BRM.mergeCurrentContext = function (incoming, stored) {
    if (typeof BRM.mergePortalContexts === "function") {
      return BRM.mergePortalContexts(incoming, stored);
    }

    if (!incoming) return stored;
    if (!stored) return incoming;

    if (
      incoming.userId &&
      stored.userId &&
      String(incoming.userId) !== String(stored.userId)
    ) {
      return incoming;
    }

    // A live/server context is authoritative. Do not retain permissions or
    // department access that may have been revoked since the cached context.
    const permissions = [...new Set(incoming.permissions || [])];

    const storedAdmin =
      stored.isAdmin === true ||
      String(stored.isAdmin || "").toLowerCase() === "true" ||
      stored.permissions?.includes("admin.all");

    const incomingAdmin =
      incoming.isAdmin === true ||
      String(incoming.isAdmin || "").toLowerCase() === "true" ||
      incoming.permissions?.includes("admin.all");

    return {
      ...stored,
      ...incoming,
      profile: {
        ...(stored.profile || {}),
        ...(incoming.profile || {}),
      },
      production: {
        ...(stored.production || {}),
        ...(incoming.production || {}),
      },
      permissions,
      departmentIds: [...new Set((incoming.departmentIds || []).map(String))],
      departments: incoming.departments || [],
      isAdmin: Boolean(incomingAdmin || permissions.includes("admin.all")),
    };
  };

  const CUSTOM_THEME_KEY = "brmCustomThemeV1";
  const CUSTOM_THEME_DEFAULT = {
    mode: "dark",
    primary: "#d71e2b",
    secondary: "#6f7cff",
    accent: "#f0bf52",
    background: "#090a10",
    surface: "#1b1c24",
    text: "#f7f7fa",
    muted: "#a9acb6",
    success: "#42c981",
    warning: "#ffbf47",
    danger: "#ff5d67",
    radius: 18,
    typeScale: 1,
    spaceScale: 1,
    depth: 3,
    glow: 2,
    texture: "grid",
    textureOpacity: 0.2,
    scoreFlow: {
      preset: "Descendants Neon",
      primary: "#ff3ec9",
      secondary: "#00e9ff",
      surface: "#12101f",
      masterVolume: 1,
    },
  };
  const CUSTOM_PRESETS = {
    "Bedford Remix": {
      primary: "#d71e2b",
      secondary: "#ffffff",
      accent: "#b7bcc8",
      background: "#09090c",
      surface: "#1b1c22",
      text: "#f7f7f8",
      muted: "#a9acb6",
    },
    "Midnight Royal": {
      primary: "#f3c75f",
      secondary: "#69aef8",
      accent: "#fff0ba",
      background: "#061326",
      surface: "#112b4f",
      text: "#fffaf0",
      muted: "#c8d5e8",
    },
    "Forest Atelier": {
      primary: "#7ee787",
      secondary: "#5cc8ff",
      accent: "#e8c66a",
      background: "#07110d",
      surface: "#163326",
      text: "#f3fff8",
      muted: "#afd0bd",
    },
    "Velvet Stage": {
      primary: "#ff5f91",
      secondary: "#a67cff",
      accent: "#ffd166",
      background: "#130812",
      surface: "#35152e",
      text: "#fff5fb",
      muted: "#d5afc8",
    },
    "Ocean Glass": {
      primary: "#28d7c0",
      secondary: "#4f8cff",
      accent: "#b7f5ed",
      background: "#06141a",
      surface: "#11323b",
      text: "#f2ffff",
      muted: "#a9ced3",
    },
    "Warm Paper": {
      mode: "light",
      primary: "#a62b3d",
      secondary: "#365f91",
      accent: "#b67a22",
      background: "#f3eadc",
      surface: "#fffaf2",
      text: "#241e19",
      muted: "#6f6258",
    },
    "Soft Lavender": {
      mode: "light",
      primary: "#7657c8",
      secondary: "#d05291",
      accent: "#537ca6",
      background: "#f2effa",
      surface: "#ffffff",
      text: "#251f31",
      muted: "#6d637b",
    },
    "High Contrast": {
      primary: "#ffe600",
      secondary: "#40c4ff",
      accent: "#ffffff",
      background: "#000000",
      surface: "#171717",
      text: "#ffffff",
      muted: "#d2d2d2",
      radius: 8,
      depth: 1,
      glow: 0,
      texture: "none",
    },
  };
  const customTheme = () => {
    try {
      return {
        ...CUSTOM_THEME_DEFAULT,
        ...JSON.parse(localStorage.getItem(CUSTOM_THEME_KEY) || "{}"),
      };
    } catch {
      return { ...CUSTOM_THEME_DEFAULT };
    }
  };
  BRM.loadAccountTheme = async function () {
    if (!CONFIG.FIREBASE || CONFIG.FIREBASE_MODE === "off") return;
    try {
      const [appApi, authApi, storeApi] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js"),
      ]);
      const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(CONFIG.FIREBASE), auth = authApi.getAuth(app);
      await auth.authStateReady(); if (!auth.currentUser) return;
      const profileRef = storeApi.doc(storeApi.getFirestore(app), "profiles", auth.currentUser.uid);
      const snapshot = await storeApi.getDoc(profileRef);
      if (!snapshot.exists()) return;
      const data = snapshot.data(), theme = data.theme || data.Theme;
      if (data.themePreferences && typeof data.themePreferences === "object") localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify({...CUSTOM_THEME_DEFAULT, ...data.themePreferences}));
      if (theme) { localStorage.setItem("brmTheme", theme); BRM.applyTheme(theme, false); }
      BRM.stopAccountThemeSync?.();
      BRM.stopAccountThemeSync = storeApi.onSnapshot(profileRef, liveSnapshot => {
        if (!liveSnapshot.exists()) return;
        const live = liveSnapshot.data(), liveTheme = live.theme || live.Theme;
        if (live.themePreferences && typeof live.themePreferences === "object") {
          localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify({...CUSTOM_THEME_DEFAULT, ...live.themePreferences}));
        }
        if (liveTheme) {
          localStorage.setItem("brmTheme", liveTheme);
          BRM.applyTheme(liveTheme, false);
        }
      });
    } catch (error) { console.warn("Account theme could not be loaded:", error); }
  };
  BRM.saveAccountTheme = async function (theme, preferences) {
    if (!CONFIG.FIREBASE || CONFIG.FIREBASE_MODE === "off") return;
    try {
      const [appApi, authApi, storeApi] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js"),
      ]);
      const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(CONFIG.FIREBASE), auth = authApi.getAuth(app);
      await auth.authStateReady(); if (!auth.currentUser) return;
      await storeApi.setDoc(storeApi.doc(storeApi.getFirestore(app), "profiles", auth.currentUser.uid), {theme, ...(preferences ? {themePreferences: preferences} : {}), updatedAt: storeApi.serverTimestamp()}, {merge:true});
    } catch (error) { console.warn("Account theme could not be saved:", error); }
  };
  const hexRgb = (hex) => {
    const value = String(hex).replace("#", "");
    return value.length === 6
      ? [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16))
      : [0, 0, 0];
  };
  const mixHex = (a, b, amount) =>
    "#" +
    hexRgb(a)
      .map((v, i) =>
        Math.round(v + (hexRgb(b)[i] - v) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const contrastRatio = (a, b) => {
    const lum = (hex) => {
      const c = hexRgb(hex)
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const x = lum(a),
      y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  BRM.applyCustomTheme = function (state = customTheme()) {
    const root = document.documentElement,
      dark = state.mode !== "light",
      surface = state.surface;
    const vars = {
      "--bg": state.background,
      "--bg-alt": mixHex(state.background, surface, 0.32),
      "--surface": surface + "f2",
      "--surface-strong": surface,
      "--surface-soft": dark ? "rgba(255,255,255,.06)" : "rgba(20,22,28,.055)",
      "--text": state.text,
      "--muted": state.muted,
      "--faint": mixHex(state.muted, state.background, 0.38),
      "--primary": state.primary,
      "--primary-strong": mixHex(
        state.primary,
        dark ? "#ffffff" : "#000000",
        dark ? 0.18 : 0.08,
      ),
      "--primary-soft": state.primary + "24",
      "--secondary": state.secondary,
      "--accent": state.accent,
      "--success": state.success,
      "--warning": state.warning,
      "--danger": state.danger,
      "--border": state.text + "20",
      "--border-strong": state.text + "3d",
      "--radius": state.radius + "px",
      "--radius-sm": Math.max(6, state.radius - 6) + "px",
      "--custom-type-scale": state.typeScale,
      "--custom-space-scale": state.spaceScale,
      "--custom-texture-opacity": state.textureOpacity,
      "--shadow":
        state.depth == 0
          ? "none"
          : `0 ${8 + state.depth * 5}px ${18 + state.depth * 14}px rgba(0,0,0,${dark ? 0.18 + 0.05 * state.depth : 0.07 + 0.025 * state.depth})`,
      "--shadow-soft":
        state.depth == 0
          ? "none"
          : `0 ${4 + state.depth * 2}px ${10 + state.depth * 6}px rgba(0,0,0,${dark ? 0.1 + 0.025 * state.depth : 0.04 + 0.015 * state.depth})`,
      "--glow":
        state.glow == 0
          ? "none"
          : `0 0 ${18 + state.glow * 12}px ${state.primary}${20 + state.glow * 8}`,
    };
    Object.entries(vars).forEach(([key, value]) =>
      root.style.setProperty(key, value),
    );
    root.dataset.customTexture = state.texture;
    root.style.colorScheme = dark ? "dark" : "light";
  };
  BRM.applyTheme = function (theme, save = true) {
    const valid = CONFIG.THEMES.map((t) => t.id);
    const chosen = valid.includes(theme) ? theme : CONFIG.DEFAULT_THEME;
    document.documentElement.dataset.theme = chosen;
    if (chosen === "custom-aesthetic") BRM.applyCustomTheme();
    else {
      document.documentElement.removeAttribute("data-custom-texture");
      document.documentElement.style.cssText = "";
    }
    if (save) localStorage.setItem("brmTheme", chosen);
    if (save) BRM.saveAccountTheme?.(chosen, chosen === "custom-aesthetic" ? customTheme() : null);
    document.querySelectorAll("[data-theme-name]").forEach((el) => {
      el.textContent =
        CONFIG.THEMES.find((t) => t.id === chosen)?.name || chosen;
    });
  };

  BRM.cycleTheme = function () {
    const current =
      document.documentElement.dataset.theme || CONFIG.DEFAULT_THEME;
    const index = CONFIG.THEMES.findIndex((t) => t.id === current);
    BRM.applyTheme(CONFIG.THEMES[(index + 1) % CONFIG.THEMES.length].id);
    BRM.toast(
      `Theme: ${CONFIG.THEMES[(index + 1) % CONFIG.THEMES.length].name}`,
      "info",
    );
  };

  BRM.themeMenu = function () {
    return `<div class="theme-menu">${CONFIG.THEMES.map((t) => `<button type="button" data-set-theme="${t.id}"><span class="theme-swatch theme-${t.id}"></span>${BRM.escape(t.name)}</button>`).join("")}<button type="button" data-customize-theme><span class="theme-swatch theme-custom-aesthetic"></span><strong>Open Theme Studio</strong></button></div>`;
  };

  BRM.openThemeStudio = function () {
    const originalTheme =
        localStorage.getItem("brmTheme") || CONFIG.DEFAULT_THEME,
      originalState = customTheme();
    let state = {
        ...originalState,
        scoreFlow: {
          ...CUSTOM_THEME_DEFAULT.scoreFlow,
          ...(originalState.scoreFlow || {}),
        },
      },
      saved = false;
    const colorControls = [
      ["primary", "Primary"],
      ["secondary", "Secondary"],
      ["accent", "Accent"],
      ["background", "Background"],
      ["surface", "Cards & panels"],
      ["text", "Main text"],
      ["muted", "Muted text"],
      ["success", "Success"],
      ["warning", "Warning"],
      ["danger", "Danger"],
    ];
    const modal = BRM.openModal(
      `<div class="theme-studio"><div class="theme-studio-header"><div><span class="eyebrow">Personal appearance</span><h2>Theme Studio</h2><p>Shape the complete portal aesthetic, or begin with a simple scheme and fine-tune it.</p></div><button class="button button-secondary" data-theme-reset>Reset</button></div><div class="theme-studio-preview"><span class="eyebrow">Live preview</span><h2>Your production, your atmosphere</h2><p style="color:var(--muted)">Cards, type, controls, status colors, depth and texture update as you work.</p><div class="preview-actions"><button class="button button-primary">Primary action</button><button class="button button-secondary">Secondary</button><span class="badge badge-important">Important</span><span class="badge badge-urgent">Urgent</span></div></div><section><h3>Simple color schemes</h3><div class="theme-studio-presets">${Object.entries(
        CUSTOM_PRESETS,
      )
        .map(
          ([name, p]) =>
            `<button class="theme-preset" data-theme-preset="${BRM.escape(name)}" style="--preset:linear-gradient(135deg,${p.background} 35%,${p.primary} 35% 68%,${p.secondary} 68%)">${BRM.escape(name)}</button>`,
        )
        .join(
          "",
        )}</div></section><div class="theme-control-sections"><section class="theme-control-group"><h3>Palette</h3><div class="theme-color-grid">${colorControls.map(([key, label]) => `<label class="theme-color-control"><input type="color" data-custom-key="${key}" value="${state[key]}"><span>${label}</span></label>`).join("")}</div></section><section class="theme-control-group"><h3>Foundation</h3><div class="field"><label>Canvas mode</label><select data-custom-key="mode"><option value="dark">Dark</option><option value="light">Light</option></select></div><div class="field" style="margin-top:10px"><label>Background texture</label><select data-custom-key="texture"><option value="grid">Stage grid</option><option value="dots">Soft dots</option><option value="none">Clean / none</option></select></div><label class="theme-range"><span>Texture strength</span><output data-output="textureOpacity"></output><input type="range" min="0" max=".5" step=".01" data-custom-key="textureOpacity"></label></section><section class="theme-control-group"><h3>Shape & rhythm</h3><label class="theme-range"><span>Corner style</span><output data-output="radius"></output><input type="range" min="4" max="32" step="1" data-custom-key="radius"></label><label class="theme-range"><span>Type scale</span><output data-output="typeScale"></output><input type="range" min=".88" max="1.16" step=".01" data-custom-key="typeScale"></label><label class="theme-range"><span>Layout spacing</span><output data-output="spaceScale"></output><input type="range" min=".82" max="1.2" step=".01" data-custom-key="spaceScale"></label></section><section class="theme-control-group"><h3>Atmosphere</h3><label class="theme-range"><span>Shadow depth</span><output data-output="depth"></output><input type="range" min="0" max="5" step="1" data-custom-key="depth"></label><label class="theme-range"><span>Accent glow</span><output data-output="glow"></output><input type="range" min="0" max="5" step="1" data-custom-key="glow"></label><div class="theme-studio-status" data-contrast-status></div></section><section class="theme-control-group"><h3>ScoreFlow player</h3><p>These colours follow your account into the Android reader.</p><div class="theme-color-grid"><label class="theme-color-control"><input type="color" data-scoreflow-key="primary"><span>Primary glow</span></label><label class="theme-color-control"><input type="color" data-scoreflow-key="secondary"><span>Secondary glow</span></label><label class="theme-color-control"><input type="color" data-scoreflow-key="surface"><span>Player surface</span></label></div><label class="theme-range"><span>Default volume</span><output data-scoreflow-volume-output></output><input type="range" min="0" max="1" step=".01" data-scoreflow-key="masterVolume"></label></section></div><div class="form-actions"><button class="button button-secondary" data-theme-cancel>Cancel</button><button class="button button-primary" data-theme-save>Save my aesthetic</button></div></div>`,
      { wide: true },
    );
    const sync = () => {
      BRM.applyTheme("custom-aesthetic", false);
      BRM.applyCustomTheme(state);
      modal.querySelectorAll("[data-custom-key]").forEach((input) => {
        const key = input.dataset.customKey;
        if (document.activeElement !== input) input.value = state[key];
      });
      modal.querySelectorAll("[data-output]").forEach((o) => {
        const v = state[o.dataset.output];
        o.textContent =
          o.dataset.output === "radius"
            ? `${v}px`
            : Number(v).toFixed(
                o.dataset.output === "depth" || o.dataset.output === "glow"
                  ? 0
                  : 2,
              );
      });
      modal.querySelectorAll("[data-scoreflow-key]").forEach((input) => {
        const value = state.scoreFlow[input.dataset.scoreflowKey];
        if (document.activeElement !== input) input.value = value;
      });
      modal.querySelector("[data-scoreflow-volume-output]").textContent =
        `${Math.round(Number(state.scoreFlow.masterVolume) * 100)}%`;
      const ratio = contrastRatio(state.text, state.background),
        status = modal.querySelector("[data-contrast-status]");
      status.className = `theme-studio-status ${ratio >= 4.5 ? "good" : "warn"}`;
      status.textContent = `Text contrast ${ratio.toFixed(1)}:1 — ${ratio >= 7 ? "excellent" : ratio >= 4.5 ? "accessible for normal text" : "increase the difference between text and background"}.`;
    };
    modal.querySelectorAll("[data-custom-key]").forEach((input) =>
      input.addEventListener("input", () => {
        state[input.dataset.customKey] =
          input.type === "range" ? Number(input.value) : input.value;
        sync();
      }),
    );
    modal.querySelectorAll("[data-scoreflow-key]").forEach((input) =>
      input.addEventListener("input", () => {
        const key = input.dataset.scoreflowKey;
        state.scoreFlow = {
          ...state.scoreFlow,
          [key]: input.type === "range" ? Number(input.value) : input.value,
          preset: "Custom",
        };
        sync();
      }),
    );
    modal.querySelectorAll("[data-theme-preset]").forEach(
      (button) =>
        (button.onclick = () => {
          state = {
            ...CUSTOM_THEME_DEFAULT,
            ...CUSTOM_PRESETS[button.dataset.themePreset],
            scoreFlow: { ...state.scoreFlow },
          };
          sync();
        }),
    );
    modal.querySelector("[data-theme-reset]").onclick = () => {
      state = {
        ...CUSTOM_THEME_DEFAULT,
        scoreFlow: { ...CUSTOM_THEME_DEFAULT.scoreFlow },
      };
      sync();
    };
    modal.querySelector("[data-theme-cancel]").onclick = () =>
      modal.closeModal();
    modal.querySelector("[data-theme-save]").onclick = () => {
      localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(state));
      localStorage.setItem("brmTheme", "custom-aesthetic");
      document
        .querySelector('select[name="theme"]')
        ?.querySelector('option[value="custom-aesthetic"]')
        ?.setAttribute("selected", "selected");
      const profileTheme = document.querySelector('select[name="theme"]');
      if (profileTheme) profileTheme.value = "custom-aesthetic";
      saved = true;
      BRM.applyTheme("custom-aesthetic", false);
      BRM.saveAccountTheme?.("custom-aesthetic", state);
      modal.closeModal();
      BRM.toast("Your custom aesthetic is saved.", "success");
    };
    new MutationObserver((_, observer) => {
      if (!document.body.contains(modal)) {
        observer.disconnect();
        if (!saved) {
          localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(originalState));
          BRM.applyTheme(originalTheme, false);
        }
      }
    }).observe(document.body, { childList: true });
    sync();
  };

  function navItem(href, label, icon, key) {
    const active = document.body.dataset.page === key ? "active" : "";
    return `<a class="nav-link ${active}" href="${href}" ${key === "announcements" ? "data-announcement-nav" : ""}><span>${icon}</span><span>${label}</span></a>`;
  }

  function dockItem(href, label, icon, keys) {
    const pages = Array.isArray(keys) ? keys : [keys];
    const active = pages.includes(document.body.dataset.page) ? "active" : "";
    return `<a class="portal-dock-link ${active}" href="${href}"><span aria-hidden="true">${icon}</span><span>${label}</span></a>`;
  }

  BRM.setAnnouncementBadge = function (count, urgent = 0) {
    document.querySelectorAll("[data-announcement-nav]").forEach((link) => {
      link.querySelector(".announcement-nav-badge")?.remove();
      if (count) {
        link.insertAdjacentHTML(
          "beforeend",
          `<span class="announcement-nav-badge" title="${urgent ? `${urgent} urgent · ` : ""}${count} unread">${count}</span>`,
        );
      }
    });
  };
  BRM.refreshAnnouncementBadge = async function () {
    try {
      const result = await BRM.api(
        "announcements",
        {},
        { noCache: true, forceNetwork: true },
      );
      const unread = (result.data || []).filter((item) => !item.IsRead);
      BRM.setAnnouncementBadge(
        unread.length,
        unread.filter((item) => item.Priority === "Urgent").length,
      );
    } catch {}
  };

  function hasAnyPermission(...keys) {
    return BRM.isAdmin() || keys.some((key) => BRM.hasPermission(key));
  }

  BRM.canAccessPage = function (
    page = document.body.dataset.page,
    context = BRM.context,
  ) {
    if (!context) return false;
    if (page === "admin" || page === "recruitment-review") return BRM.isAdmin();
    if (page === "journal-review") return hasAnyPermission("journal.review");
    if (page === "blocking")
      return hasAnyPermission(
        "blocking.edit",
        "blocking.manage",
        "blocking.audit",
      );

    const department = document.body.dataset.department;
    if (!department || BRM.isAdmin() || BRM.hasPermission("department.manage"))
      return true;
    return (context.departments || []).some(
      (item) => String(item.Slug) === String(department),
    );
  };

  BRM.setSyncStatus = function (state, message) {
    document.querySelectorAll("[data-sync-status]").forEach((element) => {
      element.dataset.state = state || "ready";
      element.textContent = message || "Portal ready";
      element.title =
        state === "cached"
          ? "This page loaded from the one-time portal cache."
          : message || "";
    });
  };

  BRM.renderShell = function () {
    document.documentElement.dataset.brmBuild = BRM.BUILD_ID;
    const context = BRM.context;
    const profile = context.profile || {};
    const shell = document.querySelector("[data-app-shell]");
    if (!shell) return;
    const departmentLinks = (context.departments || [])
      .filter((dep) => dep?.Slug && dep?.Name && dep.Slug !== "administration")
      .map((dep) =>
        navItem(
          `${encodeURIComponent(dep.Slug)}.html`,
          dep.Name,
          BRM.departmentIcon(dep.Slug),
          dep.Slug,
        ),
      )
      .join("");
    const canReviewJournals = hasAnyPermission("journal.review");
    const canUseBlocking = hasAnyPermission(
      "blocking.edit",
      "blocking.manage",
      "blocking.audit",
    );
    const announcementLabel = BRM.hasPermission("announcement.manage")
      ? "Manage Announcements"
      : "Announcements";
    const scheduleLabel = "Calendar & Calls";
    const resourcesLabel = BRM.hasPermission("resources.manage")
      ? "Manage Resources"
      : "Resources";
    const communicationsLink = localStorage.getItem("brmAppInstall")
      ? navItem("communications.html", "Conversations", "●", "communications") : "";
    const hubCard = (href, title, description, icon, category) => `<article class="hub-launcher-card" data-hub-key="${BRM.escape(href)}" data-hub-title="${BRM.escape(title)}" data-hub-icon="${BRM.escape(icon)}" data-hub-search="${BRM.escape(`${title} ${description} ${category}`.toLowerCase())}"><a class="hub-launcher-card-main" href="${href}"${/\.apk(?:$|\?)/i.test(href) ? " download" : ""}><span class="hub-launcher-icon">${icon}</span><span><strong>${BRM.escape(title)}</strong><small>${BRM.escape(description)}</small></span><span class="hub-live-signal" data-hub-signal hidden></span></a><button type="button" class="hub-favorite" data-hub-favorite aria-label="Pin ${BRM.escape(title)}" title="Pin workspace">☆</button></article>`;
    const departmentCards = (context.departments || []).filter(dep => dep?.Slug && dep?.Name && dep.Slug !== "administration").map(dep => hubCard(`${encodeURIComponent(dep.Slug)}.html`, dep.Name, "Department workspace", BRM.departmentIcon(dep.Slug), "departments")).join("");
    const adminCards = BRM.isAdmin() ? [
      hubCard("admin.html", "People & Access", "Accounts, roles and permissions", "⚙", "administration"),
      hubCard("scoreflow-sync.html", "ScoreFlow AutoTrack", "Program score movement to rehearsal audio", "♫", "administration"),
      hubCard("casting.html", "Casting", "Assign performers to characters and company", "★", "administration"),
      hubCard("recruitment-review.html", "Auditions & Interest", "Bookings and production interest", "★", "administration"),
      hubCard("journal-review.html", "Journal Review", "Student submissions and feedback", "◉", "administration"),
      hubCard("announcements.html", "Announcements", "Publish company updates", "!", "administration"),
      hubCard("schedule.html", "Schedule", "Calls, events and calendar imports", "◷", "administration"),
    ].join("") : "";
    const productionCards = [
      hubCard("tasks.html", BRM.isAdmin() ? "All Tasks" : "My Tasks", "Assignments and progress", "✓", "production"),
      hubCard("blocking-viewer.html", "Blocking Viewer", "Stage pictures and playback", "▶", "production"),
      canUseBlocking ? hubCard("blocking.html", "Blocking Studio", "Create and edit staging", "⌖", "production") : "",
      hubCard("tracks.html", "Music & Tracks", "Rehearsal audio and practice", "♪", "production"),
      hubCard("resources.html", resourcesLabel, "Links and production documents", "▤", "production"),
    ].join("");
    const personalCards = [hubCard("libretto-reader.html", "Descendants Libretto", "ScoreFlow rehearsal reader", "▤", "personal"), hubCard("journal.html", "Private Journal", "Reflection and rehearsal records", "✎", "personal"), hubCard("directory.html", "Company Directory", "Find cast and crew", "◎", "personal"), hubCard("storage.html", "Offline & Storage", "Downloads and device storage", "⇩", "personal"), hubCard("downloads/BedfordRoadMusical-2.11.0.apk", "Android App", "Download the latest release", "↓", "personal")].join("");
    shell.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-head">
        <a class="brand-lockup" href="dashboard.html">
          <span class="brand-mark"><img src="assets/images/bedford-road-theatre-logo-192.png" alt="" aria-hidden="true"></span>
          <span><strong>${BRM.escape(CONFIG.SITE_NAME)}</strong><small>${BRM.escape(context.production?.ShortTitle || context.production?.Title || "")}</small></span>
        </a>
        <button type="button" class="icon-button nav-collapse-toggle" data-nav-collapse aria-label="Collapse navigation" title="Collapse navigation">&#x2039;</button>
        </div>
        <nav class="main-nav" aria-label="Main navigation">
          <p class="nav-label">Everyday</p>
          ${navItem("dashboard.html", BRM.isAdmin() ? "Admin Dashboard" : "Dashboard", "⌂", "dashboard")}
          ${communicationsLink}
          ${navItem("announcements.html", announcementLabel, "!", "announcements")}
          ${navItem("schedule.html", scheduleLabel, "◷", "schedule")}
          ${navItem("tasks.html", BRM.isAdmin() ? "All Tasks" : "My Tasks", "✓", "tasks")}
          <p class="nav-label">Explore</p>
          <button type="button" class="nav-link nav-workspace-button" data-open-hubs><span>▦</span><span>All Hubs & Tools</span></button>
          ${BRM.isAdmin() ? navItem("admin.html", "People & Access", "⚙", "admin") : ""}
        </nav>
        <div class="sidebar-foot">
          <a class="profile-chip" href="profile.html">
            ${BRM.avatar(profile.DisplayName, profile.PhotoURL)}
            <span>
              <strong>${BRM.escape(profile.DisplayName || context.username)}</strong>
              <small>${BRM.isAdmin() ? "◆ Full Administrator" : "View profile"}</small>
            </span>
          </a>
          <button class="button button-ghost button-block" data-logout>Sign out</button>
        </div>
      </aside>
      <nav class="portal-dock" aria-label="Quick navigation">
        ${dockItem("dashboard.html", "Home", "&#x2302;", "dashboard")}
        ${dockItem(communicationsLink ? "communications.html" : "announcements.html", communicationsLink ? "Community" : "Updates", "&#x25CF;", ["communications", "announcements"])}
        ${dockItem("schedule.html", "Schedule", "&#x25F7;", "schedule")}
        <button type="button" class="portal-dock-link" data-open-hubs><span aria-hidden="true">&#x25A6;</span><span>Hubs</span></button>
        ${dockItem("profile.html", "Account", "&#x25C9;", "profile")}
      </nav>
      <div class="hub-launcher-backdrop" data-hub-launcher aria-hidden="true">
        <section class="hub-launcher" role="dialog" aria-modal="true" aria-labelledby="hub-launcher-title">
          <header class="hub-launcher-head"><div><span class="eyebrow">Workspace launcher</span><h2 id="hub-launcher-title">Production workspaces</h2></div><button class="icon-button" type="button" data-close-hubs aria-label="Close hubs">&times;</button></header>
          ${BRM.isAdmin() ? '<div class="hub-mode-row"><span><strong>Workspace mode</strong><small>Separate daily production work from administrative controls.</small></span><div class="hub-mode-switch" role="group" aria-label="Administrator workspace mode"><button type="button" data-hub-mode="production">Production</button><button type="button" data-hub-mode="admin">Administration</button></div></div>' : ''}
          <label class="hub-launcher-search"><span>⌕</span><input type="search" placeholder="Search hubs, departments, or tools" data-hub-search-input></label>
          <nav class="hub-launcher-tabs" role="tablist" aria-label="Workspace categories">
            ${adminCards ? `<button class="hub-launcher-tab active" type="button" role="tab" aria-selected="true" data-hub-tab="administration">Administration</button>` : ""}
            <button class="hub-launcher-tab ${adminCards ? "" : "active"}" type="button" role="tab" aria-selected="${adminCards ? "false" : "true"}" data-hub-tab="production">Production</button>
            ${departmentCards ? `<button class="hub-launcher-tab" type="button" role="tab" aria-selected="false" data-hub-tab="departments">Departments</button>` : ""}
            <button class="hub-launcher-tab" type="button" role="tab" aria-selected="false" data-hub-tab="personal">Personal Resources</button>
          </nav>
          <div class="hub-launcher-scroll">
            <section class="hub-smart-shortcuts" data-hub-shortcuts hidden><div data-hub-pinned-wrap hidden><div class="hub-shortcut-heading"><strong>Pinned</strong><small>Your favourites</small></div><div class="hub-shortcut-row" data-hub-pinned></div></div><div data-hub-recent-wrap hidden><div class="hub-shortcut-heading"><strong>Recent</strong><small>Continue working</small></div><div class="hub-shortcut-row" data-hub-recent></div></div></section>
            ${adminCards ? `<section class="hub-launcher-group active" data-hub-panel="administration"><div class="hub-launcher-label"><span>Administration</span><small>Control and review</small></div><div class="hub-launcher-grid">${adminCards}</div></section>` : ""}
            <section class="hub-launcher-group ${adminCards ? "" : "active"}" data-hub-panel="production"><div class="hub-launcher-label"><span>Production</span><small>Rehearsal and show tools</small></div><div class="hub-launcher-grid">${productionCards}</div></section>
            ${departmentCards ? `<section class="hub-launcher-group" data-hub-panel="departments"><div class="hub-launcher-label"><span>${BRM.isAdmin() ? "Departments" : "Your departments"}</span><small>Team-specific workspaces</small></div><div class="hub-launcher-grid">${departmentCards}</div></section>` : ""}
            <section class="hub-launcher-group" data-hub-panel="personal"><div class="hub-launcher-label"><span>Personal & resources</span><small>Your company toolkit</small></div><div class="hub-launcher-grid">${personalCards}</div></section>
            <div class="hub-launcher-empty" data-hub-empty hidden>No matching workspace was found.</div>
          </div>
        </section>
      </div>
      <div class="app-frame">
        <header class="topbar">
          <button class="icon-button mobile-menu" data-menu-toggle aria-label="Open menu">☰</button>
          <div class="topbar-production"><strong>${BRM.escape(context.production?.Title || "Production")}</strong><span>${BRM.escape(context.production?.SchoolYear || "")}</span></div>
          <div class="topbar-actions">
            ${BRM.isAdmin() ? '<a class="badge admin-topbar-badge" href="admin.html">◆ Full Administrator</a>' : ""}
            <span class="badge portal-sync-status" data-sync-status data-state="ready">Portal ready</span>
            <div class="theme-picker"><button class="button button-quiet" data-theme-toggle><span>◐</span><span data-theme-name></span></button><div class="theme-popover">${BRM.themeMenu()}</div></div>
            <a class="avatar-link" href="profile.html">${BRM.avatar(profile.DisplayName, profile.PhotoURL, "small")}</a>
          </div>
        </header>
        <main class="app-main" id="app-main"></main>
      </div>`;
    BRM.bindShell();
    BRM.refreshAnnouncementBadge();
  };

  const profilePhotoObjectUrls = new Map();
  const profilePhotoLoads = new Map();

  BRM.extractProfilePhotoFileId = function (photoUrl) {
    const value = String(photoUrl || "").trim();
    if (!value) return "";

    if (value.startsWith("drivefile:")) {
      return value.slice("drivefile:".length);
    }

    const idMatch = value.match(/[?&]id=([^&#]+)/i);
    if (idMatch) return decodeURIComponent(idMatch[1]);

    const drivePathMatch = value.match(/\/d\/([^/]+)/i);
    if (drivePathMatch) return drivePathMatch[1];

    return "";
  };

  function profilePhotoCacheName() {
    const userId = BRM.getStoredContext?.()?.userId || "anonymous";
    return `bedford-profile-photos-v20-${userId}`;
  }

  function profilePhotoCacheRequest(fileId) {
    return new Request(
      `${location.origin}/__brm_profile_photo__/${encodeURIComponent(fileId)}`,
    );
  }

  async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  function displayProfilePhoto(image, objectUrl) {
    const avatar = image.closest("[data-brm-avatar]");
    const fallback = avatar?.querySelector("[data-brm-photo-fallback]");

    image.addEventListener(
      "load",
      () => {
        image.hidden = false;
        if (fallback) fallback.hidden = true;
      },
      { once: true },
    );

    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
        if (fallback) fallback.hidden = false;
      },
      { once: true },
    );

    image.src = objectUrl;
  }

  async function readCachedProfilePhoto(fileId) {
    if (profilePhotoObjectUrls.has(fileId)) {
      return profilePhotoObjectUrls.get(fileId);
    }

    if (!("caches" in window)) return "";

    try {
      const cache = await caches.open(profilePhotoCacheName());
      const response = await cache.match(profilePhotoCacheRequest(fileId));

      if (!response) return "";

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      profilePhotoObjectUrls.set(fileId, objectUrl);
      return objectUrl;
    } catch (error) {
      return "";
    }
  }

  BRM.cacheProfilePhoto = async function (fileId, dataUrl) {
    if (!fileId || !dataUrl) return "";

    const blob = await dataUrlToBlob(dataUrl);
    const existing = profilePhotoObjectUrls.get(fileId);

    if (existing) {
      try {
        URL.revokeObjectURL(existing);
      } catch (error) {}
    }

    const objectUrl = URL.createObjectURL(blob);
    profilePhotoObjectUrls.set(fileId, objectUrl);

    if ("caches" in window) {
      try {
        const cache = await caches.open(profilePhotoCacheName());
        await cache.put(
          profilePhotoCacheRequest(fileId),
          new Response(blob, {
            headers: {
              "Content-Type": blob.type || "image/jpeg",
              "Cache-Control": "private, max-age=31536000",
            },
          }),
        );
      } catch (error) {}
    }

    return objectUrl;
  };

  async function fetchProfilePhotoObjectUrl(fileId) {
    const cached = await readCachedProfilePhoto(fileId);
    if (cached) return cached;

    if (profilePhotoLoads.has(fileId)) {
      return profilePhotoLoads.get(fileId);
    }

    const request = (async () => {
      const result = await BRM.api(
        "profilePhotoData",
        { fileId },
        { noCache: true },
      );

      return BRM.cacheProfilePhoto(fileId, result.dataUrl);
    })();

    profilePhotoLoads.set(fileId, request);

    try {
      return await request;
    } finally {
      profilePhotoLoads.delete(fileId);
    }
  }

  BRM.hydrateProfilePhotos = async function (root = document) {
    const images = [
      ...(root.matches?.("[data-brm-profile-photo]") ? [root] : []),
      ...(root.querySelectorAll?.("[data-brm-profile-photo]") || []),
    ];

    images.forEach(async (image) => {
      if (image.dataset.brmPhotoStarted === "true") return;
      image.dataset.brmPhotoStarted = "true";

      const fileId = image.dataset.brmPhotoId || "";
      const directUrl = image.dataset.brmPhotoUrl || "";

      if (!fileId) {
        if (directUrl) displayProfilePhoto(image, directUrl);
        return;
      }

      try {
        const objectUrl = await fetchProfilePhotoObjectUrl(fileId);
        if (objectUrl) displayProfilePhoto(image, objectUrl);
      } catch (error) {
        console.warn("Profile photo could not be loaded:", error);

        // Older uploads may still have a public Drive URL. Try it only as a
        // fallback after authenticated loading fails.
        if (directUrl && !directUrl.startsWith("drivefile:")) {
          displayProfilePhoto(image, directUrl);
        }
      }
    });
  };

  BRM.avatar = function (name, photoUrl, size = "") {
    const cls = `avatar ${size ? `avatar-${size}` : ""}`;
    const initials = BRM.escape(BRM.initials(name));
    const value = String(photoUrl || "").trim();

    if (!value) {
      return `<span class="${cls}">${initials}</span>`;
    }

    const fileId = BRM.extractProfilePhotoFileId(value);

    return `
      <span class="${cls}" data-brm-avatar>
        <span data-brm-photo-fallback style="grid-area:1/1">${initials}</span>
        <img
          hidden
          data-brm-profile-photo
          data-brm-photo-id="${BRM.escape(fileId)}"
          data-brm-photo-url="${BRM.escape(value)}"
          style="grid-area:1/1"
          alt=""
        >
      </span>
    `;
  };

  function startProfilePhotoObserver() {
    BRM.hydrateProfilePhotos(document);

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            BRM.hydrateProfilePhotos(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startProfilePhotoObserver, {
      once: true,
    });
  } else {
    startProfilePhotoObserver();
  }

  BRM.departmentIcon = function (slug) {
    return (
      {
        "stage-management": "▣",
        ensemble: "♫",
        "principal-cast": "★",
        "pit-orchestra": "♬",
        props: "⚒",
        sets: "▰",
        costumes: "♛",
        lighting: "☀",
        sound: "◖",
        publicity: "◉",
        "front-of-house": "▧",
        directing: "◆",
        administration: "⚙",
      }[slug] || "◇"
    );
  };

  BRM.bindShell = function () {
    const savedCollapsed = localStorage.getItem("brmDesktopNavCollapsed") === "true";
    document.body.classList.toggle("desktop-nav-collapsed", savedCollapsed);
    const collapseButton = document.querySelector("[data-nav-collapse]");
    const syncCollapseButton = () => {
      const collapsed = document.body.classList.contains("desktop-nav-collapsed");
      if (!collapseButton) return;
      if (window.matchMedia("(max-width: 900px)").matches) {
        collapseButton.setAttribute("aria-label", "Close hubs menu");
        collapseButton.title = "Close hubs menu";
        collapseButton.innerHTML = "&times;";
        return;
      }
      collapseButton.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
      collapseButton.title = collapsed ? "Expand navigation" : "Collapse navigation";
      collapseButton.innerHTML = collapsed ? "&#x203A;" : "&#x2039;";
    };
    collapseButton?.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        document.body.classList.remove("menu-open");
        return;
      }
      const collapsed = document.body.classList.toggle("desktop-nav-collapsed");
      localStorage.setItem("brmDesktopNavCollapsed", String(collapsed));
      syncCollapseButton();
    });
    syncCollapseButton();
    const hubLauncher = document.querySelector("[data-hub-launcher]");
    const closeHubLauncher = () => {
      hubLauncher?.classList.remove("open");
      hubLauncher?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("hub-launcher-open");
    };
    document.querySelectorAll("[data-open-hubs]").forEach(button => button.addEventListener("click", () => {
      document.body.classList.remove("menu-open");
      hubLauncher?.classList.add("open");
      hubLauncher?.setAttribute("aria-hidden", "false");
      document.body.classList.add("hub-launcher-open");
      window.setTimeout(() => document.querySelector("[data-hub-search-input]")?.focus(), 80);
    }));
    document.querySelector("[data-close-hubs]")?.addEventListener("click", closeHubLauncher);
    hubLauncher?.addEventListener("click", event => { if (event.target === hubLauncher) closeHubLauncher(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeHubLauncher(); });
    const hubCards = [...document.querySelectorAll("[data-hub-key]")];
    const readHubList = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
    let pinnedHubs = readHubList("brmPinnedHubs");
    let recentHubs = readHubList("brmRecentHubs");
    let hubMode = BRM.isAdmin() ? (localStorage.getItem("brmHubMode") || "production") : "production";
    let activeHubCategory = localStorage.getItem("brmHubCategory") || (BRM.isAdmin() && hubMode === "admin" ? "administration" : "production");
    if (!document.querySelector(`[data-hub-tab="${activeHubCategory}"]`)) activeHubCategory = "production";
    const shortcutMarkup = keys => keys.map(key => {
      const card = hubCards.find(item => item.dataset.hubKey === key);
      return card ? `<a href="${card.dataset.hubKey}" data-hub-recent-link="${BRM.escape(card.dataset.hubKey)}"><span>${card.dataset.hubIcon}</span><strong>${card.dataset.hubTitle}</strong></a>` : "";
    }).join("");
    const renderHubShortcuts = () => {
      hubCards.forEach(card => {
        const pinned = pinnedHubs.includes(card.dataset.hubKey), button = card.querySelector("[data-hub-favorite]");
        card.classList.toggle("is-pinned", pinned);
        if (button) { button.textContent = pinned ? "★" : "☆"; button.title = pinned ? "Unpin workspace" : "Pin workspace"; }
      });
      const pinnedHost = document.querySelector("[data-hub-pinned]"), recentHost = document.querySelector("[data-hub-recent]");
      if (pinnedHost) pinnedHost.innerHTML = shortcutMarkup(pinnedHubs);
      if (recentHost) recentHost.innerHTML = shortcutMarkup(recentHubs.filter(key => !pinnedHubs.includes(key)));
      const hasPinned = Boolean(pinnedHost?.children.length), hasRecent = Boolean(recentHost?.children.length);
      document.querySelector("[data-hub-pinned-wrap]")?.toggleAttribute("hidden", !hasPinned);
      document.querySelector("[data-hub-recent-wrap]")?.toggleAttribute("hidden", !hasRecent);
      document.querySelector("[data-hub-shortcuts]")?.toggleAttribute("hidden", !(hasPinned || hasRecent));
    };
    const showHubCategory = category => {
      activeHubCategory = category;
      localStorage.setItem("brmHubCategory", category);
      document.querySelectorAll("[data-hub-tab]").forEach(tab => {
        const selected = tab.dataset.hubTab === category;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
      document.querySelectorAll("[data-hub-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.hubPanel === category));
    };
    const applyHubMode = mode => {
      hubMode = mode;
      localStorage.setItem("brmHubMode", mode);
      document.querySelectorAll("[data-hub-mode]").forEach(button => button.classList.toggle("active", button.dataset.hubMode === mode));
      const adminTab = document.querySelector('[data-hub-tab="administration"]');
      if (adminTab) adminTab.hidden = mode !== "admin";
      if (mode === "production" && activeHubCategory === "administration") showHubCategory("production");
      if (mode === "admin") showHubCategory("administration");
    };
    document.querySelectorAll("[data-hub-mode]").forEach(button => button.addEventListener("click", () => applyHubMode(button.dataset.hubMode)));
    document.querySelectorAll("[data-hub-tab]").forEach(tab => tab.addEventListener("click", () => {
      const search = document.querySelector("[data-hub-search-input]");
      if (search) search.value = "";
      document.querySelectorAll("[data-hub-search]").forEach(card => { card.hidden = false; });
      showHubCategory(tab.dataset.hubTab);
    }));
    hubCards.forEach(card => {
      card.querySelector("[data-hub-favorite]")?.addEventListener("click", () => {
        const key = card.dataset.hubKey;
        pinnedHubs = pinnedHubs.includes(key) ? pinnedHubs.filter(item => item !== key) : [key, ...pinnedHubs].slice(0, 8);
        localStorage.setItem("brmPinnedHubs", JSON.stringify(pinnedHubs));
        renderHubShortcuts();
      });
      card.querySelector("a")?.addEventListener("click", () => {
        recentHubs = [card.dataset.hubKey, ...recentHubs.filter(item => item !== card.dataset.hubKey)].slice(0, 5);
        localStorage.setItem("brmRecentHubs", JSON.stringify(recentHubs));
      });
    });
    hubLauncher?.addEventListener("click", event => {
      const shortcut = event.target.closest("[data-hub-recent-link]");
      if (!shortcut) return;
      recentHubs = [shortcut.dataset.hubRecentLink, ...recentHubs.filter(item => item !== shortcut.dataset.hubRecentLink)].slice(0, 5);
      localStorage.setItem("brmRecentHubs", JSON.stringify(recentHubs));
    });
    showHubCategory(activeHubCategory);
    if (BRM.isAdmin()) applyHubMode(hubMode);
    renderHubShortcuts();
    const setHubSignal = (href, text) => {
      const signal = document.querySelector(`[data-hub-key="${CSS.escape(href)}"] [data-hub-signal]`);
      if (!signal || !text) return;
      signal.textContent = text;
      signal.hidden = false;
    };
    Promise.allSettled([BRM.api("announcements"), BRM.api("myTasks", {includeCompleted:true})]).then(results => {
      const announcements = results[0].status === "fulfilled" ? results[0].value.data || [] : [];
      const tasks = results[1].status === "fulfilled" ? results[1].value.data || [] : [];
      const unread = announcements.filter(item => !item.IsRead).length;
      const openTasks = tasks.filter(item => !["Completed", "Cancelled"].includes(item.Status)).length;
      if (unread) setHubSignal("announcements.html", `${unread} unread`);
      if (openTasks) setHubSignal("tasks.html", `${openTasks} open`);
    });
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector("[data-open-hubs]")?.click();
      }
    });
    let hubTouchX = null;
    const launcherScroll = document.querySelector(".hub-launcher-scroll");
    launcherScroll?.addEventListener("touchstart", event => { hubTouchX = event.touches[0]?.clientX ?? null; }, {passive:true});
    launcherScroll?.addEventListener("touchend", event => {
      if (hubTouchX == null) return;
      const delta = (event.changedTouches[0]?.clientX ?? hubTouchX) - hubTouchX;
      hubTouchX = null;
      if (Math.abs(delta) < 70 || document.querySelector("[data-hub-search-input]")?.value) return;
      const tabs = [...document.querySelectorAll("[data-hub-tab]:not([hidden])")], current = tabs.findIndex(tab => tab.dataset.hubTab === activeHubCategory);
      const next = Math.max(0, Math.min(tabs.length - 1, current + (delta < 0 ? 1 : -1)));
      if (tabs[next] && next !== current) tabs[next].click();
    }, {passive:true});
    document.querySelector("[data-hub-search-input]")?.addEventListener("input", event => {
      const query = event.currentTarget.value.trim().toLowerCase();
      let visible = 0;
      document.querySelectorAll("[data-hub-search]").forEach(card => {
        const match = !query || card.dataset.hubSearch.includes(query);
        card.hidden = !match;
        if (match) visible += 1;
      });
      document.querySelectorAll("[data-hub-panel]").forEach(panel => {
        panel.classList.toggle("search-active", Boolean(query) && Boolean(panel.querySelector("[data-hub-search]:not([hidden])")));
        panel.classList.toggle("active", !query && panel.dataset.hubPanel === activeHubCategory);
      });
      document.querySelector(".hub-launcher-tabs")?.classList.toggle("searching", Boolean(query));
      const empty = document.querySelector("[data-hub-empty]");
      if (empty) empty.hidden = visible !== 0;
    });
    document.querySelectorAll("#sidebar .nav-link").forEach(link => link.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 900px)").matches) document.body.classList.remove("menu-open");
    }));
    document.addEventListener("click", event => {
      if (!document.body.classList.contains("menu-open")) return;
      if (event.target.closest("#sidebar,[data-open-hubs]")) return;
      document.body.classList.remove("menu-open");
    });
    document
      .querySelector("[data-menu-toggle]")
      ?.addEventListener("click", () =>
        document.body.classList.toggle("menu-open"),
      );
    document
      .querySelector("[data-theme-toggle]")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelector(".theme-picker")?.classList.toggle("open");
      });
    document.querySelectorAll("[data-set-theme]").forEach((btn) =>
      btn.addEventListener("click", () => {
        BRM.applyTheme(btn.dataset.setTheme);
        document.querySelector(".theme-picker")?.classList.remove("open");
      }),
    );
    document
      .querySelector("[data-customize-theme]")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelector(".theme-picker")?.classList.remove("open");
        BRM.openThemeStudio();
      });
    document.querySelectorAll("[data-logout]").forEach((logoutButton) =>
      logoutButton.addEventListener("click", async () => {
        try {
          await BRM.api("logout");
        } catch {}
        try {
          await BRM.clearSiteCache?.();
        } catch {}
        try {
          await BRM.signOutFirebase?.();
        } catch {}
        BRM.clearSession();
        location.href = "login.html";
      }),
    );
    document.addEventListener("click", () =>
      document.querySelector(".theme-picker")?.classList.remove("open"),
    );

    // Keep the current destination visible in the horizontally scrolling
    // mobile navigation without moving the page itself.
    const activeNavigationItem = document.querySelector(".main-nav .nav-link.active");
    if (activeNavigationItem && window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => {
        const navigation = activeNavigationItem.closest(".main-nav");
        navigation?.scrollTo({
          left:
            activeNavigationItem.offsetLeft -
            navigation.clientWidth / 2 +
            activeNavigationItem.clientWidth / 2,
          behavior: "instant",
        });
      });
    }
  };

  BRM.initPrivatePage = async function (render) {
    const launchParams = new URLSearchParams(location.search);
    const appInstall = launchParams.get("appInstall");
    if (appInstall) localStorage.setItem("brmAppInstall", appInstall);
    BRM.applyTheme(
      localStorage.getItem("brmTheme") || CONFIG.DEFAULT_THEME,
      false,
    );

    if (!BRM.getSessionValue("brmToken") && !BRM.isDemo()) {
      location.href = appInstall ? `login.html?appInstall=${encodeURIComponent(appInstall)}` : "login.html";
      return;
    }

    const stored = BRM.getStoredContext();

    if (stored) {
      BRM.context = stored;
      BRM.applyTheme(
        localStorage.getItem("brmTheme") ||
          stored.profile?.Theme ||
          stored.production?.DefaultTheme ||
          CONFIG.DEFAULT_THEME,
        false,
      );
      BRM.renderShell();
      BRM.setSyncStatus("cached", "Opening…");
    }

    try {
      let context = stored;

      if (BRM.isDemo()) {
        const result = await BRM.api("validateSession");
        context = result.context;
      } else {
        const snapshotDisabledUntil = Number(
          sessionStorage.getItem("brmSnapshotDisabledUntil") || 0,
        );

        if (
          CONFIG.SITE_SNAPSHOT_MODE !== "page-first" &&
          typeof BRM.ensureSiteSnapshot === "function" &&
          Date.now() >= snapshotDisabledUntil
        ) {
          try {
            const snapshot = await BRM.ensureSiteSnapshot();
            context = BRM.mergeCurrentContext(snapshot?.context, stored);
          } catch (snapshotError) {
            if (
              ["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(snapshotError.code)
            ) {
              throw snapshotError;
            }

            console.warn(
              "The one-request portal snapshot failed. Falling back to direct page requests.",
              snapshotError,
            );

            sessionStorage.setItem(
              "brmSnapshotDisabledUntil",
              String(Date.now() + 5 * 60 * 1000),
            );

            BRM.setSyncStatus("offline", "Direct mode");
          }
        }

        if (!context) {
          const result = await BRM.api(
            "validateSession",
            {},
            { forceNetwork: true, noCache: true },
          );
          context = result.context;
        }
      }

      context = BRM.mergeCurrentContext(context, stored);
      BRM.context = context;
      BRM.storeSessionContext(context);

      if (
        context.mustChangePassword &&
        document.body.dataset.page !== "profile"
      ) {
        location.href = "profile.html?password=required";
        return;
      }

      BRM.applyTheme(
        localStorage.getItem("brmTheme") ||
          context.profile?.Theme ||
          context.production?.DefaultTheme ||
          CONFIG.DEFAULT_THEME,
        false,
      );

      await BRM.loadAccountTheme?.();

      BRM.renderShell();
      BRM.setSyncStatus("ready", "Portal ready");

      if (!BRM.canAccessPage(document.body.dataset.page, context)) {
        BRM.toast("You do not have access to that workspace.", "error");
        location.href = "dashboard.html";
        return;
      }

      await render(context);
    } catch (error) {
      const hasUsableStoredContext = Boolean(
        stored && BRM.getSessionValue("brmToken"),
      );

      if (
        hasUsableStoredContext &&
        !["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error.code)
      ) {
        BRM.context = stored;
        BRM.renderShell();
        BRM.setSyncStatus("offline", "Using saved data");

        try {
          await render(stored);
          BRM.toast(
            "The server could not refresh, so saved portal data is being used.",
            "info",
          );
          return;
        } catch {}
      }

      if (["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error.code)) {
        BRM.clearSession();

        if (!BRM.isDemo()) {
          location.href = `login.html?reason=${encodeURIComponent(error.message)}`;
          return;
        }
      }

      if (BRM.isDemo()) {
        BRM.toast(error.message, "error");
        return;
      }

      const appMain = document.querySelector("#app-main");
      if (appMain) {
        appMain.innerHTML = `
          <div class="alert alert-error">
            <strong>This page could not refresh.</strong><br>
            ${BRM.escape(error.message || "Unknown portal error")}
            <div style="margin-top:12px">
              <button class="button button-secondary" onclick="location.reload()">Try again</button>
            </div>
          </div>
        `;
      }
    }
  };

  BRM.initPublicPage = function () {
    BRM.applyTheme(
      localStorage.getItem("brmTheme") || CONFIG.DEFAULT_THEME,
      false,
    );
    document
      .querySelectorAll("[data-theme-cycle]")
      .forEach((btn) => btn.addEventListener("click", BRM.cycleTheme));
    document
      .querySelectorAll("[data-set-theme]")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          BRM.applyTheme(btn.dataset.setTheme),
        ),
      );

    document.querySelectorAll(".public-nav").forEach((nav) => {
      const links = nav.querySelector(".public-links");
      if (!links || nav.querySelector("[data-public-menu]")) return;
      links.id ||= `public-links-${Math.random().toString(36).slice(2, 8)}`;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "public-menu-toggle icon-button";
      toggle.dataset.publicMenu = "";
      toggle.setAttribute("aria-controls", links.id);
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open site navigation");
      toggle.innerHTML = "<span aria-hidden=\"true\">☰</span>";
      nav.insertBefore(toggle, links);
      const close = () => {
        nav.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open site navigation");
      };
      toggle.addEventListener("click", () => {
        const open = !nav.classList.contains("menu-open");
        nav.classList.toggle("menu-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close site navigation" : "Open site navigation");
      });
      links.addEventListener("click", (event) => {
        if (event.target.closest("a")) close();
      });
      document.addEventListener("click", (event) => {
        if (!nav.contains(event.target)) close();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
    });
  };

  window.addEventListener("brm:sync-status", (event) => {
    BRM.setSyncStatus(event.detail?.state, event.detail?.message);
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.dataset.private) BRM.initPublicPage();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker
        .register(`service-worker.js?v=${encodeURIComponent(BRM.BUILD_ID)}`)
        .catch((error) => {
          console.warn("Offline support could not start:", error);
        });
    }
  });
})(window.BRM);
