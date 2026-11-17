import { auth, firebaseApp } from "../firebase.js";

function validateUserUid(uid) {
  if (!firebaseApp) {
    throw new Error("Firebase is not configured.");
  }
  if (typeof uid !== "string" || !uid || uid.length > 128) {
    throw new Error("A valid signed-in user is required.");
  }
}

function getCurrentUser(uid) {
  const currentUser = auth?.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    const error = new Error("Your Firebase sign-in session is no longer active. Sign in again to sync.");
    error.code = "unauthenticated";
    throw error;
  }
  return currentUser;
}

export function subscribeToUserData(uid, onData, onError) {
  validateUserUid(uid);
  let cancelled = false;
  let unsubscribe = () => {};

  const startSubscription = async () => {
    try {
      await getCurrentUser(uid).getIdToken(true);
      if (cancelled) return;
      const { subscribeToFirestoreUserData } = await import("./firestoreClient.js");
      if (cancelled) return;
      unsubscribe = subscribeToFirestoreUserData(uid, onData, onError);
    } catch (error) {
      if (!cancelled) onError(error);
    }
  };
  void startSubscription();

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export async function saveUserData(uid, data) {
  validateUserUid(uid);
  getCurrentUser(uid);
  const serializableData = JSON.parse(JSON.stringify(data));
  const { saveFirestoreUserData } = await import("./firestoreClient.js");
  await saveFirestoreUserData(uid, serializableData);
}
