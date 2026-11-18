import React, { useState } from 'react';
import {
  Pin, Pencil, Plus, Trash2, Check, CheckCircle2,
  AlertTriangle, X, Settings
} from 'lucide-react';
import { ACCOUNT_TYPES } from '../data/defaults';
import { formatDateDisplay, formatINR } from '../engine/financeEngine';
import { BrandLogo } from '../components/Sidebar';
import CalendarDatePicker from '../components/CalendarDatePicker';

function AccountActionsMenu({
  account,
  isPrimary,
  canDelete,
  onTogglePin,
  onSetPrimary,
  onEdit,
  onDelete,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const runAction = (action) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative">
      <button
        type="button"
        title={`${account.name} settings`}
        aria-label={`${account.name} settings`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="rounded-lg border hm-elevated hm-border p-2 hm-text-muted hover:opacity-100 cursor-pointer"
      >
        <Settings size={14} />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-xl border hm-surface hm-border p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onEdit)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:opacity-80 cursor-pointer"
          >
            <Pencil size={13} /> Edit details
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onTogglePin)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:opacity-80 cursor-pointer"
          >
            <Pin size={13} /> {account.pinnedOnHome ? 'Unpin from home' : 'Pin to home'}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isPrimary}
            onClick={() => runAction(onSetPrimary)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:opacity-80 disabled:opacity-50 cursor-pointer disabled:cursor-default"
          >
            <CheckCircle2 size={13} /> {isPrimary ? 'Primary account' : 'Set as primary'}
          </button>
          {canDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onDelete)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 size={13} /> Delete account
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AccountsView({
  finState,
  hideBalances,
  primaryAccountId,
  onSetPrimaryAccount,
  onAlterBalance,
  onPayCreditCard,
  onTogglePinHome,
  onUpdateAccountMeta,
  onAddAccount,
  onDeleteAccount
}) {
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountDraft, setAccountDraft] = useState({});
  const [accountFormError, setAccountFormError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [type, setType] = useState('bank');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
  const [alertThresholdPct, setAlertThresholdPct] = useState('');
  const [billDueDate, setBillDueDate] = useState('');
  const [paymentSourceAccountId, setPaymentSourceAccountId] = useState('');
  const bankAccounts = finState.computedAccounts.filter((account) => account.type === 'bank');
  const pinnedCount = finState.computedAccounts.filter(a => a.pinnedOnHome).length;

  const handleBillPaidClick = (cc) => {
    onPayCreditCard(cc);
  };

  const openAccountEditor = (account) => {
    const dueDay = Number(account.billDueDay);
    setEditingAccount(account);
    setAccountDraft({
      name: account.name || '',
      nickname: account.nickname || '',
      brand: account.brand || '',
      currentBalance: String(account.currentBalance ?? 0),
      includeInTotalBank: account.includeInTotalBank !== false,
      creditLimit: String(account.creditLimit ?? ''),
      alertThresholdPct: String(account.alertThresholdPct ?? ''),
      billDueDate: account.billDueDate || (
        Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31
          ? `2024-01-${String(dueDay).padStart(2, '0')}`
          : ''
      ),
      paymentSourceAccountId: account.paymentSourceAccountId || '',
    });
    setAccountFormError('');
  };

  const updateAccountDraft = (field, value) => {
    setAccountDraft((draft) => ({ ...draft, [field]: value }));
  };

  const saveAccountDetails = (event) => {
    event.preventDefault();
    if (!editingAccount || !accountDraft.name.trim()) return;

    const updatedAccount = {
      name: accountDraft.name.trim(),
      nickname: accountDraft.nickname.trim() || 'Account',
      brand: accountDraft.brand.trim() || accountDraft.name.trim().toLowerCase(),
    };

    if (editingAccount.type === 'bank') {
      updatedAccount.includeInTotalBank = Boolean(accountDraft.includeInTotalBank);
    }

    if (editingAccount.type === 'credit') {
      const limit = Number(accountDraft.creditLimit);
      const alertPct = Number(accountDraft.alertThresholdPct);
      const dueDay = Number(accountDraft.billDueDate.split('-')[2]);
      const hasPaymentBank = bankAccounts.some(
        (account) => account.id === accountDraft.paymentSourceAccountId,
      );
      if (!Number.isFinite(limit) || limit <= 0) {
        setAccountFormError('Enter a credit limit greater than zero.');
        return;
      }
      if (!Number.isFinite(alertPct) || alertPct < 0 || alertPct > 100) {
        setAccountFormError('Alert cap must be between 0 and 100%.');
        return;
      }
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        setAccountFormError('Choose a valid bill due date.');
        return;
      }
      if (!hasPaymentBank) {
        setAccountFormError('Choose an existing bank account for bill payments.');
        return;
      }
      Object.assign(updatedAccount, {
        creditLimit: limit,
        alertThresholdPct: alertPct,
        billDueDate: accountDraft.billDueDate,
        billDueDay: dueDay,
        paymentSourceAccountId: accountDraft.paymentSourceAccountId,
      });
    }

    const nextBalance = Number(accountDraft.currentBalance);
    const currentBalance = Number(editingAccount.currentBalance) || 0;
    if (!Number.isFinite(nextBalance)) {
      setAccountFormError('Enter a valid balance.');
      return;
    }

    onUpdateAccountMeta(editingAccount.id, updatedAccount);
    if (nextBalance !== currentBalance) {
      onAlterBalance(editingAccount.id, nextBalance, currentBalance);
    }
    setEditingAccount(null);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b hm-border pb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted">
            Banking & Credit Facilities
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">
            Accounts & Cards
          </h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl hm-btn-primary font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer w-fit"
        >
          <Plus size={14} /> Add Account
        </button>
      </div>

      {/* Credit cards */}
      <section className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-widest hm-text-muted block">
          Credit Cards
        </span>

        {finState.ccAlerts.map(cc => {
          const isZeroDue = cc.used <= 0;
          const dueDateLabel = formatDateDisplay(cc.nextDueISO);

          return (
            <div
              key={cc.id}
              className="rounded-2xl border hm-surface hm-border p-6 space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b hm-border pb-5">
                <div className="flex items-center gap-3.5">
                  <BrandLogo brand={cc.brand} name={cc.name} size={42} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-extrabold">{cc.name}</h2>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full border hm-elevated hm-border font-bold">
                        {cc.limit > 0 ? `Limit ${formatINR(cc.limit, hideBalances)}` : 'Limit not set'}
                      </span>
                    </div>
                    <p className="text-xs hm-text-muted mt-0.5">
                      Monthly Due: <strong>{cc.nextDueLabel}</strong> • Payment account:{' '}
                      <strong>
                        {bankAccounts.find((account) => account.id === cc.paymentSourceAccountId)?.name || 'Not set'}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <AccountActionsMenu
                    account={cc}
                    isPrimary={primaryAccountId === cc.id}
                    onTogglePin={() => onTogglePinHome(cc.id)}
                    onSetPrimary={() => onSetPrimaryAccount(cc.id)}
                    onEdit={() => openAccountEditor(cc)}
                  />
                  <button
                    type="button"
                    onClick={() => handleBillPaidClick(cc)}
                    disabled={isZeroDue || !cc.paymentSourceAccountId}
                    className={`px-4 py-2 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition ${
                      isZeroDue
                        ? 'border hm-border hm-elevated opacity-40 cursor-not-allowed'
                        : 'hm-btn-primary cursor-pointer shadow-sm'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span>
                      {isZeroDue
                        ? 'Bill Settled ✓ (Until Next Spend)'
                        : `Bill Paid (${formatINR(cc.used, hideBalances)})`}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                    Current Outstanding Due
                  </span>
                  <span className="mt-1 block font-mono-num text-3xl font-extrabold">
                    {formatINR(cc.used, hideBalances, true)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>
                      {cc.thresholdAmt > 0
                        ? `Utilization (${cc.thresholdPct}% Alert: ${formatINR(cc.thresholdAmt, hideBalances)})`
                        : 'Alert threshold not set'}
                    </span>
                    <span className="font-mono-num">{cc.utilizationPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full hm-elevated overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        cc.isExceeded ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, isZeroDue ? 0 : Math.max(2, cc.utilizationPct))}%` }}
                    />
                  </div>
                  {cc.isExceeded && (
                    <p className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
                      <AlertTriangle size={12} /> Crossed {cc.thresholdPct}% ({formatINR(cc.thresholdAmt)}) threshold
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2.5 text-xs">
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block">
                      Monthly Due Date
                    </span>
                    <span className="font-bold">{dueDateLabel || 'Not set'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* 2. BANKS & CASH LEDGER */}
      <section className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-widest hm-text-muted block">
          Bank Accounts & Cash ({pinnedCount}/4 Pinned to Home)
        </span>

        <div className="divide-y hm-border border-y">
          {finState.computedAccounts
            .filter(a => a.type !== 'credit')
            .map(acc => (
              <div
                key={acc.id}
                className="py-4 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#412D15]/10 transition"
              >
                <div className="flex items-center gap-3.5">
                  <BrandLogo brand={acc.brand} name={acc.name} size={34} />
                  <div>
                    <h3 className="text-sm font-extrabold">{acc.name}</h3>
                    <p className="text-[11px] hm-text-muted">{acc.nickname}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className="font-mono-num text-lg font-extrabold">
                    {formatINR(acc.currentBalance, hideBalances, true)}
                  </span>
                  <div className="flex items-center">
                    <AccountActionsMenu
                      account={acc}
                      isPrimary={primaryAccountId === acc.id}
                      canDelete={finState.computedAccounts.length > 1}
                      onTogglePin={() => onTogglePinHome(acc.id)}
                      onSetPrimary={() => onSetPrimaryAccount(acc.id)}
                      onEdit={() => openAccountEditor(acc)}
                      onDelete={() => onDeleteAccount(acc.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <form
            onSubmit={saveAccountDetails}
            className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border hm-surface hm-border p-5 text-xs shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between border-b hm-border pb-3">
              <div>
                <h3 className="text-base font-extrabold">Edit {editingAccount.name}</h3>
                <p className="mt-1 hm-text-muted">
                  Instrument type stays fixed to protect transaction and balance calculations.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close account editor"
                onClick={() => setEditingAccount(null)}
                className="rounded-lg p-1 hm-text-muted hover:opacity-80 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                Account / card name
                <input
                  type="text"
                  required
                  value={accountDraft.name}
                  onChange={(event) => updateAccountDraft('name', event.target.value)}
                  className="hm-input mt-1 w-full rounded-lg px-3 py-2 text-xs normal-case"
                />
              </label>
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                Account role / nickname
                <input
                  type="text"
                  value={accountDraft.nickname}
                  onChange={(event) => updateAccountDraft('nickname', event.target.value)}
                  className="hm-input mt-1 w-full rounded-lg px-3 py-2 text-xs normal-case"
                />
              </label>
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                Brand
                <input
                  type="text"
                  value={accountDraft.brand}
                  onChange={(event) => updateAccountDraft('brand', event.target.value)}
                  className="hm-input mt-1 w-full rounded-lg px-3 py-2 text-xs normal-case"
                />
              </label>
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                {editingAccount.type === 'credit' ? 'Current outstanding balance' : 'Current balance'}
                <input
                  type="number"
                  step="any"
                  min={editingAccount.type === 'credit' ? '0' : undefined}
                  required
                  value={accountDraft.currentBalance}
                  onChange={(event) => updateAccountDraft('currentBalance', event.target.value)}
                  className="hm-input mt-1 w-full rounded-lg px-3 py-2 font-mono-num text-xs normal-case"
                />
              </label>

              {editingAccount.type === 'bank' && (
                <label className="flex items-center gap-2 rounded-lg border hm-border p-3 text-xs sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(accountDraft.includeInTotalBank)}
                    onChange={(event) => updateAccountDraft('includeInTotalBank', event.target.checked)}
                    className="accent-amber-500"
                  />
                  Include this account in the bank total on Home
                </label>
              )}

              {editingAccount.type === 'credit' && (
                <>
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Credit limit
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={accountDraft.creditLimit}
                      onChange={(event) => updateAccountDraft('creditLimit', event.target.value)}
                      className="hm-input mt-1 w-full rounded-lg px-3 py-2 font-mono-num text-xs normal-case"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Alert cap (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      required
                      value={accountDraft.alertThresholdPct}
                      onChange={(event) => updateAccountDraft('alertThresholdPct', event.target.value)}
                      className="hm-input mt-1 w-full rounded-lg px-3 py-2 font-mono-num text-xs normal-case"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Bill due date
                    <CalendarDatePicker
                      required
                      value={accountDraft.billDueDate}
                      onChange={(value) => updateAccountDraft('billDueDate', value)}
                      ariaLabel={`${editingAccount.name} credit card due date`}
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Pay bill from
                    <select
                      required
                      value={accountDraft.paymentSourceAccountId}
                      onChange={(event) => updateAccountDraft('paymentSourceAccountId', event.target.value)}
                      className="hm-input mt-1 w-full rounded-lg px-3 py-2 text-xs normal-case"
                    >
                      <option value="" disabled>Select a bank account</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>

            <p className="hm-text-muted">
              Balance corrections adjust the starting balance while preserving existing transactions.
            </p>
            {accountFormError && <p role="alert" className="text-rose-500">{accountFormError}</p>}
            <div className="flex justify-end gap-2 border-t hm-border pt-3">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="rounded-lg border hm-border px-3 py-2 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg hm-btn-primary px-3 py-2 text-xs font-bold cursor-pointer"
              >
                <Check size={14} /> Save details
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD NEW ACCOUNT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onAddAccount({
                id: 'acc_' + Date.now(),
                name: name.trim(),
                nickname: nickname.trim() || 'Account',
                brand: name.toLowerCase(),
                type,
                openingBalance: Number(openingBalance) || 0,
                ...(type === 'credit'
                  ? {
                      creditLimit: Number(creditLimit),
                      alertThresholdPct: Number(alertThresholdPct),
                      billDueDate,
                      billDueDay: Number(billDueDate.split('-')[2]),
                      paymentSourceAccountId
                    }
                  : {}),
                pinnedOnHome: pinnedCount < 4,
                includeInTotalBank: type === 'bank'
              });
              setName('');
              setNickname('');
              setOpeningBalance('0');
              setCreditLimit('');
              setAlertThresholdPct('');
              setBillDueDate('');
              setPaymentSourceAccountId('');
              setShowAddModal(false);
            }}
            className="w-full max-w-md space-y-4 rounded-2xl border hm-surface hm-border p-6 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b hm-border pb-3">
              <h3 className="text-base font-extrabold">Add Account</h3>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase hm-text-muted block mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setCreditLimit('');
                    setAlertThresholdPct('');
                    setBillDueDate('');
                    setPaymentSourceAccountId('');
                  }}
                  className="hm-input w-full rounded-xl px-3 py-2.5 outline-none"
                >
                  {ACCOUNT_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase hm-text-muted block mb-1">Bank / Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Axis Bank"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="hm-input w-full rounded-xl px-3 py-2.5 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase hm-text-muted block mb-1">
                  {type === 'credit' ? 'Opening outstanding balance' : 'Opening balance'}
                </label>
                <input
                  type="number"
                  min={type === 'credit' ? '0' : undefined}
                  step="any"
                  required
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                  className="hm-input w-full rounded-xl px-3 py-2.5 font-mono-num outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase hm-text-muted block mb-1">Account Role</label>
                <input
                  type="text"
                  placeholder="e.g. Salary Account / Side Gig"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="hm-input w-full rounded-xl px-3 py-2.5 outline-none"
                />
              </div>
              {type === 'credit' && (
                <div className="space-y-3 rounded-xl border hm-border p-3">
                  <p className="font-bold">Credit card settings</p>
                  <label className="block text-[10px] font-bold uppercase hm-text-muted">
                    Credit limit
                    <input
                      required
                      type="number"
                      min="1"
                      step="any"
                      value={creditLimit}
                      onChange={(event) => setCreditLimit(event.target.value)}
                      className="hm-input mt-1 w-full rounded-lg px-3 py-2 text-xs normal-case"
                    />
                  </label>
                  <label className="block text-[10px] font-bold uppercase hm-text-muted">
                    Alert cap (% of limit; 0 disables alerts)
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={alertThresholdPct}
                      onChange={(event) => setAlertThresholdPct(event.target.value)}
                      className="hm-input mt-1 w-full rounded-lg px-3 py-2 text-xs normal-case"
                    />
                  </label>
                  <label className="block text-[10px] font-bold uppercase hm-text-muted">
                    Bill due date
                    <CalendarDatePicker
                      required
                      value={billDueDate}
                      onChange={setBillDueDate}
                      ariaLabel="Credit card bill due date"
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="block text-[10px] font-bold uppercase hm-text-muted">
                    Pay bill from
                    <select
                      required
                      value={paymentSourceAccountId}
                      onChange={(event) => setPaymentSourceAccountId(event.target.value)}
                      className="hm-input mt-1 w-full rounded-lg px-3 py-2 text-xs normal-case"
                    >
                      <option value="" disabled>Select a bank account</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                    </select>
                  </label>
                  {bankAccounts.length === 0 && (
                    <p className="text-rose-500">
                      Add a bank account before adding a credit card.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={type === 'credit' && bankAccounts.length === 0}
              className="w-full py-3 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Account
            </button>
          </form>
        </div>
      )}
    </div>
  );
}