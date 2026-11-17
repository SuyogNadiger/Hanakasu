import React, { useState } from 'react';
import {
  SlidersHorizontal, Check, ArrowUpRight, Star,
  Eye, EyeOff, Lock, X, Pencil, AlertTriangle
} from 'lucide-react';
import { formatDateDisplay, formatINR } from '../engine/financeEngine';
import { BrandLogo } from '../components/Sidebar';

export default function OverviewView({
  finState,
  data,
  hideBalances,
  onToggleBankInTotal,
  onToggleSavedInstrument,
  onUpdateSpendLimit,
  onNavigate
}) {
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showSavedInstrumentPicker, setShowSavedInstrumentPicker] = useState(false);

  // Point 6: Total Saved is hidden by default; if no PIN is set, clicking Eye reveals it directly!
  const [isSavedUnlocked, setIsSavedUnlocked] = useState(false);
  const [showSavedPinModal, setShowSavedPinModal] = useState(false);
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinError, setPinError] = useState('');

  // Point 5: Inline Monthly Spend Limit (Budget) Editor
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState('');

  const {
    bankAccounts,
    selectedBankBalance,
    pinnedAccounts,
    monthlyIncome,
    monthlyExpense,
    monthlySpendLimit,
    isOverBudgetLimit,
    cashFlowSeries
  } = finState;

  const configuredPin = data?.settings?.pinCode || '';
  const savedInstrumentOptions = [
    ...(finState.computedAccounts || [])
      .filter(account => account.type !== 'credit')
      .map(account => ({
        id: `account:${account.id}`,
        name: account.name,
        balance: account.currentBalance,
        group: account.type === 'cash' ? 'Cash' : 'Bank',
      })),
    {
      id: 'liquid-fund',
      name: 'Liquid fund (available)',
      balance: finState.liquidMfBalance,
      group: 'Wealth',
    },
    {
      id: 'emergency-reserve',
      name: `${data.emergencyReserve?.name || 'Emergency Reserve'} (locked)`,
      balance: finState.emergencyReserveBalance,
      group: 'Wealth',
    },
    ...(data.investments || []).map(investment => ({
      id: `investment:${investment.id}`,
      name: investment.name || 'Investment',
      balance: Number(investment.currentValue ?? investment.investedAmount) || 0,
      group: 'Wealth',
    })),
    ...(data.goals || []).map(goal => ({
      id: `goal:${goal.id}`,
      name: goal.name || 'Savings goal',
      balance: Number(goal.savedAmount) || 0,
      group: 'Wealth',
    })),
  ];
  const excludedSavedInstruments = new Set(
    data.settings?.homeSavingsExcludedInstrumentIds || [],
  );
  const selectedSavedInstruments = savedInstrumentOptions.filter(
    instrument => !excludedSavedInstruments.has(instrument.id),
  );
  const totalSaved = selectedSavedInstruments.reduce(
    (sum, instrument) => sum + (Number(instrument.balance) || 0),
    0,
  );

  const handleToggleSavedVisibility = () => {
    if (isSavedUnlocked) {
      setIsSavedUnlocked(false);
      return;
    }
    // Point 6: If PIN is not set at all, show Total Saved directly without forcing PIN setup
    if (!configuredPin) {
      setIsSavedUnlocked(true);
      return;
    }
    setPinAttempt('');
    setPinError('');
    setShowSavedPinModal(true);
  };

  const handleVerifySavedPin = (e) => {
    e.preventDefault();
    if (pinAttempt === configuredPin) {
      setIsSavedUnlocked(true);
      setShowSavedPinModal(false);
      setPinAttempt('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Try again.');
    }
  };

  const maxBarValue = Math.max(
    5000,
    ...cashFlowSeries.map(d => Math.max(d.income, d.expense))
  );

  const recentFive = (data.transactions || [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 5);

  const getAccount = (id) =>
    finState.computedAccounts.find(a => a.id === id) || { name: 'Liquid MF', brand: 'liquid' };
  const getCategory = (id) => data.categories.find(c => c.id === id);

  return (
    <div className="space-y-10">
      {/* 1. ARCHITECTURAL HERO LEDGER */}
      <section className="relative border-b hm-border pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-5 space-y-2 relative">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-widest hm-text-muted">
                Selected Bank Balance
              </span>
              <button
                onClick={() => setShowBankPicker(!showBankPicker)}
                className="px-2.5 py-0.5 rounded-full border hm-elevated hm-border text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal size={10} />
                {bankAccounts.filter(b => b.includeInTotalBank !== false).length}/{bankAccounts.length} Banks
              </button>
            </div>

            <div
              onClick={() => setShowBankPicker(!showBankPicker)}
              className="font-mono-num text-4xl sm:text-5xl font-extrabold tracking-tight cursor-pointer"
            >
              {formatINR(selectedBankBalance, hideBalances, true)}
            </div>

            <p className="text-xs hm-text-muted">
              {bankAccounts
                .filter(b => b.includeInTotalBank !== false)
                .map(b => b.name)
                .join('  •  ') || 'Tap to select banks'}
            </p>

            {showBankPicker && (
              <div className="absolute top-full left-0 mt-2 w-72 z-30 rounded-2xl border hm-surface hm-border p-4 shadow-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b hm-border">
                  <span className="font-extrabold uppercase tracking-wider text-[10px]">
                    Select Banks to Sum
                  </span>
                  <button
                    onClick={() => setShowBankPicker(false)}
                    className="font-bold underline text-[11px] cursor-pointer"
                  >
                    Done
                  </button>
                </div>
                {bankAccounts.map(bank => {
                  const checked = bank.includeInTotalBank !== false;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => onToggleBankInTotal(bank.id)}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:opacity-80 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border hm-border ${
                            checked ? 'hm-btn-primary' : ''
                          }`}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </span>
                        <BrandLogo brand={bank.brand} name={bank.name} size={18} />
                        <span>{bank.name}</span>
                      </span>
                      <span className="font-mono-num hm-text-muted">
                        {formatINR(bank.currentBalance, hideBalances)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 grid grid-cols-3 divide-x hm-border border-t lg:border-t-0 pt-5 lg:pt-0">
            <div className="pr-4">
              <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                Total Income
              </span>
              <span className="font-mono-num text-xl sm:text-2xl font-extrabold mt-1 block text-emerald-500">
                {formatINR(monthlyIncome, hideBalances)}
              </span>
              <span className="text-[11px] hm-text-muted mt-0.5 block">Monthly inflows</span>
            </div>

            {/* POINT 5: TOTAL EXPENSES + CONFIGURABLE MONTHLY SPEND LIMIT (BUDGET GUARD) */}
            <div className="px-4">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted">
                  Total Expenses
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLimit(!editingLimit);
                    setLimitInput(String(monthlySpendLimit || ''));
                  }}
                  title="Set Monthly Spending Limit (Budget Alert)"
                  className="p-1 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                >
                  <Pencil size={11} />
                </button>
              </div>

              <span className="font-mono-num text-xl sm:text-2xl font-extrabold mt-1 block text-rose-500">
                {formatINR(monthlyExpense, hideBalances)}
              </span>

              {editingLimit ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    placeholder="Limit ₹"
                    autoFocus
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    className="hm-input font-mono-num w-24 rounded-lg px-2 py-0.5 text-[11px] font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSpendLimit(parseFloat(limitInput) || 0);
                      setEditingLimit(false);
                    }}
                    className="p-1 rounded-lg hm-btn-primary cursor-pointer"
                  >
                    <Check size={11} />
                  </button>
                </div>
              ) : (
                <span
                  className={`text-[11px] mt-0.5 flex items-center gap-1 ${
                    isOverBudgetLimit ? 'text-rose-500 font-bold' : 'hm-text-muted'
                  }`}
                >
                  {isOverBudgetLimit && <AlertTriangle size={11} />}
                  {monthlySpendLimit > 0
                    ? `Limit: ${formatINR(monthlySpendLimit, hideBalances)} ${isOverBudgetLimit ? '(Over!)' : ''}`
                    : 'Set Spend Limit ✎'}
                </span>
              )}
            </div>

            {/* Total spendable liquid savings, revealed only after the existing PIN check. */}
            <div className="pl-4 relative">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted">
                  Total Saved
                </span>
                <button
                  type="button"
                  onClick={() => setShowSavedInstrumentPicker(!showSavedInstrumentPicker)}
                  title="Choose which instruments are included"
                  aria-label="Choose instruments included in Total Saved"
                  className="p-1 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                >
                  <SlidersHorizontal size={12} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleSavedVisibility}
                  title={isSavedUnlocked ? 'Hide Total Saved' : 'View Total Saved'}
                  aria-label={isSavedUnlocked ? 'Hide Total Saved' : 'View Total Saved'}
                  className="p-1 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                >
                  {isSavedUnlocked ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>

              <span className="font-mono-num text-xl sm:text-2xl font-extrabold mt-1 block">
                {isSavedUnlocked ? formatINR(totalSaved, false, true) : '₹ •••••'}
              </span>

              <span className="text-[11px] hm-text-muted mt-0.5 block">
                {isSavedUnlocked
                  ? `${selectedSavedInstruments.length} of ${savedInstrumentOptions.length} instruments included`
                  : 'Selected bank, cash, and wealth instruments'}
              </span>

              {showSavedInstrumentPicker && (
                <div
                  role="dialog"
                  aria-label="Select instruments for Total Saved"
                  className="absolute right-0 top-full z-40 mt-2 max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border hm-surface hm-border p-3 shadow-2xl"
                >
                  <div className="mb-2 flex items-center justify-between border-b hm-border pb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">
                      Include in Total Saved
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSavedInstrumentPicker(false)}
                      className="text-[11px] font-bold underline hm-text-muted cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                  <div className="space-y-1">
                    {savedInstrumentOptions.map(instrument => {
                      const checked = !excludedSavedInstruments.has(instrument.id);
                      return (
                        <button
                          key={instrument.id}
                          type="button"
                          aria-pressed={checked}
                          onClick={() => onToggleSavedInstrument(instrument.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:opacity-80 cursor-pointer"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border hm-border ${checked ? 'hm-btn-primary' : ''}`}>
                              {checked && <Check size={11} strokeWidth={3} />}
                            </span>
                            <span className="truncate text-[11px] font-semibold">{instrument.name}</span>
                          </span>
                          {isSavedUnlocked && (
                            <span className="shrink-0 font-mono-num text-[10px] hm-text-muted">
                              {formatINR(instrument.balance)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {savedInstrumentOptions.length === 0 && (
                      <p className="p-2 text-[11px] hm-text-muted">Add a bank, investment, or savings goal to start.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. 4 PINNED ACCOUNTS WITH AUTHENTIC LOGOS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest hm-text-muted">
            Pinned Accounts (4 Quick Slots)
          </span>
          <button
            onClick={() => onNavigate('accounts')}
            className="text-xs font-bold flex items-center gap-1 hm-text-muted hover:opacity-100 cursor-pointer"
          >
            Manage Slots <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x hm-border rounded-2xl border hm-surface overflow-hidden">
          {pinnedAccounts.map(acc => (
            <div
              key={acc.id}
              onClick={() => onNavigate('accounts')}
              className="p-4 sm:p-5 hover:opacity-90 transition cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <BrandLogo brand={acc.brand} name={acc.name} size={26} />
                  <div>
                    <span className="text-xs font-extrabold block leading-none">{acc.name}</span>
                    <span className="text-[10px] hm-text-muted mt-0.5 block">{acc.nickname}</span>
                  </div>
                </div>
              </div>
              <div className="font-mono-num text-xl font-extrabold tracking-tight mt-4">
                {formatINR(acc.currentBalance, hideBalances, true)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. CLEAN RECENT TRANSACTIONS + 6-MONTH TRAJECTORY */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between border-b hm-border pb-3">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider">Recent Activity</h2>
              <p className="text-xs hm-text-muted">Latest 5 money moves</p>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-bold flex items-center gap-1 hm-text-muted hover:opacity-100 cursor-pointer"
            >
              Full Ledger <ArrowUpRight size={13} />
            </button>
          </div>

          {recentFive.length === 0 ? (
            <p className="py-10 text-xs hm-text-muted">
              No transactions recorded yet. Click <strong>+ Entry</strong> above to start.
            </p>
          ) : (
            <div className="divide-y hm-border">
              {recentFive.map(tx => {
                const cat = getCategory(tx.categoryId);
                const acc = getAccount(tx.accountId);
                const isPos = tx.type === 'income';
                const headline =
                  tx.type === 'transfer'
                    ? `${acc.name} → ${getAccount(tx.toAccountId).name}`
                    : `${cat?.name || 'Expense'}${tx.subcategory ? ` • ${tx.subcategory}` : ''}`;

                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 text-white font-bold"
                        style={{ backgroundColor: cat?.color || '#412D15' }}
                      >
                        {cat?.icon || '⇄'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold truncate">{headline}</p>
                          {tx.starred && (
                            <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] hm-text-muted mt-0.5">
                          <BrandLogo brand={acc.brand} name={acc.name} size={13} />
                          <span>{acc.name}</span>
                          {tx.description && (
                            <span className="truncate opacity-80">• {tx.description}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono-num font-extrabold block ${
                          isPos ? 'text-emerald-500' : tx.type === 'expense' ? 'text-rose-400' : ''
                        }`}
                      >
                        {isPos ? '+' : tx.type === 'expense' ? '−' : ''}
                        {formatINR(tx.amount, hideBalances, true)}
                      </span>
                      <span className="text-[10px] hm-text-muted">{formatDateDisplay(tx.date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between border-b hm-border pb-3">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider">Cash Flow Trend</h2>
              <p className="text-xs hm-text-muted">Last 6 months comparison</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> In
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Out
              </span>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-4 pt-6 px-2 border-b hm-border">
            {cashFlowSeries.map(item => {
              const incH = Math.max(4, Math.round((item.income / maxBarValue) * 150));
              const expH = Math.max(4, Math.round((item.expense / maxBarValue) * 150));
              return (
                <div key={item.key} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex items-end justify-center gap-1.5 h-40">
                    <div
                      title={`Income: ${formatINR(item.income)}`}
                      style={{ height: `${incH}px` }}
                      className="w-3 rounded-t-xs bg-emerald-500"
                    />
                    <div
                      title={`Expense: ${formatINR(item.expense)}`}
                      style={{ height: `${expH}px` }}
                      className="w-3 rounded-t-xs bg-rose-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between px-2 text-[11px] hm-text-muted">
            {cashFlowSeries.map(item => (
              <span key={item.key} className={`flex-1 text-center ${item.isSelected ? 'font-extrabold underline' : ''}`}>
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PIN VERIFICATION MODAL (Only opens if a PIN is actually set in Profile) */}
      {showSavedPinModal && configuredPin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl border hm-surface hm-border p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={16} />
                <h3 className="text-sm font-extrabold uppercase tracking-wider">
                  Unlock Total Saved
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedPinModal(false)}
                className="p-1 hm-text-muted cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleVerifySavedPin} className="space-y-3">
              <p className="hm-text-muted">
                Enter your 4-digit Profile PIN to view your combined <strong>bank, cash, and liquid fund</strong> savings:
              </p>
              <input
                type="password"
                maxLength={4}
                autoFocus
                value={pinAttempt}
                onChange={(e) => {
                  const val = e.target.value;
                  setPinAttempt(val);
                  setPinError('');
                  if (val === configuredPin) {
                    setIsSavedUnlocked(true);
                    setShowSavedPinModal(false);
                  }
                }}
                placeholder="••••"
                className="hm-input font-mono-num w-full rounded-xl py-2.5 text-center text-lg font-extrabold tracking-widest outline-none"
              />
              {pinError && (
                <p className="text-rose-500 font-bold text-center">{pinError}</p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer"
              >
                Reveal Total Saved
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}