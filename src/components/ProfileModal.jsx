import React, { useState } from 'react';
import {
  Mail, Download, Upload, CheckCircle2, RotateCcw,
  Lock, KeyRound, AlertTriangle
} from 'lucide-react';
import { triggerWorkableAlert } from '../engine/financeEngine';

export default function ProfileModal({
  data,
  theme,
  onSaveProfileAndSettings,
  onExportJSON,
  onImportJSON,
  onResetAll
}) {
  const [draftProfile, setDraftProfile] = useState(data.profile || {});
  const [draftSettings, setDraftSettings] = useState(data.settings || {});
  const [previousData, setPreviousData] = useState({
    profile: data.profile,
    settings: data.settings
  });

  const [generatedEmailOtp, setGeneratedEmailOtp] = useState(null);
  const [emailOtpInput, setEmailOtpInput] = useState('');

  const [isEditingPin, setIsEditingPin] = useState(false);
  const [newPinDraft, setNewPinDraft] = useState('');
  const [generatedPinOtp, setGeneratedPinOtp] = useState(null);
  const [pinOtpInput, setPinOtpInput] = useState('');
  const [pinChangeVerified, setPinChangeVerified] = useState(false);

  const [floater, setFloater] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetCredential, setResetCredential] = useState('');
  const [resetOtp, setResetOtp] = useState(null);
  const [resetOtpInput, setResetOtpInput] = useState('');

  const triggerFloater = (type, message) => {
    setFloater({ type, message });
    setTimeout(() => setFloater(null), 4000);
  };

  if (data.profile !== previousData.profile || data.settings !== previousData.settings) {
    setPreviousData({ profile: data.profile, settings: data.settings });
    setDraftProfile({ ...(data.profile || {}) });
    setDraftSettings({ ...(data.settings || {}) });
    setIsEditingPin(false);
    setNewPinDraft(data.settings?.pinCode || '');
  }

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftProfile.email || '');

  // 1. Send OTP to Verify Email Address
  const handleSendEmailOtp = async () => {
    if (!isEmailValid) {
      triggerFloater('error', 'Enter a valid email address first.');
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const delivered = await triggerWorkableAlert({
      subject: 'Hanakasu Mantri — Email Verification Code',
      message: `Use the verification code below to confirm your alert email address in Hanakasu Mantri.`,
      profile: draftProfile,
      theme,
      badge: 'IDENTITY VERIFICATION',
      codeHighlight: code
    });
    if (!delivered) {
      triggerFloater('error', 'Email could not be sent. Check the deployment webhook configuration and retry.');
      return;
    }
    setGeneratedEmailOtp(code);
    triggerFloater('info', `Verification OTP sent to ${draftProfile.email}.`);
  };

  // POINT 1 FIX: Immediately persist verified email to App state & localStorage so refresh/tab switch never loses it!
  const handleVerifyEmailOtp = () => {
    if (emailOtpInput.trim() === generatedEmailOtp) {
      const updatedProfile = {
        ...draftProfile,
        email: draftProfile.email.trim(),
        emailVerified: true
      };
      setDraftProfile(updatedProfile);
      onSaveProfileAndSettings(updatedProfile, draftSettings);
      setGeneratedEmailOtp(null);
      setEmailOtpInput('');
      triggerFloater('success', 'Email Verified & Permanently Saved ✓');
    } else {
      triggerFloater('error', 'Incorrect Email OTP code.');
    }
  };

  // 2. Send OTP to Authorize PIN Change
  const handleSendPinChangeOtp = async () => {
    if (!isEmailValid || !draftProfile.emailVerified) {
      triggerFloater('error', 'Verify your Email address first to receive the PIN authorization OTP.');
      return;
    }
    if (newPinDraft && !/^\d{4}$/.test(newPinDraft)) {
      triggerFloater('error', 'PIN must be exactly 4 digits.');
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const delivered = await triggerWorkableAlert({
      subject: 'Hanakasu Mantri — PIN Change Authorization Code',
      message: `Enter the security code below to authorize updating your 4-digit PIN in Hanakasu Mantri.`,
      profile: draftProfile,
      theme,
      badge: 'SECURITY PIN AUTHORIZATION',
      codeHighlight: code
    });
    if (!delivered) {
      triggerFloater('error', 'Email could not be sent. Check the deployment webhook configuration and retry.');
      return;
    }
    setGeneratedPinOtp(code);
    triggerFloater('info', `PIN authorization OTP sent to ${draftProfile.email}.`);
  };

  // Immediately persist new PIN upon OTP verification
  const handleVerifyPinOtp = () => {
    if (pinOtpInput.trim() === generatedPinOtp) {
      const updatedSettings = { ...draftSettings, pinCode: newPinDraft };
      setDraftSettings(updatedSettings);
      onSaveProfileAndSettings(draftProfile, updatedSettings);
      setPinChangeVerified(true);
      setGeneratedPinOtp(null);
      setPinOtpInput('');
      setIsEditingPin(false);
      triggerFloater('success', 'New 4-Digit PIN Authorized & Saved ✓');
    } else {
      triggerFloater('error', 'Invalid PIN OTP code. PIN was not changed.');
    }
  };

  const handleDiscard = () => {
    setDraftProfile({ ...(data.profile || {}) });
    setDraftSettings({ ...(data.settings || {}) });
    setGeneratedEmailOtp(null);
    setGeneratedPinOtp(null);
    setIsEditingPin(false);
    setPinChangeVerified(false);
    triggerFloater('info', 'Unsaved changes discarded.');
  };

  const handleOpenResetDialog = () => {
    setResetCredential('');
    setResetOtp(null);
    setResetOtpInput('');
    setResetDialogOpen(true);
  };

  const handleSendResetOtp = async () => {
    if (!data.profile?.email || !data.profile?.emailVerified) {
      triggerFloater('error', 'Verify an email address or set an app PIN before zeroing out data.');
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const delivered = await triggerWorkableAlert({
      subject: 'Hanakasu Mantri — Data Reset Authorization Code',
      message: 'Enter this one-time code in the app to authorize permanently deleting all saved finance data.',
      profile: data.profile,
      theme,
      badge: 'DATA RESET AUTHORIZATION',
      codeHighlight: code
    });
    if (!delivered) {
      triggerFloater('error', 'Email could not be sent. Check the deployment webhook configuration and retry.');
      return;
    }
    setResetOtp(code);
    triggerFloater('info', `Reset authorization OTP sent to ${data.profile.email}.`);
  };

  const handleConfirmReset = () => {
    const pinIsSet = Boolean(data.settings?.pinCode);
    const authorized = pinIsSet
      ? resetCredential === data.settings.pinCode
      : Boolean(resetOtp && resetOtpInput.trim() === resetOtp);
    if (!authorized) {
      triggerFloater('error', pinIsSet ? 'Incorrect PIN. No data was deleted.' : 'Invalid OTP. No data was deleted.');
      return;
    }
    onResetAll();
    setResetDialogOpen(false);
    setResetCredential('');
    setResetOtp(null);
    setResetOtpInput('');
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (draftProfile.email && !draftProfile.emailVerified) {
      triggerFloater('error', 'Changes NOT saved — Please verify your Email with OTP first.');
      return;
    }
    if (isEditingPin && !pinChangeVerified) {
      triggerFloater('error', 'Changes NOT saved — Please verify the PIN change OTP first.');
      return;
    }

    onSaveProfileAndSettings(draftProfile, draftSettings);
    triggerFloater('success', 'Changes Saved Successfully ✓ Your profile is locked in.');
  };

  return (
    <div className="max-w-5xl space-y-6 relative">
      {/* FLOATING CONFIRMATION TOAST */}
      {floater && (
        <div
          className={`fixed bottom-20 lg:bottom-8 right-6 z-50 max-w-md px-5 py-3.5 rounded-2xl border shadow-2xl flex items-center gap-3 text-xs font-extrabold transition-all ${
            floater.type === 'success'
              ? 'bg-[#1F150C] border-[#E1DCC9] text-[#E1DCC9]'
              : floater.type === 'error'
              ? 'bg-rose-950 border-rose-400 text-rose-200'
              : 'hm-surface hm-border'
          }`}
        >
          {floater.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          )}
          <span>{floater.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b hm-border pb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
            Account, privacy & backup controls
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">
            Profile & Security
          </h1>
          <p className="text-xs hm-text-muted mt-1">
            Manage your account details, verification, app lock and saved-data backups.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
        {/* 1. Core Holder Identity & Monthly Salary */}
        <div className="p-5 rounded-2xl border hm-surface hm-border space-y-4">
          <div>
            <h2 className="text-sm font-extrabold">Personal details</h2>
            <p className="text-[11px] hm-text-muted mt-0.5">Your name and income assumptions.</p>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block mb-1.5">
              Account Holder Name
            </label>
            <input
              type="text"
              value={draftProfile.name || ''}
              onChange={(e) => setDraftProfile({ ...draftProfile, name: e.target.value })}
              className="hm-input w-full"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block mb-1.5">
              Monthly Salary (₹)
            </label>
            <input
              type="number"
              value={draftProfile.monthlySalary ?? 0}
              onChange={(e) =>
                setDraftProfile({ ...draftProfile, monthlySalary: Number(e.target.value) })
              }
              className="hm-input font-mono-num w-full"
            />
          </div>
        </div>

        {/* 2. Verified Email Dispatch Channel (Auto-Persisted) */}
        <div className="p-5 rounded-2xl border hm-surface hm-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Mail size={15} /> Verified email
              </h2>
              <p className="text-[11px] hm-text-muted mt-0.5">
                Used for security verification and email alerts when the configured delivery service is available.
              </p>
            </div>
            {draftProfile.emailVerified ? (
              <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                <CheckCircle2 size={14} /> Permanently Verified
              </span>
            ) : (
              <span className="hm-text-muted text-[11px]">OTP Verification Required</span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              placeholder="yourname@gmail.com"
              value={draftProfile.email || ''}
              onChange={(e) => {
                const nextEmail = e.target.value;
                setDraftProfile({
                  ...draftProfile,
                  email: nextEmail,
                  emailVerified: nextEmail.trim() === data.profile?.email && Boolean(data.profile?.emailVerified)
                });
              }}
              className="hm-input flex-1"
            />
            {!draftProfile.emailVerified && (
              <button
                type="button"
                onClick={handleSendEmailOtp}
                className="px-4 py-2.5 rounded-xl hm-btn-primary font-extrabold cursor-pointer shrink-0"
              >
                Send Email OTP
              </button>
            )}
          </div>

          {generatedEmailOtp && !draftProfile.emailVerified && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP sent to your email"
                value={emailOtpInput}
                onChange={(e) => setEmailOtpInput(e.target.value)}
                className="hm-input font-mono-num flex-1"
              />
              <button
                type="button"
                onClick={handleVerifyEmailOtp}
                className="px-5 py-2 rounded-xl hm-btn-primary font-extrabold cursor-pointer"
              >
                Verify & Lock Email
              </button>
            </div>
          )}
        </div>

        {/* 3. 4-Digit Security PIN with Mandatory OTP Verification */}
        <div className="p-5 rounded-2xl border hm-surface hm-border space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Lock size={15} /> 4-Digit Security PIN (App & Total Saved Lock)
              </h2>
              <p className="text-[11px] hm-text-muted mt-0.5">
                Changing your PIN requires a 6-digit OTP sent to your verified email.
              </p>
            </div>

            {!isEditingPin ? (
              <button
                type="button"
                onClick={() => {
                  setIsEditingPin(true);
                  setNewPinDraft(draftSettings.pinCode || '');
                  setPinChangeVerified(false);
                }}
                className="px-3.5 py-2 rounded-xl border hm-elevated hm-border font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound size={13} /> {draftSettings.pinCode ? 'Change PIN via OTP' : 'Set PIN via OTP'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsEditingPin(false);
                  setGeneratedPinOtp(null);
                  setPinOtpInput('');
                }}
                className="text-xs hm-text-muted underline cursor-pointer"
              >
                Cancel PIN Change
              </button>
            )}
          </div>

          {!isEditingPin ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border hm-elevated hm-border">
              <span className="hm-text-muted font-semibold">Current PIN Status:</span>
              <span className="font-mono-num font-extrabold">
                {draftSettings.pinCode ? '•••• (Active)' : 'Not Set'}
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl border hm-elevated hm-border space-y-3">
              <div className="flex gap-2">
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Enter new 4-digit PIN"
                  value={newPinDraft}
                  onChange={(e) => setNewPinDraft(e.target.value.replace(/\D/g, ''))}
                  className="hm-input font-mono-num flex-1 text-center text-base font-extrabold tracking-widest"
                />
                <button
                  type="button"
                  onClick={handleSendPinChangeOtp}
                  className="px-4 py-2.5 rounded-xl hm-btn-primary font-extrabold cursor-pointer shrink-0"
                >
                  Send PIN OTP
                </button>
              </div>

              {generatedPinOtp && (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP from Email"
                    value={pinOtpInput}
                    onChange={(e) => setPinOtpInput(e.target.value)}
                    className="hm-input font-mono-num flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPinOtp}
                    className="px-5 py-2 rounded-xl hm-btn-primary font-extrabold cursor-pointer"
                  >
                    Authorize PIN
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Backup, Restore & Explicit Save / Discard */}
        <div className="p-5 rounded-2xl border hm-surface hm-border flex flex-wrap items-center justify-between gap-4 lg:col-span-2">
          <div>
            <h2 className="text-sm font-extrabold">Data & changes</h2>
            <p className="text-[11px] hm-text-muted mt-0.5">Export a backup before restoring or clearing your data.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportJSON}
              className="px-3.5 py-2.5 rounded-xl border hm-surface hm-border font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} /> Backup JSON
            </button>
            <label className="px-3.5 py-2.5 rounded-xl border hm-surface hm-border font-bold flex items-center gap-1.5 cursor-pointer">
              <Upload size={14} /> Restore JSON
              <input type="file" accept=".json" onChange={onImportJSON} className="hidden" />
            </label>
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t hm-border pt-4">
            <button
              type="button"
              onClick={handleOpenResetDialog}
              className="px-3.5 py-2.5 rounded-xl border border-rose-500/40 text-rose-500 font-bold cursor-pointer hover:bg-rose-500/10"
            >
              Zero-Out All Data
            </button>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDiscard}
                className="px-4 py-2.5 rounded-xl border hm-surface hm-border font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} /> Discard Changes
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </form>

      {resetDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-full max-w-md rounded-2xl border hm-surface hm-border p-6 shadow-2xl space-y-4"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Permanent action</p>
              <h2 id="reset-dialog-title" className="mt-1 text-lg font-extrabold">Zero out all saved data?</h2>
              <p className="mt-2 text-xs hm-text-muted">
                This removes your transactions, balances, goals, investments, alerts and settings from this device and syncs the reset.
                Export a backup first if you may need this data later.
              </p>
            </div>

            {data.settings?.pinCode ? (
              <div className="space-y-2">
                <label htmlFor="reset-pin" className="text-xs font-bold">Enter your app PIN to continue</label>
                <input
                  id="reset-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="current-password"
                  value={resetCredential}
                  onChange={(event) => setResetCredential(event.target.value.replace(/\D/g, ''))}
                  className="hm-input w-full font-mono-num text-center tracking-[0.4em]"
                />
              </div>
            ) : data.profile?.emailVerified && data.profile?.email ? (
              <div className="space-y-2">
                <p className="text-xs hm-text-muted">A one-time authorization code will be sent to {data.profile.email}.</p>
                {!resetOtp ? (
                  <button
                    type="button"
                    onClick={handleSendResetOtp}
                    className="w-full rounded-xl hm-btn-primary py-2.5 font-bold cursor-pointer"
                  >
                    Send Reset OTP
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="reset-otp" className="text-xs font-bold">Enter the 6-digit email code</label>
                    <input
                      id="reset-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={resetOtpInput}
                      onChange={(event) => setResetOtpInput(event.target.value.replace(/\D/g, ''))}
                      className="hm-input w-full font-mono-num text-center tracking-[0.4em]"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-semibold">
                Set an app PIN or verify an email address in this profile before you can authorize a data reset.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetDialogOpen(false)}
                className="rounded-xl border hm-border px-4 py-2.5 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={data.settings?.pinCode ? resetCredential.length !== 4 : !resetOtp}
                onClick={handleConfirmReset}
                className="rounded-xl bg-rose-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                Verify & Zero Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}