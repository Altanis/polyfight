const firebase =
{
  /** @ts-ignore */
  app: window.app,
  /** @ts-ignore */
  auth: window.auth,
  /** @ts-ignore */
  provider: window.provider,
  /** @ts-ignore */
  GoogleAuthProvider: window.GoogleAuthProvider,
  /** @ts-ignore */
  signInWithPopup: window.signInWithPopup,
  /** @ts-ignore */
  signOut: window.signOut,
  /** @ts-ignore */
  onAuthStateChanged: window.onAuthStateChanged
};

export default firebase;