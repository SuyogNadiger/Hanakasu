import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { INITIAL_APP_DATA, DEFAULT_ACCOUNTS } from "./data/defaults";
import {
  computeFinancialState,
  getCurrentMonthKey,
  getTodayISO,
  getNextRecurrenceDateISO,
  formatDateDisplay,
  formatINR,
  triggerWorkableAlert,
  pullCloudDatabase,
  pushCloudDatabase,
} from "./engine/financeEngine";
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
import { Lock, BellRing } from "lucide-react";

const STORAGE_KEY = "hanakasu_manntri_v4";

function normalizeAppData(parsed) {
  const syncedAccounts = (parsed?.accounts || DEFAULT_ACCOUNTS)
    .filter((a) => a.type !== "liquid_mf")
    .map((acc) => {
      if (acc.id === "acc_sbi")
        return { ...acc, nickname: "Savings Account", brand: "sbi" };
      if (acc.id === "acc_hdfc")
        return { ...acc, nickname: "Salary Account", brand: "hdfc" };
      if (acc.id === "acc_idfc")
        return { ...acc, nickname: "Side Gig Account", brand: "idfc" };
      if (acc.id === "acc_union")
        return { ...acc, nickname: "Primary UPI", brand: "union" };
      if (acc.id === "acc_cc_hdfc") return { ...acc, brand: "hdfc_cc" };
      return acc;
    });

  return {
    ...INITIAL_APP_DATA,
    ...parsed,
    accounts: syncedAccounts,
    profile: { ...INITIAL_APP_DATA.profile, ...(parsed?.profile || {}) },
    settings: { ...INITIAL_APP_DATA.settings, ...(parsed?.settings || {}) },
    lastUpdated: Number(parsed?.lastUpdated) || 0,
  };
}

export default function App() {
  const [startWithTransactionShortcut] = useState(
    () => new URLSearchParams(window.location.search).get("action") === "new-transaction",
  );
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return normalizeAppData(JSON.parse(saved));
      } catch {
        return { ...INITIAL_APP_DATA, lastUpdated: 0 };
      }
    }
    return { ...INITIAL_APP_DATA, lastUpdated: 0 };
  });

  const [syncStatus, setSyncStatus] = useState("idle"); // 'idle' | 'syncing' | 'synced'
  const initialPullDoneRef = useRef(false);
  const skipNextPushRef = useRef(false);

  // Wrapper around setData that stamps `lastUpdated: Date.now()` on every local user edit
  const updateLocalData = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const stamped = { ...next, lastUpdated: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
      return stamped;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    document.title = "Hanakasu Mantri";
  }, [data]);

  const [activeTab, setActiveTab] = useState(() =>
    startWithTransactionShortcut ? "transactions" : "overview",
  );
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [modalOpen, setModalOpen] = useState(() => startWithTransactionShortcut);
  const [editingTx, setEditingTx] = useState(null);
  const [lastDeletedTx, setLastDeletedTx] = useState(null);
  const [toastAlert, setToastAlert] = useState(null);
  const undoTimerRef = useRef(null);

  const [unlocked, setUnlocked] = useState(() => !data.settings?.pinCode);
  const [pinInput, setPinInput] = useState("");

  const theme = data.settings?.theme || "dark";

  const finState = useMemo(
    () => computeFinancialState(data, selectedMonth),
    [data, selectedMonth],
  );

  useEffect(() => {
    if (!startWithTransactionShortcut) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [startWithTransactionShortcut]);

  // 1. PULL FROM CLOUD ON INITIAL LOAD & WHEN SWITCHING DEVICES / REFOCUSING TAB
  const syncFromCloudNow = useCallback(async () => {
    setSyncStatus("syncing");
    const cloudData = await pullCloudDatabase();

    if (cloudData) {
      const normalizedCloud = normalizeAppData(cloudData);
      setData((currentLocal) => {
        const localTime = Number(currentLocal.lastUpdated) || 0;
        const cloudTime = Number(normalizedCloud.lastUpdated) || 0;

        // If Cloud has newer data (or this is a fresh device at 0), adopt Cloud data!
        if (cloudTime > localTime) {
          skipNextPushRef.current = true;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedCloud));
          return normalizedCloud;
        }
        return currentLocal;
      });
    }

    initialPullDoneRef.current = true;
    setSyncStatus("synced");
  }, []);

  useEffect(() => {
    const initialSyncTimer = window.setTimeout(() => {
      void syncFromCloudNow();
    }, 0);
    const handleFocus = () => syncFromCloudNow();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(initialSyncTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncFromCloudNow]);

  // 2. AUTO-PUSH TO CLOUD WHENEVER USER MODIFIES DATA
  useEffect(() => {
    if (!initialPullDoneRef.current) return;
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    if (!data.lastUpdated) return;

    const timer = setTimeout(async () => {
      setSyncStatus("syncing");
      await pushCloudDatabase(data, finState.ccAlerts);
      setSyncStatus("synced");
    }, 900);

    return () => clearTimeout(timer);
  }, [data, finState.ccAlerts]);

  const dispatchAlert = useCallback((message, badge = "PRIVATE LEDGER DISPATCH") => {
    const contact = data.profile?.email || "Local Alert Console";
    const newLog = {
      id: "log_" + Date.now(),
      channel: `Email Dispatch → ${contact}`,
      message,
      time: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    updateLocalData((prev) => ({
      ...prev,
      alertLogs: [newLog, ...(prev.alertLogs || [])],
    }));
    setToastAlert(message);
    setTimeout(() => setToastAlert(null), 4500);

    triggerWorkableAlert({
      subject: `Hanakasu Mantri — ${badge}`,
      message,
      profile: data.profile,
      theme,
      badge,
    });
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
    if (!initialPullDoneRef.current) return;
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
      const validAccId = data.accounts.some((a) => a.id === rule.accountId)
        ? rule.accountId
        : "acc_sbi";

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
  }, [data.autopayRules, data.accounts, dispatchAlert, updateLocalData]);

  const handleSaveTransaction = (txObj) => {
    const timestamp = Date.now();
    const transaction = {
      ...txObj,
      id: txObj.id || `tx_${timestamp}`,
      createdAt: txObj.createdAt || timestamp,
    };
    updateLocalData((prev) => {
      const exists = prev.transactions.some((t) => t.id === transaction.id);
      const updated = exists
        ? prev.transactions.map((t) => (t.id === transaction.id ? transaction : t))
        : [transaction, ...prev.transactions];
      return { ...prev, transactions: updated };
    });

    const targetAcc = finState.computedAccounts.find(
      (a) => a.id === transaction.accountId,
    );
    if (targetAcc?.type === "credit" && transaction.type === "expense") {
      const newUsed = targetAcc.currentBalance + transaction.amount;
      const threshold =
        ((targetAcc.creditLimit || 50000) *
          (targetAcc.alertThresholdPct || 10)) /
        100;
      if (newUsed >= threshold) {
        dispatchAlert(
          `${targetAcc.name} outstanding balance has reached ${formatINR(newUsed)}, crossing your 10% utilization threshold of ${formatINR(threshold)}.`,
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
    }));
    setLastDeletedTx(null);
  };

  const handlePayCreditCardFromHdfc = (ccAccount) => {
    const dueAmount = Math.max(0, Number(ccAccount.used) || 0);
    if (dueAmount <= 0) return;
    if (finState.hdfcBankBalance < dueAmount) return;

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
      accountId: "acc_hdfc",
      toAccountId: ccAccount.id,
      categoryId: "cat_bills",
      subcategory: "Credit Card Bill",
      paymentMethod: "Net Banking",
      description: `Paid ${ccAccount.name} Bill from HDFC Bank`,
      createdAt: Date.now(),
    };

    updateLocalData((prev) => ({
      ...prev,
      transactions: [paymentTx, ...prev.transactions],
    }));

    dispatchAlert(
      `Credit Card Bill Settled: ${formatINR(dueAmount, false, true)} has been deducted from your HDFC Bank Salary Account. ${ccAccount.name} due is now ₹0.`,
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
      accountId: rule.accountId || "acc_sbi",
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
        setActiveTab={setActiveTab}
        onOpenQuickAdd={() => {
          setEditingTx(null);
          setModalOpen(true);
        }}
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
          onManualCloudSync={syncFromCloudNow}
          onOpenQuickAdd={() => {
            setEditingTx(null);
            setModalOpen(true);
          }}
          onNavigate={setActiveTab}
        />

        <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8">
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
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === "transactions" && (
            <TransactionsView
              data={data}
              hideBalances={data.settings.hideBalances}
              onOpenQuickAdd={() => {
                setEditingTx(null);
                setModalOpen(true);
              }}
              onEditTx={(tx) => {
                setEditingTx(tx);
                setModalOpen(true);
              }}
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
              onPayCreditCardFromHdfc={handlePayCreditCardFromHdfc}
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
              onContributeGoalFromSbi={(id, amt) => {
                const targetGoal = data.goals.find((g) => g.id === id);
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
                  accountId: "acc_sbi",
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
              onResetAll={() => updateLocalData(INITIAL_APP_DATA)}
            />
          )}
        </main>
      </div>

      <TransactionModal
        key={modalOpen ? editingTx?.id || "new-transaction" : "closed"}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
        onSave={handleSaveTransaction}
        onAddSubcategory={(catId, newSub) =>
          updateLocalData((prev) => ({
            ...prev,
            categories: prev.categories.map((c) =>
              c.id === catId
                ? { ...c, subcategories: [...(c.subcategories || []), newSub] }
                : c,
            ),
          }))
        }
        computedAccounts={finState.computedAccounts}
        liquidMfBalance={finState.liquidMfBalance}
        categories={data.categories}
        editingTx={editingTx}
      />
    </div>
  );
}
