import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  INITIAL_APP_DATA,
  hasLegacyFinancialPresets,
  removeLegacyFinancialPresets,
} from "./data/defaults";
import {
  computeFinancialState,
  getCurrentMonthKey,
  getTodayISO,
  getNextRecurrenceDateISO,
  formatDateDisplay,
  formatINR,
  triggerWorkableAlert,
} from "./engine/financeEngine";
import {
  saveUserData,
  subscribeToUserData,
} from "./data/userDataRepository";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import TransactionModal from "./components/TransactionModal";
import ProfileModal from "./components/ProfileModal";
import OverviewView from "./views/OverviewView";
import TransactionsView from "./views/TransactionsView";
import AccountsView from "./views/AccountsView";
import GoalsView from "./views/GoalsView";
import ReportsView from "./views/ReportsView";
import AutopayAlertsView from "./views/AutopayAlertsView";
import CategoriesView from "./views/CategoriesView";
import { Lock, BellRing, Plus } from "lucide-react";

const STORAGE_KEY = "hanakasu_manntri_v4";
const LEGACY_OWNER_UID_KEY = `${STORAGE_KEY}_legacy_owner_uid`;
const APP_TABS = new Set([
  "overview",
  "transactions",
  "accounts",
  "categories",
  "goals",
  "reports",
  "autopay",
  "profile",
]);

function getTabFromHash() {
  const tab = window.location.hash.slice(1);
  return APP_TABS.has(tab) ? tab : "overview";
}

function getLegacyImportStatus(uid, hasLegacyData, ownerUid) {
  if (!hasLegacyData || ownerUid === uid) return "hidden";
  return ownerUid ? "claimed" : "available";
}

function getSyncErrorMessage(error, action = "sync") {
  if (error?.code === "permission-denied") {
    return "Firestore denied access. Publish this project's firestore.rules and confirm the signed-in email is verified. Then sign out and back in.";
  }
  if (error?.code === "unauthenticated") {
    return "Your sign-in expired. Sign out and sign back in to sync.";
  }
  if (error?.code === "failed-precondition" || error?.code === "not-found") {
    return "Cloud Firestore is not available for this Firebase project. Create or enable its Firestore database, then retry.";
  }
  if (error?.code === "unavailable" || error?.code === "network-request-failed") {
    return "Cloud sync is temporarily unavailable. Check your connection and retry.";
  }
  return error?.message || `Unable to ${action} your cloud data.`;
}

function normalizeAppData(parsed, user) {
  const normalized = removeLegacyFinancialPresets({
    ...INITIAL_APP_DATA,
    ...parsed,
  });
  const emergencyReserve = parsed?.emergencyReserve
    ? { ...INITIAL_APP_DATA.emergencyReserve, ...parsed.emergencyReserve }
    : {
        name: "Emergency Reserve",
        sourceAccountId: "liquid_mf",
        amount: computeFinancialState(normalized, getCurrentMonthKey()).liquidMfBalance,
      };

  return {
    ...normalized,
    accounts: normalized.accounts.filter((account) => account.type !== "liquid_mf"),
    emergencyReserve,
    profile: {
      ...INITIAL_APP_DATA.profile,
      ...(parsed?.profile || {}),
      email: user.email || "",
      emailVerified: Boolean(user.emailVerified),
    },
    settings: { ...INITIAL_APP_DATA.settings, ...(parsed?.settings || {}) },
    lastUpdated: Number(parsed?.lastUpdated) || 0,
  };
}

function createDefaultUserData(user) {
  const accountName =
    user.displayName || user.email?.split("@")[0] || "User";
  return normalizeAppData({
    ...INITIAL_APP_DATA,
    profile: {
      ...INITIAL_APP_DATA.profile,
      name: accountName,
      email: user.email || "",
      emailVerified: Boolean(user.emailVerified),
    },
    lastUpdated: 0,
  }, user);
}

export default function App({ user, onSignOut }) {
  const [startWithTransactionShortcut] = useState(
    () => new URLSearchParams(window.location.search).get("action") === "new-transaction",
  );
  const storageKey = `${STORAGE_KEY}:${user.uid}`;
  const [legacyImportStatus, setLegacyImportStatus] = useState(() => {
    const hasScopedData = Boolean(localStorage.getItem(storageKey));
    const hasLegacyData = Boolean(localStorage.getItem(STORAGE_KEY));
    if (hasScopedData || !hasLegacyData) return "hidden";
    if (localStorage.getItem(LEGACY_OWNER_UID_KEY)) {
      return getLegacyImportStatus(
        user.uid,
        hasLegacyData,
        localStorage.getItem(LEGACY_OWNER_UID_KEY),
      );
    }
    return "checking";
  });
  const [legacyImportError, setLegacyImportError] = useState("");
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return normalizeAppData(JSON.parse(saved), user);
      } catch {
        return createDefaultUserData(user);
      }
    }
    return createDefaultUserData(user);
  });
  const [dataReady, setDataReady] = useState(() =>
    Boolean(localStorage.getItem(storageKey)),
  );

  const [syncStatus, setSyncStatus] = useState("syncing");
  const [syncError, setSyncError] = useState("");
  const dataRef = useRef(data);
  const initialCloudLoadRef = useRef(false);
  const lastWrittenDataRef = useRef(null);

  const updateLocalData = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const stamped = {
        ...next,
        profile: {
          ...next.profile,
          email: user.email || "",
          emailVerified: Boolean(user.emailVerified),
        },
        lastUpdated: Math.max(Date.now(), Number(prev.lastUpdated || 0) + 1),
      };
      dataRef.current = stamped;
      return stamped;
    });
  }, [user.email, user.emailVerified]);

  useEffect(() => {
    dataRef.current = data;
    if (dataReady && legacyImportStatus !== "available" && legacyImportStatus !== "checking") {
      localStorage.setItem(storageKey, JSON.stringify(data));
    }
    document.title = "Hanakasu Mantri";
  }, [data, dataReady, legacyImportStatus, storageKey]);

  const [activeTab, setActiveTab] = useState(() =>
    startWithTransactionShortcut ? "transactions" : getTabFromHash(),
  );
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [modalOpen, setModalOpen] = useState(() => startWithTransactionShortcut);
  const [quickEntrySaved, setQuickEntrySaved] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [lastDeletedTx, setLastDeletedTx] = useState(null);
  const [toastAlert, setToastAlert] = useState(null);
  const undoTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [unlocked, setUnlocked] = useState(() => !data.settings?.pinCode);
  const [pinInput, setPinInput] = useState("");

  const navigateToTab = useCallback((tab) => {
    if (!APP_TABS.has(tab) || tab === activeTab) return;
    const url = new URL(window.location.href);
    url.hash = tab;
    window.history.pushState({ tab }, "", url);
    setActiveTab(tab);
  }, [activeTab]);

  const addModalHistoryEntry = () => {
    if (window.history.state?.transactionModal) return;
    window.history.pushState(
      { ...(window.history.state || {}), transactionModal: true },
      "",
      window.location.href,
    );
  };

  const openTransactionModal = (transaction = null) => {
    setEditingTx(transaction);
    setModalOpen(true);
    addModalHistoryEntry();
  };

  const closeTransactionModal = () => {
    if (window.history.state?.transactionModal) {
      window.history.back();
      return;
    }
    setModalOpen(false);
    setEditingTx(null);
  };

  useEffect(() => {
    const handlePopState = () => {
      if (window.history.state?.transactionModal) {
        setModalOpen(true);
      } else {
        setActiveTab(getTabFromHash());
        setModalOpen(false);
        setEditingTx(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const theme = data.settings?.theme || "dark";

  const showConfirmation = (message) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastAlert(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastAlert(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  const finState = useMemo(
    () => computeFinancialState(data, selectedMonth),
    [data, selectedMonth],
  );

  const saveSnapshot = useCallback(async (snapshot, force = false) => {
    const canonicalSnapshot = normalizeAppData(snapshot, user);
    const serialized = JSON.stringify(canonicalSnapshot);
    if (!force && serialized === lastWrittenDataRef.current) return true;

    setSyncStatus("syncing");
    setSyncError("");
    try {
      await saveUserData(user.uid, canonicalSnapshot);
      lastWrittenDataRef.current = serialized;
      setSyncStatus("synced");
      return true;
    } catch (error) {
      setSyncStatus("error");
      setSyncError(getSyncErrorMessage(error));
      return false;
    }
  }, [user]);

  useEffect(() => {
    initialCloudLoadRef.current = false;
    const unsubscribe = subscribeToUserData(
      user.uid,
      (remoteValue) => {
        const remoteData = remoteValue ? normalizeAppData(remoteValue, user) : null;
        const remoteEmailChanged =
          remoteValue &&
          (remoteValue.profile?.email !== (user.email || "") ||
            remoteValue.profile?.emailVerified !== Boolean(user.emailVerified));
        const remoteNeedsCanonicalSave =
          remoteValue &&
          (hasLegacyFinancialPresets(remoteValue) ||
            !remoteValue.emergencyReserve ||
            remoteEmailChanged);
        const localData = dataRef.current;

        if (!initialCloudLoadRef.current) {
          initialCloudLoadRef.current = true;
          if (remoteData) {
            setDataReady(true);
            const claimedBy = localStorage.getItem(LEGACY_OWNER_UID_KEY);
            const hasLegacyData = Boolean(localStorage.getItem(STORAGE_KEY));
            setLegacyImportStatus(
              getLegacyImportStatus(user.uid, hasLegacyData, claimedBy),
            );
            if (Number(remoteData.lastUpdated) >= Number(localData.lastUpdated)) {
              const serialized = JSON.stringify(remoteData);
              lastWrittenDataRef.current = serialized;
              if (serialized !== JSON.stringify(localData)) {
                dataRef.current = remoteData;
                setData(remoteData);
              }
              setSyncStatus("synced");
              if (remoteEmailChanged || remoteNeedsCanonicalSave) {
                void saveSnapshot(remoteData, true);
              }
            } else {
              lastWrittenDataRef.current = null;
              void saveSnapshot(localData);
            }
            return;
          }

          if (Number(localData.lastUpdated) > 0) {
            setDataReady(true);
            setLegacyImportStatus("hidden");
            void saveSnapshot(localData);
            return;
          }

          const claimedBy = localStorage.getItem(LEGACY_OWNER_UID_KEY);
          const hasLegacyData = Boolean(localStorage.getItem(STORAGE_KEY));
          setLegacyImportStatus(
            getLegacyImportStatus(user.uid, hasLegacyData, claimedBy),
          );
          setDataReady(true);
          const seededData = {
            ...localData,
            lastUpdated: Date.now(),
          };
          dataRef.current = seededData;
          setData(seededData);
          return;
        }

        if (
          remoteData &&
          (Number(remoteData.lastUpdated) > Number(dataRef.current.lastUpdated) ||
            remoteNeedsCanonicalSave)
        ) {
          const serialized = JSON.stringify(remoteData);
          lastWrittenDataRef.current = serialized;
          dataRef.current = remoteData;
          setData(remoteData);
          setSyncStatus("synced");
          if (remoteEmailChanged || remoteNeedsCanonicalSave) {
            void saveSnapshot(remoteData, true);
          }
        }
      },
      (error) => {
        initialCloudLoadRef.current = true;
        setDataReady(true);
        const claimedBy = localStorage.getItem(LEGACY_OWNER_UID_KEY);
        const hasLegacyData = Boolean(localStorage.getItem(STORAGE_KEY));
        setLegacyImportStatus(
          getLegacyImportStatus(user.uid, hasLegacyData, claimedBy),
        );
        setSyncStatus("error");
        setSyncError(getSyncErrorMessage(error, "load"));
      },
    );

    return unsubscribe;
  }, [user, storageKey, saveSnapshot]);

  useEffect(() => {
    if (
      !initialCloudLoadRef.current ||
      legacyImportStatus === "available" ||
      legacyImportStatus === "checking"
    ) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastWrittenDataRef.current) return;
    const timer = window.setTimeout(() => {
      void saveSnapshot(data);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [data, legacyImportStatus, saveSnapshot]);

  const dispatchAlert = useCallback(async (message, badge = "PRIVATE LEDGER DISPATCH") => {
    const contact = data.profile?.email || "No profile email";
    const delivery = await triggerWorkableAlert({
      subject: `Hanakasu Mantri — ${badge}`,
      message,
      profile: data.profile,
      theme,
      badge,
    });
    const newLog = {
      id: "log_" + Date.now(),
      channel: `${delivery.accepted ? "Email service accepted" : "Email request failed"} → ${contact}`,
      message: delivery.accepted
        ? `${message} Inbox delivery is not confirmed.`
        : `${message} ${delivery.error}`,
      time: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    updateLocalData((prev) => ({
      ...prev,
      alertLogs: [newLog, ...(prev.alertLogs || [])],
    }));
    setToastAlert(
      delivery.accepted
        ? `Email service accepted the request for ${contact}. Inbox delivery is not confirmed.`
        : `Email request failed: ${delivery.error}`,
    );
    setTimeout(() => setToastAlert(null), 4500);
  }, [data.profile, theme, updateLocalData]);

  useEffect(() => {
    if (!data.profile?.email || !data.profile?.emailVerified) return;
    const currentMonthKey = getCurrentMonthKey();
    if (data.settings?.lastCcReminderMonth === currentMonthKey) return;

    const dueCardToday = finState.ccAlerts.find((cc) => cc.isDueToday);
    if (dueCardToday) {
      const reminderTimer = window.setTimeout(() => {
        updateLocalData((prev) => ({
          ...prev,
          settings: { ...prev.settings, lastCcReminderMonth: currentMonthKey },
        }));
        dispatchAlert(
          `Monthly Credit Card Due Date Reminder: Today (Day ${dueCardToday.recurringDay}) is the scheduled payment due date for ${dueCardToday.name}. Current outstanding due: ${formatINR(dueCardToday.used, false, true)}.`,
          "MONTHLY CREDIT CARD REMINDER",
        );
      }, 0);
      return () => window.clearTimeout(reminderTimer);
    }
  }, [
    finState.ccAlerts,
    data.profile?.email,
    data.profile?.emailVerified,
    data.settings?.lastCcReminderMonth,
    dispatchAlert,
    updateLocalData,
  ]);

  // Automatic Execution of Fixed Autopay Rules (SIP / EMI / Insurance / Subscription) When Due Date Arrives
  useEffect(() => {
    if (
      !initialCloudLoadRef.current ||
      !dataReady ||
      syncStatus === "syncing" ||
      syncStatus === "error"
    ) return;
    const todayISO = getTodayISO();
    const dueRules = (data.autopayRules || []).filter(
      (r) => Number(r.amount) > 0 && r.deductDate && r.deductDate <= todayISO,
    );

    if (dueRules.length === 0) return;

    dueRules.forEach((rule) => {
      const isSip = rule.category === "SIP";
      const nextDateISO = getNextRecurrenceDateISO(
        rule.deductDate,
        rule.frequency,
      );
      const fallbackAccountId = data.accounts.find(
        (account) => account.type !== "credit",
      )?.id;
      const validAccId = data.accounts.some(
        (account) => account.id === rule.accountId && account.type !== "credit",
      )
        ? rule.accountId
        : fallbackAccountId;
      if (!validAccId) return;

      const autoTx = {
        id:
          "tx_auto_" +
          Date.now() +
          "_" +
          Math.random().toString(36).slice(2, 6),
        type: isSip ? "investment_contrib" : "expense",
        amount: Number(rule.amount),
        date: rule.deductDate,
        time: "09:00 am",
        accountId: validAccId,
        categoryId: isSip ? "investment" : "cat_bills",
        subcategory: rule.category,
        paymentMethod: "Auto-Debit",
        description: `Auto-Debit: ${rule.title}`,
        createdAt: Date.now(),
      };

      updateLocalData((prev) => ({
        ...prev,
        transactions: [autoTx, ...prev.transactions],
        autopayRules: prev.autopayRules.map((r) =>
          r.id === rule.id ? { ...r, deductDate: nextDateISO } : r,
        ),
        investments: prev.investments.map((inv) =>
          inv.id === rule.linkedInvestmentId
            ? {
                ...inv,
                investedAmount:
                  Number(inv.investedAmount || 0) + Number(rule.amount),
                currentValue:
                  Number(inv.currentValue ?? inv.investedAmount ?? 0) + Number(rule.amount),
              }
            : inv,
        ),
      }));

      dispatchAlert(
        `Auto-Deduction Completed: ${formatINR(rule.amount)} deducted for ${rule.title} (${rule.frequency}). Next deduction scheduled for ${formatDateDisplay(nextDateISO)}.`,
        "AUTOMATIC STANDING INSTRUCTION",
      );
    });
  }, [data.autopayRules, data.accounts, dataReady, syncStatus, dispatchAlert, updateLocalData]);

  const handleSaveTransaction = (txObj) => {
    const timestamp = Date.now();
    const transaction = {
      ...txObj,
      id: txObj.id || `tx_${timestamp}`,
      createdAt: txObj.createdAt || timestamp,
    };
    updateLocalData((prev) => {
      const previousTransaction = prev.transactions.find((t) => t.id === transaction.id);
      const updated = previousTransaction
        ? prev.transactions.map((t) => (t.id === transaction.id ? transaction : t))
        : [transaction, ...prev.transactions];
      const reserveDelta =
        (transaction.isEmergencyReserveContribution ? Number(transaction.amount) || 0 : 0) -
        (previousTransaction?.isEmergencyReserveContribution
          ? Number(previousTransaction.amount) || 0
          : 0);
      return {
        ...prev,
        transactions: updated,
        ...(reserveDelta
          ? {
              emergencyReserve: {
                ...prev.emergencyReserve,
                amount: Math.max(
                  0,
                  Number((Number(prev.emergencyReserve?.amount || 0) + reserveDelta).toFixed(2)),
                ),
              },
            }
          : {}),
      };
    });
    showConfirmation(
      txObj.id
        ? "Transaction updated."
        : transaction.type === "transfer"
          ? "Transfer saved."
          : "Transaction saved.",
    );

    const targetAcc = finState.computedAccounts.find(
      (a) => a.id === transaction.accountId,
    );
    if (targetAcc?.type === "credit" && transaction.type === "expense") {
      const newUsed = targetAcc.currentBalance + transaction.amount;
      const threshold =
        ((Number(targetAcc.creditLimit) || 0) *
          (Number(targetAcc.alertThresholdPct) || 0)) /
        100;
      if (threshold > 0 && newUsed >= threshold) {
        dispatchAlert(
          `${targetAcc.name} outstanding balance has reached ${formatINR(newUsed)}, crossing your ${targetAcc.alertThresholdPct}% utilization threshold of ${formatINR(threshold)}.`,
          "CREDIT UTILIZATION GUARD",
        );
      }
    }

    const spendLimit = Number(data.settings?.monthlySpendLimit) || 0;
    if (
      spendLimit > 0 &&
      transaction.type === "expense" &&
      transaction.date?.startsWith(selectedMonth)
    ) {
      const newMonthlyExpense =
        finState.monthlyExpense + Number(transaction.amount || 0);
      if (newMonthlyExpense > spendLimit) {
        dispatchAlert(
          `Over-Budget Alert: Your monthly expenses (${formatINR(newMonthlyExpense)}) have crossed your configured monthly limit of ${formatINR(spendLimit)}.`,
          "BUDGET LIMIT EXCEEDED",
        );
      }
    }

    setEditingTx(null);
  };

  const handleDeleteTransaction = (id) => {
    const target = data.transactions.find((t) => t.id === id);
    if (!target) return;
    setLastDeletedTx(target);
    updateLocalData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
      ...(target.isEmergencyReserveContribution
        ? {
            emergencyReserve: {
              ...prev.emergencyReserve,
              amount: Math.max(
                0,
                Number((Number(prev.emergencyReserve?.amount || 0) - Number(target.amount || 0)).toFixed(2)),
              ),
            },
          }
        : {}),
    }));

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setLastDeletedTx(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!lastDeletedTx) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    updateLocalData((prev) => ({
      ...prev,
      transactions: [lastDeletedTx, ...prev.transactions],
      ...(lastDeletedTx.isEmergencyReserveContribution
        ? {
            emergencyReserve: {
              ...prev.emergencyReserve,
              amount: Number(
                (Number(prev.emergencyReserve?.amount || 0) + Number(lastDeletedTx.amount || 0)).toFixed(2),
              ),
            },
          }
        : {}),
    }));
    setLastDeletedTx(null);
  };

  const handlePayCreditCard = (ccAccount) => {
    const dueAmount = Math.max(0, Number(ccAccount.used) || 0);
    if (dueAmount <= 0) return;
    const sourceAccount = finState.computedAccounts.find(
      (account) => account.id === ccAccount.paymentSourceAccountId && account.type === "bank",
    );
    if (!sourceAccount) {
      alert(`Choose a bank account for paying ${ccAccount.name}'s bill first.`);
      return;
    }
    if (sourceAccount.currentBalance < dueAmount) {
      alert(
        `Insufficient balance in ${sourceAccount.name}. Available: ${formatINR(sourceAccount.currentBalance)}; bill: ${formatINR(dueAmount)}.`,
      );
      return;
    }

    const paymentTx = {
      id: "tx_ccbill_" + Date.now(),
      type: "cc_bill_payment",
      amount: dueAmount,
      date: getTodayISO(),
      time: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      accountId: sourceAccount.id,
      toAccountId: ccAccount.id,
      categoryId: "cat_bills",
      subcategory: "Credit Card Bill",
      paymentMethod: "Net Banking",
      description: `Paid ${ccAccount.name} bill from ${sourceAccount.name}`,
      createdAt: Date.now(),
    };

    updateLocalData((prev) => ({
      ...prev,
      transactions: [paymentTx, ...prev.transactions],
    }));

    dispatchAlert(
      `Credit Card Bill Settled: ${formatINR(dueAmount, false, true)} has been deducted from ${sourceAccount.name}. ${ccAccount.name} due is now ₹0.`,
      "CREDIT CARD SETTLEMENT",
    );
  };

  const handleAlterBalance = (accId, newActualBalance, currentCalculated) => {
    const diff = Number((newActualBalance - currentCalculated).toFixed(2));
    if (diff === 0) return;
    updateLocalData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === accId
          ? {
              ...a,
              openingBalance: Number(
                ((Number(a.openingBalance) || 0) + diff).toFixed(2),
              ),
            }
          : a,
      ),
    }));
  };

  const handleAlterLiquidMf = (newActual, currentCalculated) => {
    const diff = Number((newActual - currentCalculated).toFixed(2));
    if (diff === 0) return;
    updateLocalData((prev) => ({
      ...prev,
      liquidMfOpeningBalance: Number(
        ((Number(prev.liquidMfOpeningBalance) || 0) + diff).toFixed(2),
      ),
    }));
  };

  const handleUpdateEmergencyReserve = (reserve) => {
    const amount = Number(reserve.amount);
    if (!reserve.name?.trim() || !Number.isFinite(amount) || amount < 0) {
      alert("Enter a reserve name and a valid non-negative amount.");
      return false;
    }

    const sourceBalance =
      reserve.sourceAccountId === "liquid_mf"
        ? finState.liquidMfGrossBalance
        : finState.computedAccounts.find(
            (account) =>
              account.id === reserve.sourceAccountId && account.type === "bank",
          )?.grossBalance;
    if (sourceBalance === undefined || amount > sourceBalance) {
      alert("The reserve cannot exceed the balance in its selected source.");
      return false;
    }

    updateLocalData((prev) => ({
      ...prev,
      emergencyReserve: {
        name: reserve.name.trim(),
        sourceAccountId: reserve.sourceAccountId,
        amount,
      },
    }));
    showConfirmation("Reserve settings saved.");
    return true;
  };

  const handleWithdrawEmergencyReserve = (amount, targetAccountId) => {
    const withdrawal = Number(amount);
    const targetAccount = finState.computedAccounts.find(
      (account) => account.id === targetAccountId && account.type === "bank",
    );
    if (
      !Number.isFinite(withdrawal) ||
      withdrawal <= 0 ||
      withdrawal > finState.emergencyReserveBalance ||
      !targetAccount
    ) {
      alert("Enter a valid withdrawal amount and destination bank account.");
      return false;
    }

    const sourceAccountId = data.emergencyReserve.sourceAccountId;
    const transaction =
      sourceAccountId === targetAccountId
        ? null
        : {
            id: `tx_reserve_${Date.now()}`,
            type: "transfer",
            amount: withdrawal,
            date: getTodayISO(),
            time: new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            accountId: sourceAccountId,
            toAccountId: targetAccountId,
            categoryId: "cat_other",
            subcategory: "Emergency Reserve Withdrawal",
            paymentMethod: "Net Banking",
            description: `Released ${data.emergencyReserve.name} to ${targetAccount.name}`,
            createdAt: Date.now(),
          };

    updateLocalData((prev) => ({
      ...prev,
      emergencyReserve: {
        ...prev.emergencyReserve,
        amount: Number(
          Math.max(0, Number(prev.emergencyReserve.amount) - withdrawal).toFixed(2),
        ),
      },
      transactions: transaction
        ? [transaction, ...prev.transactions]
        : prev.transactions,
    }));
    showConfirmation("Emergency reserve withdrawn.");
    return true;
  };

  const handleTogglePinHome = (accId) => {
    updateLocalData((prev) => {
      const target = prev.accounts.find((a) => a.id === accId);
      const currentlyPinned = prev.accounts.filter(
        (a) => a.pinnedOnHome,
      ).length;
      if (!target.pinnedOnHome && currentlyPinned >= 4) {
        alert("4 accounts are already pinned to Home. Unpin one first.");
        return prev;
      }
      return {
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === accId ? { ...a, pinnedOnHome: !a.pinnedOnHome } : a,
        ),
      };
    });
  };

  const handleExecuteAutopay = (rule) => {
    if (!rule.amount || rule.amount <= 0) {
      alert("Click the pencil icon to set an amount greater than ₹0 first.");
      return;
    }
    const isSip = rule.category === "SIP";
    const nextDateISO = getNextRecurrenceDateISO(
      rule.deductDate || getTodayISO(),
      rule.frequency,
    );

    const newTx = {
      id: "tx_auto_" + Date.now(),
      type: isSip ? "investment_contrib" : "expense",
      amount: rule.amount,
      date: getTodayISO(),
      time: "09:00 am",
      accountId: rule.accountId,
      categoryId: isSip ? "investment" : "cat_bills",
      subcategory: rule.category,
      paymentMethod: "Auto-Debit",
      description: rule.title,
      createdAt: Date.now(),
    };

    updateLocalData((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
      autopayRules: prev.autopayRules.map((r) =>
        r.id === rule.id ? { ...r, deductDate: nextDateISO } : r,
      ),
      investments: prev.investments.map((inv) =>
        inv.id === rule.linkedInvestmentId
          ? {
              ...inv,
              investedAmount: Number(inv.investedAmount || 0) + Number(rule.amount),
              currentValue: Number(inv.currentValue ?? inv.investedAmount ?? 0) + Number(rule.amount),
            }
          : inv,
      ),
    }));

    dispatchAlert(
      `Standing Instruction Executed: ${formatINR(rule.amount)} deducted for ${rule.title} (${rule.frequency}). Next scheduled deduction: ${formatDateDisplay(nextDateISO)}.`,
      "AUTOPAY EXECUTION",
    );
  };

  const totalActiveAlerts =
    finState.ccAlerts.filter((c) => c.isExceeded).length +
    (finState.isOverBudgetLimit ? 1 : 0) +
    (data.manualAlerts || []).length;

  const openQuickAdd = () => {
    openTransactionModal();
  };

  const addSubcategory = (categoryId, subcategory) =>
    updateLocalData((prev) => ({
      ...prev,
      categories: prev.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              subcategories: [...(category.subcategories || []), subcategory],
            }
          : category,
      ),
    }));

  const handleImportLegacyData = () => {
    setLegacyImportError("");
    const claimedBy = localStorage.getItem(LEGACY_OWNER_UID_KEY);
    if (claimedBy && claimedBy !== user.uid) {
      setLegacyImportStatus("claimed");
      return;
    }

    const legacyJson = localStorage.getItem(STORAGE_KEY);
    if (!legacyJson) {
      setLegacyImportStatus("hidden");
      return;
    }
    if (
      !window.confirm(
        "Import this device's old finance data into your signed-in account? This replaces that account's current data. Only continue if you own the old data, and export a backup first.",
      )
    ) {
      return;
    }

    try {
      const importedData = normalizeAppData(JSON.parse(legacyJson), user);
      localStorage.setItem(LEGACY_OWNER_UID_KEY, user.uid);
      updateLocalData(importedData);
      setLegacyImportStatus("hidden");
    } catch (error) {
      setLegacyImportError(
        `Legacy data could not be imported: ${error.message}`,
      );
    }
  };

  const handleStartFresh = () => {
    setLegacyImportError("");
    try {
      if (legacyImportStatus === "available") {
        localStorage.setItem(LEGACY_OWNER_UID_KEY, user.uid);
      }
    } catch (error) {
      setLegacyImportError(
        `This browser could not save the import choice: ${error.message}`,
      );
      return;
    }
    setLegacyImportStatus("hidden");
  };

  const handleManualSync = () => {
    void saveSnapshot(dataRef.current, true);
  };

  const handleSignOut = async () => {
    if (Number(dataRef.current.lastUpdated) > 0) {
      if (!initialCloudLoadRef.current) {
        if (
          !window.confirm(
            "Your cloud data has not finished loading. Sign out anyway? Any changes made now will remain only in this browser.",
          )
        ) {
          return;
        }
      } else if (
        !(await saveSnapshot(dataRef.current, true)) &&
        !window.confirm(
          "The latest changes could not be synced. They remain only in this browser.",
        )
      ) {
        return;
      }
    }
    try {
      await onSignOut();
    } catch (error) {
      setSyncError(error.message || "Unable to sign out.");
    }
  };

  if (!dataReady) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
        <p className="text-sm font-semibold hm-text-muted">
          Loading your private account data…
        </p>
      </div>
    );
  }

  if (legacyImportStatus === "checking") {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
        <p className="text-sm font-semibold hm-text-muted">
          Checking this device for old data…
        </p>
      </div>
    );
  }

  if (legacyImportStatus === "available" || legacyImportStatus === "claimed") {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
        <section className="hm-surface hm-border w-full max-w-lg space-y-4 rounded-2xl border p-6">
          <h1 className="text-lg font-extrabold">
            {legacyImportStatus === "available"
              ? "Old device data found"
              : "Start your private account"}
          </h1>
          <p className="text-sm hm-text-muted">
            {legacyImportStatus === "available"
              ? "Old data is not shared with your new account automatically. Import only if it belongs to you; otherwise continue without importing."
              : "Legacy device data was already assigned to another account in this browser. You can restore a personal backup after continuing."}
          </p>
          {legacyImportError && (
            <p className="text-sm font-semibold text-rose-500">
              {legacyImportError}
            </p>
          )}
          {legacyImportStatus === "available" && (
            <button
              type="button"
              onClick={handleImportLegacyData}
              className="hm-btn-primary w-full rounded-xl py-2.5 text-sm font-bold"
            >
              Import old data into this account
            </button>
          )}
          <button
            type="button"
            onClick={handleStartFresh}
            className="w-full rounded-xl border hm-border py-2.5 text-sm font-bold"
          >
            Continue without importing
          </button>
        </section>
      </div>
    );
  }

  if (startWithTransactionShortcut) {
    return (
      <div
        className={`min-h-screen ${theme === "dark" ? "theme-dark" : "theme-light"}`}
      >
        <div className="mx-auto max-w-lg px-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted">
                Hanakasu Mantri
              </span>
              <h1 className="text-base font-extrabold">Quick transaction</h1>
            </div>
            <button
              type="button"
              onClick={() => window.location.replace("/")}
              className="text-xs font-bold hm-text-muted cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-[11px] hm-text-muted">
            Quick entry is available while the rest of the app remains locked.
          </p>
        </div>
        {modalOpen ? (
          <TransactionModal
            key="quick-transaction"
            isOpen
            onClose={() => setModalOpen(false)}
            onSave={(transaction) => {
              handleSaveTransaction(transaction);
              setQuickEntrySaved(true);
            }}
            onAddSubcategory={addSubcategory}
            computedAccounts={finState.computedAccounts}
            emergencyReserve={data.emergencyReserve}
            emergencyReserveBalance={finState.emergencyReserveBalance}
            categories={data.categories}
            showAccountBalances={false}
          />
        ) : (
          <div className="mx-auto mt-8 max-w-lg px-4">
            <div className="hm-surface hm-border rounded-2xl border p-5 text-sm font-semibold">
              {quickEntrySaved ? "Transaction saved." : "Quick entry closed."}
              <button
                type="button"
                onClick={() => window.location.replace("/")}
                className="hm-btn-primary mt-4 block rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!unlocked && data.settings?.pinCode) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 ${theme === "dark" ? "theme-dark" : "theme-light"}`}
      >
        <div className="max-w-xs w-full hm-surface hm-border border rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl hm-btn-primary flex items-center justify-center mx-auto">
            <Lock size={20} />
          </div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider">
            Hanakasu Mantri Locked
          </h2>
          <input
            type="password"
            maxLength={4}
            autoFocus
            value={pinInput}
            onChange={(e) => {
              const val = e.target.value;
              setPinInput(val);
              if (val === data.settings.pinCode) setUnlocked(true);
            }}
            placeholder="••••"
            className="hm-input font-mono-num w-full text-center text-lg font-extrabold tracking-widest"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex transition-colors ${theme === "dark" ? "theme-dark" : "theme-light"}`}
    >
      {toastAlert && (
        <div className="fixed top-4 right-4 z-50 max-w-sm hm-surface hm-border border px-4 py-3 rounded-xl shadow-2xl flex items-start gap-2.5 text-xs font-bold">
          <BellRing size={15} className="shrink-0 mt-0.5" />
          <span>{toastAlert}</span>
        </div>
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        onOpenQuickAdd={openQuickAdd}
        alertCount={totalActiveAlerts}
      />

      <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-12">
        <Header
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          hideBalances={data.settings.hideBalances}
          onToggleHide={() =>
            updateLocalData((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                hideBalances: !prev.settings.hideBalances,
              },
            }))
          }
          theme={theme}
          onToggleTheme={() =>
            updateLocalData((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                theme: prev.settings.theme === "dark" ? "light" : "dark",
              },
            }))
          }
          profile={data.profile}
          alertCount={totalActiveAlerts}
          syncStatus={syncStatus}
          syncError={syncError}
          onManualCloudSync={handleManualSync}
          onSignOut={handleSignOut}
          onOpenQuickAdd={openQuickAdd}
          onNavigate={navigateToTab}
        />

        <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8">
          {syncStatus === "error" && (
            <div
              role="alert"
              className="mb-5 flex flex-col gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{syncError}</span>
              <button
                type="button"
                onClick={handleManualSync}
                className="hm-btn-primary w-fit rounded-lg px-3 py-2 text-xs font-bold cursor-pointer"
              >
                Retry sync
              </button>
            </div>
          )}
          {activeTab === "overview" && (
            <OverviewView
              finState={finState}
              data={data}
              hideBalances={data.settings.hideBalances}
              onToggleBankInTotal={(bankId) =>
                updateLocalData((prev) => ({
                  ...prev,
                  accounts: prev.accounts.map((a) =>
                    a.id === bankId
                      ? {
                          ...a,
                          includeInTotalBank: a.includeInTotalBank === false,
                        }
                      : a,
                  ),
                }))
              }
              onUpdateSpendLimit={(newLimit) =>
                updateLocalData((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, monthlySpendLimit: newLimit },
                }))
              }
              onToggleSavedInstrument={(instrumentId) =>
                updateLocalData((prev) => {
                  const excluded = new Set(
                    prev.settings.homeSavingsExcludedInstrumentIds || [],
                  );
                  if (excluded.has(instrumentId)) excluded.delete(instrumentId);
                  else excluded.add(instrumentId);
                  return {
                    ...prev,
                    settings: {
                      ...prev.settings,
                      homeSavingsExcludedInstrumentIds: [...excluded],
                    },
                  };
                })
              }
              onNavigate={navigateToTab}
            />
          )}

          {activeTab === "transactions" && (
            <TransactionsView
              data={data}
              hideBalances={data.settings.hideBalances}
              onOpenQuickAdd={() => {
                openQuickAdd();
              }}
              onEditTx={(tx) => openTransactionModal(tx)}
              onUpdateTxDirect={handleSaveTransaction}
              onDeleteTx={handleDeleteTransaction}
              onCreateManualAlert={(tx) => {
                updateLocalData((prev) => ({
                  ...prev,
                  manualAlerts: [
                    {
                      id: "malert_" + Date.now(),
                      title: `Reminder: ${tx.subcategory || tx.description || "Transaction"}`,
                      amount: tx.amount,
                      alertDate: tx.date,
                    },
                    ...(prev.manualAlerts || []),
                  ],
                }));
                dispatchAlert(
                  `Reminder scheduled for "${tx.subcategory || tx.description || "Transaction"}" (${formatINR(tx.amount)}).`,
                  "PAYMENT REMINDER",
                );
              }}
              lastDeletedTx={lastDeletedTx}
              onUndoDelete={handleUndoDelete}
            />
          )}

          {activeTab === "accounts" && (
            <AccountsView
              finState={finState}
              hideBalances={data.settings.hideBalances}
              onAlterBalance={handleAlterBalance}
              onPayCreditCard={handlePayCreditCard}
              onTogglePinHome={handleTogglePinHome}
              onUpdateAccountMeta={(id, chg) =>
                updateLocalData((prev) => ({
                  ...prev,
                  accounts: prev.accounts.map((a) =>
                    a.id === id ? { ...a, ...chg } : a,
                  ),
                }))
              }
              onAddAccount={(acc) =>
                updateLocalData((prev) => ({
                  ...prev,
                  accounts: [...prev.accounts, acc],
                }))
              }
              onDeleteAccount={(id) =>
                updateLocalData((prev) => ({
                  ...prev,
                  accounts: prev.accounts.filter((a) => a.id !== id),
                }))
              }
            />
          )}

          {activeTab === "categories" && (
            <CategoriesView
              data={data}
              selectedMonth={selectedMonth}
              hideBalances={data.settings.hideBalances}
            />
          )}

          {activeTab === "goals" && (
            <GoalsView
              data={data}
              finState={finState}
              hideBalances={data.settings.hideBalances}
              onAddGoal={(g) =>
                updateLocalData((prev) => ({
                  ...prev,
                  goals: [g, ...prev.goals],
                }))
              }
              onUpdateGoal={(id, chg) =>
                updateLocalData((prev) => ({
                  ...prev,
                  goals: prev.goals.map((g) =>
                    g.id === id ? { ...g, ...chg } : g,
                  ),
                }))
              }
              onContributeGoal={(id, amt, accountId) => {
                const targetGoal = data.goals.find((g) => g.id === id);
                const sourceAccount = finState.computedAccounts.find(
                  (account) => account.id === accountId && account.isLiquid,
                );
                if (!sourceAccount || amt > sourceAccount.currentBalance) {
                  alert("Choose an account with enough available balance.");
                  return;
                }
                const newTx = {
                  id: "tx_goal_" + Date.now(),
                  type: "goal_contrib",
                  amount: amt,
                  date: getTodayISO(),
                  time: new Date().toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }),
                  accountId: sourceAccount.id,
                  categoryId: "cat_other",
                  subcategory: "Goal Contribution",
                  description: `Goal: ${targetGoal?.name || "Reserve"}`,
                  createdAt: Date.now(),
                };
                updateLocalData((prev) => ({
                  ...prev,
                  transactions: [newTx, ...prev.transactions],
                  goals: prev.goals.map((g) =>
                    g.id === id
                      ? { ...g, savedAmount: g.savedAmount + amt }
                      : g,
                  ),
                }));
              }}
              onDeleteGoal={(id) =>
                updateLocalData((prev) => ({
                  ...prev,
                  goals: prev.goals.filter((g) => g.id !== id),
                }))
              }
            />
          )}

          {activeTab === "reports" && (
            <ReportsView
              finState={finState}
              data={data}
              hideBalances={data.settings.hideBalances}
              onAlterBalance={handleAlterBalance}
              onAlterLiquidMf={handleAlterLiquidMf}
              onUpdateEmergencyReserve={handleUpdateEmergencyReserve}
              onWithdrawEmergencyReserve={handleWithdrawEmergencyReserve}
              onAddInvestment={(inv) =>
                updateLocalData((prev) => ({
                  ...prev,
                  investments: [...prev.investments, inv],
                }))
              }
              onUpdateInvestment={(id, chg) =>
                updateLocalData((prev) => ({
                  ...prev,
                  investments: prev.investments.map((i) =>
                    i.id === id ? { ...i, ...chg } : i,
                  ),
                }))
              }
              onDeleteInvestment={(id) =>
                updateLocalData((prev) => ({
                  ...prev,
                  investments: prev.investments.filter((i) => i.id !== id),
                }))
              }
            />
          )}

          {activeTab === "autopay" && (
            <AutopayAlertsView
              data={data}
              finState={finState}
              hideBalances={data.settings.hideBalances}
              onAddAutopay={(r) =>
                updateLocalData((prev) => ({
                  ...prev,
                  autopayRules: [...(prev.autopayRules || []), r],
                }))
              }
              onUpdateAutopay={(id, chg) =>
                updateLocalData((prev) => ({
                  ...prev,
                  autopayRules: prev.autopayRules.map((r) =>
                    r.id === id ? { ...r, ...chg } : r,
                  ),
                }))
              }
              onDeleteAutopay={(id) =>
                updateLocalData((prev) => ({
                  ...prev,
                  autopayRules: prev.autopayRules.filter((r) => r.id !== id),
                }))
              }
              onExecuteAutopayNow={handleExecuteAutopay}
              onUpdateSpendLimit={(newLimit) =>
                updateLocalData((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, monthlySpendLimit: newLimit },
                }))
              }
              onAddManualAlert={(ma) =>
                updateLocalData((prev) => ({
                  ...prev,
                  manualAlerts: [ma, ...(prev.manualAlerts || [])],
                }))
              }
              onDeleteManualAlert={(id) =>
                updateLocalData((prev) => ({
                  ...prev,
                  manualAlerts: prev.manualAlerts.filter((m) => m.id !== id),
                }))
              }
              onDispatchAlert={dispatchAlert}
            />
          )}

          {activeTab === "profile" && (
            <ProfileModal
              data={data}
              theme={theme}
              onSaveProfileAndSettings={(newProfile, newSettings) =>
                updateLocalData((prev) => ({
                  ...prev,
                  profile: newProfile,
                  settings: newSettings,
                }))
              }
              onExportJSON={() => {
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `hanakasu-mantri-backup-${getTodayISO()}.json`;
                a.click();
              }}
              onImportJSON={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    updateLocalData({
                      ...INITIAL_APP_DATA,
                      ...JSON.parse(ev.target.result),
                    });
                  } catch {
                    alert("Invalid backup file");
                  }
                };
                reader.readAsText(file);
              }}
              onResetAll={() => updateLocalData(createDefaultUserData(user))}
            />
          )}
        </main>
      </div>

      <TransactionModal
        key={modalOpen ? editingTx?.id || "new-transaction" : "closed"}
        isOpen={modalOpen}
        onClose={closeTransactionModal}
        onSave={handleSaveTransaction}
        onAddSubcategory={addSubcategory}
        computedAccounts={finState.computedAccounts}
        emergencyReserve={data.emergencyReserve}
        emergencyReserveBalance={finState.emergencyReserveBalance}
        categories={data.categories}
        editingTx={editingTx}
      />
      {activeTab === "overview" && (
        <button
          type="button"
          onClick={openQuickAdd}
          aria-label="New transaction"
          title="New transaction"
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full hm-btn-primary shadow-xl transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current lg:bottom-8 lg:right-8"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
