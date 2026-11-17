import {
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
} from "@firebase/firestore";
import { firebaseApp } from "../firebase.js";

const userDataReference = (uid) =>
  doc(getFirestore(firebaseApp), "users", uid, "appData", "current");

export function subscribeToFirestoreUserData(uid, onData, onError) {
  return onSnapshot(
    userDataReference(uid),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() : null),
    onError,
  );
}

export function saveFirestoreUserData(uid, data) {
  return setDoc(userDataReference(uid), data);
}
