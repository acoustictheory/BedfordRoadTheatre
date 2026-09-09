window.BRM = window.BRM || {};

(function (BRM) {
  const config = window.BRM_CONFIG || {};
  const firebaseConfig = config.FIREBASE;
  let modulesPromise = null;

  function syntheticEmail(username) {
    const normalized = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(normalized)) throw new Error('Enter a valid username.');
    return `${normalized}@users.bedford-musical.invalid`;
  }

  async function modules() {
    if (!firebaseConfig || config.FIREBASE_MODE === 'off') return null;
    if (!modulesPromise) {
      modulesPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
      ]).then(([appModule, authModule]) => {
        const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
        return { auth: authModule.getAuth(app), authModule };
      });
    }
    return modulesPromise;
  }

  BRM.firebaseAuthEnabled = () => Boolean(firebaseConfig && config.FIREBASE_MODE !== 'off');
  BRM.signInFirebase = async function (username, password) {
    const loaded = await modules();
    if (!loaded) return null;
    const credential = await loaded.authModule.signInWithEmailAndPassword(
      loaded.auth,
      syntheticEmail(username),
      password
    );
    const idToken = await credential.user.getIdToken();
    sessionStorage.setItem('brmFirebaseUid', credential.user.uid);
    sessionStorage.setItem('brmFirebaseIdToken', idToken);
    return { uid: credential.user.uid, idToken };
  };
  BRM.signOutFirebase = async function () {
    try {
      const loaded = await modules();
      if (loaded) await loaded.authModule.signOut(loaded.auth);
    } finally {
      sessionStorage.removeItem('brmFirebaseUid');
      sessionStorage.removeItem('brmFirebaseIdToken');
    }
  };
  BRM.firebaseIdToken = async function (forceRefresh = false) {
    const loaded = await modules();
    if (!loaded) throw new Error('Firebase is unavailable.');
    await loaded.auth.authStateReady();
    if (!loaded.auth.currentUser) throw new Error('Please sign in.');
    const token = await loaded.auth.currentUser.getIdToken(forceRefresh);
    sessionStorage.setItem('brmFirebaseIdToken', token);
    return token;
  };
})(window.BRM);
