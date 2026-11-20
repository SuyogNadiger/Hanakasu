import React, { useState } from "react";
import {
  BellRing,
  CalendarClock,
  Trash2,
  Mail,
  Pencil,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { AUTOPAY_FREQUENCIES } from "../data/defaults";
import {
  formatDateDisplay,
  formatINR,
  getTodayISO,
} from "../engine/financeEngine";
import CalendarDatePicker from "../components/CalendarDatePicker";

export default function AutopayAlertsView({
  data,
  finState,
  hideBalances,
  onAddAutopay,
  onUpdateAutopay,
  onDeleteAutopay,
  onExecuteAutopayNow,
  onUpdateSpendLimit,
  onAddManualAlert,
  onDeleteManualAlert,
  onDispatchAlert,
}) {
  // Point 1: Create New Fixed Auto-Deducting Rule State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("SIP");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [deductDate, setDeductDate] = useState(getTodayISO());
  const [accountId, setAccountId] = useState(
    data.accounts.find((account) => account.type !== "credit")?.id || "",
  );

  // Point 2: Full Edit State for Any Existing Rule via Pencil Icon
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleDraft, setRuleDraft] = useState({});

  // Point 5: Monthly Spend Limit (Budget Alert) Editor
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");

  // Manual Reminder Form
  const [mTitle, setMTitle] = useState("");
  const [mAmount, setMAmount] = useState("");
  const [mDate, setMDate] = useState(getTodayISO());

  const spendableBanks = (data.accounts || []).filter(
    (a) => a.type !== "credit",
  );

  return (
    <div className="space-y-10">
      <div className="border-b hm-border pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted">
            Standing Instructions, Budget Guard & Automated Email Advisory
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">
            Autopay Rules & Email Alerts
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl border hm-surface hm-border font-semibold">
            ✉️{" "}
            {data.profile?.email
              ? `${data.profile.email} ${data.profile.emailVerified ? "✓" : ""}`
              : "Add Email in Profile"}
          </span>
        </div>
      </div>

      {/* POINT 5: MONTHLY SPENDING LIMIT (BUDGET ALERT GUARD) */}
      <section className="p-5 rounded-2xl border hm-surface hm-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={15}
              className={
                finState.isOverBudgetLimit ? "text-rose-500" : "hm-text-muted"
              }
            />
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              Monthly Spending Limit (Over-Budget Alert)
            </h2>
          </div>
          <p className="hm-text-muted">
            Current Month Expenses:{" "}
            <strong className="font-mono-num">
              {formatINR(finState.monthlyExpense, hideBalances)}
            </strong>
            . If your monthly spending crosses this limit, Hanakasu Mantri
            automatically emails you an alert.
          </p>
        </div>

        {editingLimit ? (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              autoFocus
              placeholder="Monthly Limit ₹"
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
              className="hm-input font-mono-num w-36 rounded-xl px-3 py-2 font-extrabold outline-none"
            />
            <button
              type="button"
              onClick={() => {
                onUpdateSpendLimit(parseFloat(limitDraft) || 0);
                setEditingLimit(false);
              }}
              className="p-2 rounded-xl hm-btn-primary cursor-pointer"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setEditingLimit(false)}
              className="p-2 rounded-xl border hm-border cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-mono-num text-xl font-extrabold">
              {finState.monthlySpendLimit > 0
                ? formatINR(finState.monthlySpendLimit, hideBalances)
                : "No Limit Set"}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingLimit(true);
                setLimitDraft(String(finState.monthlySpendLimit || ""));
              }}
              title="Edit Monthly Spending Limit"
              className="p-2 rounded-xl border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}
      </section>

      {/* 1. STANDING AUTO-DEDUCTION INSTRUCTIONS (Point 1 & Point 2) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={17} />
          <h2 className="text-sm font-extrabold uppercase tracking-wider">
            Fixed Auto-Deducting Rules (SIPs, EMIs, Insurance & Subscriptions)
          </h2>
        </div>

        {/* Point 1: Creation Form with Monthly/Quarterly/Half Yearly/Yearly + Particular Deduction Date */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !amount || !deductDate) return;
            const dayNum = Number(deductDate.split("-")[2]) || 1;
            onAddAutopay({
              id: "auto_" + Date.now(),
              title: title.trim(),
              category,
              amount: Number(amount),
              frequency,
              deductDate,
              deductDay: dayNum,
              accountId,
            });
            setTitle("");
            setAmount("");
          }}
          className="p-4 rounded-2xl border hm-surface hm-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs overflow-hidden"
        >
          <input
            type="text"
            required
            placeholder="Instruction Name (e.g. LIC, SIP)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="hm-input rounded-xl px-3 py-2.5 outline-none"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="hm-input rounded-xl px-2.5 py-2.5 outline-none"
          >
            <option value="SIP">SIP</option>
            <option value="EMI">EMI</option>
            <option value="Insurance">Insurance</option>
            <option value="Subscription">Subscription</option>
            <option value="Bill">Fixed Bill</option>
          </select>

          <input
            type="number"
            required
            placeholder="₹ Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="hm-input font-mono-num rounded-xl px-3 py-2.5 outline-none"
          />

          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="hm-input rounded-xl px-2.5 py-2.5 outline-none"
          >
            {AUTOPAY_FREQUENCIES.map((freq) => (
              <option key={freq} value={freq}>
                {freq}
              </option>
            ))}
          </select>

          <CalendarDatePicker
            required
            value={deductDate}
            onChange={setDeductDate}
            ariaLabel="Autopay deduction date"
            className="min-w-0"
          />

          <div className="flex gap-2">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="hm-input flex-1 rounded-xl px-2.5 py-2.5 outline-none"
            >
              {spendableBanks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer shrink-0"
            >
              + Add
            </button>
          </div>
        </form>

        {/* Point 2: Created Rules List with Full Pencil Edit for ALL Data */}
        <div className="divide-y hm-border border-y text-xs overflow-x-auto">
          {(data.autopayRules || []).map((rule) => {
            const isEditing = editingRuleId === rule.id;
            const bankName =
              data.accounts.find((a) => a.id === rule.accountId)?.name || "Account removed";

            return (
              <div key={rule.id} className="py-4">
                {isEditing ? (
                  <div className="p-4 rounded-2xl border hm-surface hm-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
                    <div>
                      <label className="text-[10px] hm-text-muted block mb-1">
                        Rule Title
                      </label>
                      <input
                        type="text"
                        value={ruleDraft.title || ""}
                        onChange={(e) =>
                          setRuleDraft({ ...ruleDraft, title: e.target.value })
                        }
                        className="hm-input w-full rounded-xl px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] hm-text-muted block mb-1">
                        Category
                      </label>
                      <select
                        value={ruleDraft.category || "SIP"}
                        onChange={(e) =>
                          setRuleDraft({
                            ...ruleDraft,
                            category: e.target.value,
                          })
                        }
                        className="hm-input w-full rounded-xl px-2.5 py-2"
                      >
                        <option value="SIP">SIP</option>
                        <option value="EMI">EMI</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Subscription">Subscription</option>
                        <option value="Bill">Fixed Bill</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] hm-text-muted block mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={ruleDraft.amount ?? 0}
                        onChange={(e) =>
                          setRuleDraft({
                            ...ruleDraft,
                            amount: Number(e.target.value),
                          })
                        }
                        className="hm-input font-mono-num w-full rounded-xl px-3 py-2 font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] hm-text-muted block mb-1">
                        Frequency
                      </label>
                      <select
                        value={ruleDraft.frequency || "Monthly"}
                        onChange={(e) =>
                          setRuleDraft({
                            ...ruleDraft,
                            frequency: e.target.value,
                          })
                        }
                        className="hm-input w-full rounded-xl px-2.5 py-2"
                      >
                        {AUTOPAY_FREQUENCIES.map((freq) => (
                          <option key={freq} value={freq}>
                            {freq}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] hm-text-muted block mb-1">
                        Deduction Date
                      </label>
                      <CalendarDatePicker
                        value={ruleDraft.deductDate || getTodayISO()}
                        onChange={(dVal) => {
                          if (!dVal) return;
                          const dNum = Number(dVal.split("-")[2]) || 1;
                          setRuleDraft({
                            ...ruleDraft,
                            deductDate: dVal,
                            deductDay: dNum,
                          });
                        }}
                        ariaLabel="Autopay deduction date"
                        className="w-full"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <label className="text-[10px] hm-text-muted block mb-1">
                          Bank
                        </label>
                        <select
                          value={
                            ruleDraft.accountId ||
                            spendableBanks[0]?.id ||
                            ""
                          }
                          onChange={(e) =>
                            setRuleDraft({
                              ...ruleDraft,
                              accountId: e.target.value,
                            })
                          }
                          className="hm-input w-full rounded-xl px-2 py-2"
                        >
                          {spendableBanks.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateAutopay(rule.id, ruleDraft);
                          setEditingRuleId(null);
                        }}
                        title="Save Rule Changes"
                        className="p-2.5 rounded-xl hm-btn-primary mt-4 cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRuleId(null)}
                        title="Cancel"
                        className="p-2.5 rounded-xl border hm-border mt-4 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <span className="px-2 py-0.5 rounded border hm-elevated hm-border text-[10px] font-bold mr-2 inline-block whitespace-nowrap">
                        {rule.category} • {rule.frequency}
                      </span>
                      <strong className="text-sm font-extrabold">
                        {rule.title}
                      </strong>
                      <span className="hm-text-muted ml-2 block sm:inline">
                        (Deduction Date:{" "}
                        <strong>
                          {rule.deductDate
                            ? formatDateDisplay(rule.deductDate)
                            : `Day ${rule.deductDay}`}
                        </strong>{" "}
                        • {bankName})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <span className="font-mono-num font-extrabold text-sm">
                        {formatINR(rule.amount, hideBalances)}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingRuleId(rule.id);
                          setRuleDraft({
                            ...rule,
                            deductDate: rule.deductDate || getTodayISO(),
                          });
                        }}
                        title="Edit All Rule Details"
                        className="p-1.5 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onExecuteAutopayNow(rule)}
                        className="px-3 py-1.5 rounded-lg hm-btn-primary font-bold cursor-pointer"
                      >
                        Deduct & Email
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteAutopay(rule.id)}
                        className="p-1.5 hm-text-muted hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. MANUAL TRANSACTION REMINDERS & EMAIL LOG */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 space-y-4 text-xs">
          <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
            <BellRing size={15} /> Manual Transaction Reminders
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!mTitle.trim()) return;
              onAddManualAlert({
                id: "malert_" + Date.now(),
                title: mTitle.trim(),
                amount: Number(mAmount) || 0,
                alertDate: mDate,
              });
              setMTitle("");
              setMAmount("");
            }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
          >
            <input
              type="text"
              required
              placeholder="Reminder note..."
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
              className="hm-input sm:col-span-3 rounded-xl px-3.5 py-2.5 outline-none"
            />
            <input
              type="number"
              placeholder="₹ Amount"
              value={mAmount}
              onChange={(e) => setMAmount(e.target.value)}
              className="hm-input font-mono-num rounded-xl px-3.5 py-2 outline-none"
            />
            <CalendarDatePicker
              value={mDate}
              onChange={setMDate}
              ariaLabel="Reminder date"
              className="w-full"
            />
            <button
              type="submit"
              className="rounded-xl hm-btn-primary font-extrabold uppercase py-2 cursor-pointer"
            >
              + Set Alert
            </button>
          </form>

          <div className="divide-y hm-border border-t">
            {(data.manualAlerts || []).map((ma) => (
              <div
                key={ma.id}
                className="py-3 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold">{ma.title}</p>
                  <p className="text-[11px] hm-text-muted">
                    Date: {formatDateDisplay(ma.alertDate)}{" "}
                    {ma.amount > 0 ? `• ${formatINR(ma.amount)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      onDispatchAlert(
                        `Reminder: ${ma.title} (${formatINR(ma.amount)}) scheduled for ${formatDateDisplay(ma.alertDate)}.`,
                        "PAYMENT REMINDER",
                      )
                    }
                    className="px-3 py-1.5 rounded-lg border hm-elevated hm-border font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail size={12} /> Email Reminder
                  </button>
                  <button
                    onClick={() => onDeleteManualAlert(ma.id)}
                    className="p-1 hm-text-muted hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
              <Mail size={15} /> Email Request Log
            </h2>
            <button
              onClick={() =>
                onDispatchAlert(
                  `Executive Portfolio Summary: Selected Banks ${formatINR(finState.selectedBankBalance)}, Net Worth ${formatINR(finState.netWorth)}.`,
                  "PORTFOLIO STATEMENT",
                )
              }
              className="px-3.5 py-1.5 rounded-lg border hm-elevated hm-border font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Mail size={12} /> Email Portfolio Summary
            </button>
          </div>

          <div className="divide-y hm-border border-y max-h-64 overflow-y-auto">
            {(data.alertLogs || []).length === 0 ? (
              <p className="py-8 text-center hm-text-muted">
                No email requests recorded yet.
              </p>
            ) : (
              data.alertLogs.map((log) => (
                <div key={log.id} className="py-2.5 space-y-0.5">
                  <div className="flex justify-between text-[10px] font-bold hm-text-muted">
                    <span>
                      {log.channel?.startsWith("Email Dispatch →")
                        ? log.channel.replace(
                            "Email Dispatch →",
                            "Prior request (delivery unconfirmed) →",
                          )
                        : log.channel}
                    </span>
                    <span>{log.time}</span>
                  </div>
                  <p className="font-semibold">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
