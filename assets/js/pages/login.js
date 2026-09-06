let firebaseLoginModulesPromise = null;

async function signInToFirebase(username, password, trustedDevice = true, portalToken = "") {
  const config = window.BRM_CONFIG || {};
  if (!config.FIREBASE || config.FIREBASE_MODE === "off") return null;
  firebaseLoginModulesPromise ||= Promise.all([
    import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),
  ]);
  const [appModule, authModule] = await firebaseLoginModulesPromise;
  const app = appModule.getApps().length
    ? appModule.getApp()
    : appModule.initializeApp(config.FIREBASE);
  const normalized = String(username || "")
    .trim()
    .toLowerCase();
  const auth = authModule.getAuth(app);
  await authModule.setPersistence(auth, trustedDevice ? authModule.browserLocalPersistence : authModule.browserSessionPersistence);
  let credential;
  if (config.FIREBASE_APP_SIGN_IN_URL && portalToken) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(config.FIREBASE_APP_SIGN_IN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: portalToken, trustedDevice }),
        signal: controller.signal,
      });
      const bridge = await response.json();
      if (!response.ok || !bridge.customToken)
        throw new Error(bridge.error || "Secure Community sign-in failed.");
      credential = await authModule.signInWithCustomToken(auth, bridge.customToken);
    } finally {
      window.clearTimeout(timeout);
    }
  } else {
    credential = await authModule.signInWithEmailAndPassword(
      auth,
      `${normalized}@users.bedford-musical.invalid`,
      password,
    );
  }
  sessionStorage.setItem("brmFirebaseUid", credential.user.uid);
  sessionStorage.setItem(
    "brmFirebaseIdToken",
    await credential.user.getIdToken(),
  );
  return credential.user.uid;
}

async function registerWithFirebase(form) {
  const url = window.BRM_CONFIG?.FIREBASE_REGISTRATION_URL;
  if (!url) throw new Error("Firebase registration is not configured.");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || !result.success)
      throw new Error(result.error || "Registration could not be completed.");
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll("[data-auth-tab]");
  const panels = document.querySelectorAll("[data-auth-panel]");
  const departmentOptions = document.querySelector("[data-department-options]");
  const registrationForm = document.querySelector("[data-register-form]");
  const registrationPendingKey = "brmPendingRegistration";
  const emailField = registrationForm
    ?.querySelector('input[name="email"]')
    ?.closest(".field");
  emailField?.insertAdjacentHTML(
    "afterend",
    `<div class="field span-2 class-registration"><label>Are you currently in a Bedford theatre class?</label><p class="field-hint" style="margin:0 0 10px">Select every class program that applies, or choose “Not currently in a theatre class.” Your selection controls the Class Spaces shown in the app.</p><div class="grid grid-2"><label class="checkbox-row"><input type="checkbox" name="classSpaceKeys" value="none" data-no-class> Not currently in a theatre class</label><label class="checkbox-row"><input type="checkbox" name="classSpaceKeys" value="musical-theatre"> Musical Theatre 10/20/30</label><label class="checkbox-row"><input type="checkbox" name="classSpaceKeys" value="theatre-arts"> Theatre Arts 20/30</label></div></div>`,
  );
  registrationForm
    ?.querySelectorAll('input[name="classSpaceKeys"]')
    .forEach((input) =>
      input.addEventListener("change", () => {
        const none = registrationForm.querySelector("[data-no-class]");
        if (input === none && none.checked) {
          registrationForm
            .querySelectorAll(
              'input[name="classSpaceKeys"]:not([data-no-class])',
            )
            .forEach((box) => (box.checked = false));
        } else if (input.checked) none.checked = false;
      }),
    );

  const setRegistrationBusy = (busy, message) => {
    registrationForm
      ?.querySelectorAll("input,textarea,button")
      .forEach((control) => {
        control.disabled = busy;
      });
    const button = registrationForm?.querySelector('button[type="submit"]');
    if (button)
      button.textContent = busy
        ? message || "Creating account…"
        : "Create account";
  };

  async function waitForRegistration(requestId) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const status = await BRM.api(
        "registrationStatus",
        { registrationRequestId: requestId },
        { public: true, noCache: true, timeoutMs: 12000 },
      ).catch(() => null);
      if (status?.userId) return status;
    }
    throw new Error(
      "Registration is taking unusually long. Your request is saved—do not create another account. Ask an administrator to check People & Access.",
    );
  }

  const switchTab = (id) => {
    tabs.forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.authTab === id),
    );
    panels.forEach((panel) =>
      panel.classList.toggle("hidden", panel.dataset.authPanel !== id),
    );
  };

  tabs.forEach((tab) =>
    tab.addEventListener("click", () => switchTab(tab.dataset.authTab)),
  );

  const params = new URLSearchParams(location.search);
  if (params.get("reason")) BRM.toast(params.get("reason"), "error");
  if (BRM.isDemo())
    document.querySelector("[data-demo-notice]")?.classList.remove("hidden");

  async function loadRegistrationDepartments() {
    if (!departmentOptions) return;

    try {
      const result = await BRM.api(
        "registrationOptions",
        {},
        {
          public: true,
          noCache: true,
        },
      );

      const departments = result.departments || [];

      departmentOptions.innerHTML = departments.length
        ? departments
            .map(
              (department) => `
            <label class="checkbox-row" style="align-items:flex-start">
              <input
                type="checkbox"
                name="requestedDepartmentIds"
                value="${BRM.escape(department.DepartmentID)}"
              >
              <span>
                <strong>${BRM.escape(department.Name)}</strong>
                <small style="display:block;color:var(--muted);margin-top:3px">
                  ${BRM.escape(department.Description || "")}
                </small>
              </span>
            </label>
          `,
            )
            .join("")
        : '<div class="alert alert-info">No student-requestable production areas are currently available.</div>';
    } catch (error) {
      departmentOptions.innerHTML = `
        <div class="alert alert-error">
          Production areas could not be loaded. You can still create an account
          and request areas from your profile after signing in.
        </div>
      `;
    }
  }

  document
    .querySelector("[data-login-form]")
    .addEventListener("submit", async (event) => {
      event.preventDefault();

      const button =
        event.submitter || event.currentTarget.querySelector("button");
      const form = Object.fromEntries(new FormData(event.currentTarget));
      const trustedDevice = form.trustedDevice === "true";

      button.disabled = true;
      button.textContent = "Signing in…";

      try {
        const result = await BRM.api("login", form, { public: true });
        if (window.BRM_CONFIG.FIREBASE_MODE !== "off") {
          try {
            await signInToFirebase(
              form.username,
              form.password,
              trustedDevice,
              result.token,
            );
          } catch (firebaseError) {
            console.warn(
              "Firebase shadow sign-in did not complete:",
              firebaseError.code || firebaseError.message,
            );
          }
        }
        BRM.setSession(result.token, result.user, trustedDevice);
        BRM.applyTheme(
          result.user.profile?.Theme ||
            result.user.production?.DefaultTheme ||
            window.BRM_CONFIG.DEFAULT_THEME,
        );
        const appInstall =
          new URLSearchParams(location.search).get("appInstall") ||
          localStorage.getItem("brmAppInstall");
        if (appInstall) localStorage.setItem("brmAppInstall", appInstall);
        location.href = appInstall
          ? `communications.html?appInstall=${encodeURIComponent(appInstall)}`
          : "dashboard.html";
      } catch (error) {
        BRM.toast(error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = "Sign in";
      }
    });

  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const form = Object.fromEntries(formData);
    form.requestedDepartmentIds = formData.getAll("requestedDepartmentIds");
    form.classSpaceKeys = formData
      .getAll("classSpaceKeys")
      .filter((key) => key !== "none");

    if (form.password !== form.confirmPassword) {
      BRM.toast("Passwords do not match.", "error");
      return;
    }

    const button =
      event.submitter || event.currentTarget.querySelector("button");
    const username = String(form.username || "")
      .trim()
      .toLowerCase();
    let pending;
    try {
      pending = JSON.parse(
        localStorage.getItem(registrationPendingKey) || "null",
      );
    } catch {}
    const requestId =
      pending?.username === username && pending?.requestId
        ? pending.requestId
        : crypto.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    form.registrationRequestId = requestId;
    localStorage.setItem(
      registrationPendingKey,
      JSON.stringify({ requestId, username, startedAt: Date.now() }),
    );
    setRegistrationBusy(true, "Creating account… please wait");

    try {
      const firebaseResult = await registerWithFirebase(form);
      button.textContent = "Applying production access…";
      const result = await BRM.api(
        "completeFirebaseRegistration",
        {
          mirrorToken: firebaseResult.mirrorToken,
          mirrorSignature: firebaseResult.mirrorSignature,
        },
        { public: true, noCache: true, timeoutMs: 45000 },
      );
      await signInToFirebase(form.username, form.password);
      localStorage.removeItem(registrationPendingKey);
      BRM.setSession(result.token, result.user);
      BRM.applyTheme(
        result.user.profile?.Theme ||
          result.user.production?.DefaultTheme ||
          window.BRM_CONFIG.DEFAULT_THEME,
      );
      BRM.toast(result.message || "Account created.");
      const appInstall =
        new URLSearchParams(location.search).get("appInstall") ||
        localStorage.getItem("brmAppInstall");
      if (appInstall) localStorage.setItem("brmAppInstall", appInstall);
      location.href = appInstall
        ? `communications.html?appInstall=${encodeURIComponent(appInstall)}`
        : "dashboard.html";
    } catch (error) {
      BRM.toast(error.message, "error");
    } finally {
      setRegistrationBusy(false);
    }
  });

  loadRegistrationDepartments();
});
