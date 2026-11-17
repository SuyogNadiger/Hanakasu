import React, { useEffect, useState } from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  setPersistence,
  signOut,
} from "@firebase/auth";
import AuthScreen from "./AuthScreen";
import { auth, firebaseConfigured } from "../firebase";

export default function AuthGate({ children }) {
  const [session, setSession] = useState({ user: null, loading: true, error: "" });

  useEffect(() => {
    if (!firebaseConfigured || !auth) return undefined;
    let active = true;
    let unsubscribe;

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        if (!active) return;
        unsubscribe = onAuthStateChanged(
          auth,
          (user) => setSession({ user, loading: false, error: "" }),
          (error) =>
            setSession({
              user: null,
              loading: false,
              error: error.message || "Unable to restore your session.",
            }),
        );
      })
      .catch((error) => {
        if (active) {
          setSession({
            user: null,
            loading: false,
            error: error.message || "Unable to initialize authentication.",
          });
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  if (!firebaseConfigured) {
    return (
      <div className="theme-dark min-h-screen flex items-center justify-center p-4">
        <section className="hm-surface hm-border w-full max-w-lg space-y-4 rounded-2xl border p-6">
          <h1 className="text-lg font-extrabold">Firebase setup required</h1>
          <p className="text-sm hm-text-muted">
            Authentication and private cloud storage are not configured yet.
            Create a Firebase project, initialize Authentication, enable
            Email/Password and Google sign-in, and create Cloud Firestore.
            Then add the client settings to your environment.
          </p>
          <p className="rounded-xl border hm-border p-3 font-mono-num text-xs">
            VITE_FIREBASE_API_KEY<br />
            VITE_FIREBASE_AUTH_DOMAIN<br />
            VITE_FIREBASE_PROJECT_ID<br />
            VITE_FIREBASE_APP_ID
          </p>
          <p className="text-xs hm-text-muted">
            Deploy the included firestore.rules before enabling user
            accounts. Until then, financial data is not loaded.
          </p>
        </section>
      </div>
    );
  }

  if (session.loading) {
    return (
      <div className="theme-dark min-h-screen flex items-center justify-center">
        <p className="text-sm font-semibold hm-text-muted">Checking account…</p>
      </div>
    );
  }

  if (session.error) {
    return (
      <AuthScreen
        initialError={session.error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!session.user) {
    return <AuthScreen />;
  }

  if (!session.user.emailVerified) {
    return (
      <AuthScreen
        user={session.user}
        onSendVerification={() => sendEmailVerification(session.user)}
        onRefreshVerification={async () => {
          await reload(session.user);
          await auth.currentUser?.getIdToken(true);
          setSession({
            user: auth.currentUser,
            loading: false,
            error: "",
          });
        }}
        onSignOut={() => signOut(auth)}
      />
    );
  }

  return children({
    user: session.user,
    onSignOut: () => signOut(auth),
  });
}
