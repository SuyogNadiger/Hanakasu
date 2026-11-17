import React, { useState } from 'react';
import {
  Pin, Pencil, Plus, Trash2, Check, CheckCircle2,
  AlertTriangle, X
} from 'lucide-react';
import { ACCOUNT_TYPES } from '../data/defaults';
import { formatDateDisplay, formatINR } from '../engine/financeEngine';
import { BrandLogo } from '../components/Sidebar';
import CalendarDatePicker from '../components/CalendarDatePicker';

export default function AccountsView({
  finState,
  hideBalances,
  onAlterBalance,
  onPayCreditCard,
  onTogglePinHome,
  onUpdateAccountMeta,
  onAddAccount,
  onDeleteAccount
}) {
  const [editingId, setEditingId] = useState(null);
  const [balanceVal, setBalanceVal] = useState('');
  const [editingCardSettingsId, setEditingCardSettingsId] = useState(null);
  const [cardSettingsDraft, setCardSettingsDraft] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [type, setType] = useState('bank');
  const [creditLimit, setCreditLimit] = useState('');
  const [alertThresholdPct, setAlertThresholdPct] = useState('');
  const [billDueDate, setBillDueDate] = useState('');
  const [paymentSourceAccountId, setPaymentSourceAccountId] = useState('');
  const bankAccounts = finState.computedAccounts.filter((account) => account.type === 'bank');
  const pinnedCount = finState.computedAccounts.filter(a => a.pinnedOnHome).length;

  const handleBillPaidClick = (cc) => {
    onPayCreditCard(cc);
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
                  <button
                    onClick={() => onTogglePinHome(cc.id)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      cc.pinnedOnHome ? 'hm-btn-primary' : 'hm-elevated hm-border opacity-70'
                    }`}
                  >
                    <Pin size={12} /> {cc.pinnedOnHome ? 'Pinned' : 'Pin'}
                  </button>

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
                  {editingId === cc.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        step="any"
                        autoFocus
                        value={balanceVal}
                        onChange={(e) => setBalanceVal(e.target.value)}
                        className="hm-input font-mono-num w-36 rounded-xl px-3 py-1.5 font-extrabold text-base outline-none"
                      />
                      <button
                        onClick={() => {
                          onAlterBalance(cc.id, parseFloat(balanceVal) || 0, cc.currentBalance);
                          setEditingId(null);
                        }}
                        className="p-2 rounded-xl hm-btn-primary cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 mt-1">
                      <span className="font-mono-num text-3xl font-extrabold">
                        {formatINR(cc.used, hideBalances, true)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingId(cc.id);
                          setBalanceVal(String(cc.used));
                        }}
                        title="Edit Balance"
                        className="p-1.5 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
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
                  <button
                    type="button"
                    onClick={() => {
                      setCardSettingsDraft({
                        name: cc.name,
                        creditLimit: cc.creditLimit ?? '',
                        alertThresholdPct: cc.alertThresholdPct ?? '',
                        billDueDate: cc.billDueDate || '',
                        paymentSourceAccountId: cc.paymentSourceAccountId || '',
                      });
                      setEditingCardSettingsId(cc.id);
                    }}
                    title="Edit credit card settings"
                    className="p-1.5 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
              {editingCardSettingsId === cc.id && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const dueDay = Number(cardSettingsDraft.billDueDate.split('-')[2]);
                    onUpdateAccountMeta(cc.id, {
                      name: cardSettingsDraft.name.trim(),
                      creditLimit: Number(cardSettingsDraft.creditLimit),
                      alertThresholdPct: Number(cardSettingsDraft.alertThresholdPct),
                      billDueDate: cardSettingsDraft.billDueDate,
                      billDueDay: dueDay,
                      paymentSourceAccountId: cardSettingsDraft.paymentSourceAccountId,
                    });
                    setEditingCardSettingsId(null);
                  }}
                  className="grid grid-cols-1 gap-3 border-t hm-border pt-4 sm:grid-cols-2 lg:grid-cols-5"
                >
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Card name
                    <input
                      required
                      value={cardSettingsDraft.name || ''}
                      onChange={(event) => setCardSettingsDraft({ ...cardSettingsDraft, name: event.target.value })}
                      className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Credit limit
                    <input
                      required
                      type="number"
                      min="1"
                      step="any"
                      value={cardSettingsDraft.creditLimit}
                      onChange={(event) => setCardSettingsDraft({ ...cardSettingsDraft, creditLimit: event.target.value })}
                      className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Alert cap (%)
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={cardSettingsDraft.alertThresholdPct}
                      onChange={(event) => setCardSettingsDraft({ ...cardSettingsDraft, alertThresholdPct: event.target.value })}
                      className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Bill due date
                    <CalendarDatePicker
                      required
                      value={cardSettingsDraft.billDueDate || ''}
                      onChange={(value) => setCardSettingsDraft({ ...cardSettingsDraft, billDueDate: value })}
                      ariaLabel={`${cc.name} credit card due date`}
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase hm-text-muted">
                    Pay from bank
                    <select
                      required
                      value={cardSettingsDraft.paymentSourceAccountId || ''}
                      onChange={(event) => setCardSettingsDraft({ ...cardSettingsDraft, paymentSourceAccountId: event.target.value })}
                      className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                    >
                      <option value="" disabled>Select bank</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
                    <button type="submit" className="rounded-lg hm-btn-primary px-3 py-2 text-xs font-bold cursor-pointer">Save settings</button>
                    <button type="button" onClick={() => setEditingCardSettingsId(null)} className="rounded-lg border hm-border px-3 py-2 text-xs font-bold cursor-pointer">Cancel</button>
                  </div>
                </form>
              )}
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
                  {editingId === acc.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        autoFocus
                        value={balanceVal}
                        onChange={(e) => setBalanceVal(e.target.value)}
                        className="hm-input font-mono-num w-32 rounded-xl px-3 py-1.5 font-extrabold text-sm outline-none"
                      />
                      <button
                        onClick={() => {
                          onAlterBalance(acc.id, parseFloat(balanceVal) || 0, acc.currentBalance);
                          setEditingId(null);
                        }}
                        className="p-1.5 rounded-lg hm-btn-primary cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-lg font-extrabold">
                        {formatINR(acc.currentBalance, hideBalances, true)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingId(acc.id);
                          setBalanceVal(String(acc.currentBalance));
                        }}
                        title="Edit Balance"
                        className="p-1.5 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onTogglePinHome(acc.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                        acc.pinnedOnHome ? 'hm-btn-primary' : 'hm-elevated hm-border opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Pin size={11} /> {acc.pinnedOnHome ? 'Pinned' : 'Pin'}
                    </button>

                    {finState.computedAccounts.length > 1 && (
                      <button
                        onClick={() => onDeleteAccount(acc.id)}
                        className="p-1.5 hm-text-muted hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

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
                openingBalance: 0,
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
              setCreditLimit('');
              setAlertThresholdPct('');
              setBillDueDate('');
              setPaymentSourceAccountId('');
              setShowAddModal(false);
            }}
            className="w-full max-w-md rounded-2xl border hm-surface hm-border p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b hm-border pb-3">
              <h3 className="text-base font-extrabold">Add Account (Starts at ₹0)</h3>
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