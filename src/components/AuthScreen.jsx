import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "@firebase/auth";
import { LockKeyhole, MailCheck, UserRoundPlus } from "lucide-react";
import { auth } from "../firebase";

function getAuthErrorMessage(error) {
  if (!error.code && error.name === "TypeError") {
    return "Could not reach the sign-in or verification service. Check your connection and try again.";
  }
  const messages = {
    "auth/configuration-not-found":
      "Firebase Authentication is not initialized for this project. In Firebase Console, open Authentication → Get started, enable Email/Password and Google sign-in, and authorize localhost and 127.0.0.1.",
    "auth/email-already-in-use": "An account already uses this email.",
    "auth/invalid-credential":
      "Those sign-in details were not accepted. Check your email and password, or use the Google account linked to this account.",
    "auth/invalid-login-credentials":
      "Email or password is incorrect. Check your details or reset your password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/operation-not-allowed":
      "This sign-in method is disabled. Enable Email/Password or Google in Firebase Authentication.",
    "auth/unauthorized-domain":
      "Add this site's domain to Firebase Authentication's authorized domains.",
    "auth/invalid-api-key": "Firebase API key configuration is invalid.",
    "auth/api-key-not-valid":
      "Firebase rejected this API key. Check that the key belongs to the configured Firebase project.",
    "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/network-request-failed": "Network error. Check your connection and retry.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found":
      "No account was found for this email. Create an account or try Google sign-in.",
    "auth/wrong-password": "The password is incorrect. Try again or reset it.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked":
      "The browser blocked the Google sign-in window. Allow pop-ups and try again.",
    "auth/account-exists-with-different-credential":
      "This email already uses another sign-in method. Sign in with that method first.",
  };
  return (
    messages[error.code] ||
    error.message ||
    "Sign-in failed. Check your Firebase Authentication setup and try again."
  );
}

export default function AuthScreen({
  user = null,
  initialError = "",
  onSendVerification,
  onRefreshVerification,
  onSignOut,
  onRetry,
}) {
  const [mode, setMode] = useState("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice("Password reset instructions were sent to your email.");
      } else if (mode === "sign-up") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }
        await sendEmailVerification(credential.user);
        setNotice("Account created. Open the verification link sent to your email.");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await onSendVerification();
      setNotice("Verification email sent. Check your inbox and spam folder.");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await onRefreshVerification();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="theme-dark min-h-screen flex items-center justify-center p-4">
        <section className="hm-surface hm-border w-full max-w-sm space-y-4 rounded-2xl border p-6 text-center">
          <MailCheck size={30} className="mx-auto" />
          <h1 className="text-lg font-extrabold">Verify your email</h1>
          <p className="text-sm hm-text-muted">
            Confirm <strong>{user.email}</strong> before accessing financial data.
          </p>
          {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
          {notice && <p className="text-sm font-semibold text-emerald-500">{notice}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={handleRefreshVerification}
            className="hm-btn-primary w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
          >
            I’ve verified my email
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleResendVerification}
            className="w-full rounded-xl border hm-border py-2.5 text-sm font-bold disabled:opacity-50"
          >
            Resend verification email
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs font-semibold hm-text-muted underline"
          >
            Sign out
          </button>
        </section>
      </div>
    );
  }

  const title =
    mode === "sign-up"
      ? "Create your account"
      : mode === "reset"
        ? "Reset your password"
        : "Welcome back";

  return (
    <div className="theme-dark min-h-screen flex items-center justify-center p-4">
      <section className="hm-surface hm-border w-full max-w-sm space-y-5 rounded-2xl border p-6 shadow-2xl">
        <div className="space-y-1 text-center">
          {mode === "sign-up" ? (
            <UserRoundPlus size={28} className="mx-auto mb-2" />
          ) : (
            <LockKeyhole size={28} className="mx-auto mb-2" />
          )}
          <h1 className="text-lg font-extrabold">{title}</h1>
          <p className="text-xs hm-text-muted">
            Your finance data is private to your account.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3"
        >
          {mode === "sign-up" && (
            <label className="block space-y-1 text-xs font-bold">
              Name
              <input
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="hm-input w-full"
                maxLength={80}
              />
            </label>
          )}
          <label className="block space-y-1 text-xs font-bold">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="hm-input w-full"
              maxLength={254}
            />
          </label>
          {mode !== "reset" && (
            <label className="block space-y-1 text-xs font-bold">
              Password
              <input
                type="password"
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="hm-input w-full"
              />
            </label>
          )}

          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
          {notice && <p className="text-xs font-semibold text-emerald-500">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="hm-btn-primary w-full rounded-xl py-2.5 text-sm font-extrabold disabled:opacity-50"
          >
            {busy
              ? "Please wait…"
                : mode === "sign-up"
                  ? "Create account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
          </button>
        </form>

        {mode !== "reset" && (
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleSignIn}
            className="w-full rounded-xl border hm-border py-2.5 text-sm font-bold disabled:opacity-50"
          >
            Continue with Google
          </button>
        )}

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
          {mode === "sign-in" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setError("");
                  setNotice("");
                }}
                className="font-semibold hm-text-muted underline"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("sign-up");
                  setError("");
                  setNotice("");
                }}
                className="font-semibold hm-text-muted underline"
              >
                Create account
              </button>
            </>
          )}
          {mode !== "sign-in" && (
            <button
              type="button"
              onClick={() => {
                setMode("sign-in");
                setError("");
                setNotice("");
              }}
              className="font-semibold hm-text-muted underline"
            >
              Back to sign in
            </button>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="block w-full text-center text-xs font-semibold hm-text-muted underline"
          >
            Retry
          </button>
        )}
      </section>
    </div>
  );
}
