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
  onPayCreditCardFromHdfc,
  onTogglePinHome,
  onUpdateAccountMeta,
  onAddAccount,
  onDeleteAccount
}) {
  const [editingId, setEditingId] = useState(null);
  const [balanceVal, setBalanceVal] = useState('');
  const [editingDueDateId, setEditingDueDateId] = useState(null);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [hdfcShortfallAlert, setHdfcShortfallAlert] = useState(null);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [type, setType] = useState('bank');

  const hdfcBankObj = finState.computedAccounts.find(a => a.id === 'acc_hdfc');
  const hdfcBalance = Number(hdfcBankObj?.currentBalance) || 0;
  const pinnedCount = finState.computedAccounts.filter(a => a.pinnedOnHome).length;

  const handleBillPaidClick = (cc) => {
    const dueAmount = Number(cc.used) || 0;
    if (dueAmount <= 0) return;

    if (hdfcBalance < dueAmount) {
      setHdfcShortfallAlert({
        cardName: cc.name,
        billAmount: dueAmount,
        hdfcAvailable: hdfcBalance,
        shortfall: Number((dueAmount - hdfcBalance).toFixed(2))
      });
      return;
    }

    onPayCreditCardFromHdfc(cc);
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

      {/* 1. HDFC MONEYBACK+ CREDIT CARD STRIP */}
      <section className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-widest hm-text-muted block">
          Credit Card (10% Alert Guard & Auto-Monthly Due Email Active)
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
                        Limit {formatINR(cc.limit, hideBalances)}
                      </span>
                    </div>
                    <p className="text-xs hm-text-muted mt-0.5">
                      Auto-Monthly Due: <strong>{cc.nextDueLabel}</strong> • HDFC Salary Account:{' '}
                      <strong>{formatINR(hdfcBalance, hideBalances, true)}</strong>
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
                    disabled={isZeroDue}
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
                    <span>Utilization (10% Cap: {formatINR(cc.thresholdAmt, hideBalances)})</span>
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
                      <AlertTriangle size={12} /> Crossed 10% ({formatINR(cc.thresholdAmt)}) threshold
                    </p>
                  )}
                </div>

                {/* POINT 4: SET DUE DATE ONCE — REPEATS ON SAME DAY EVERY MONTH AUTOMATICALLY */}
                <div className="flex items-center justify-between md:justify-end gap-2.5 text-xs">
                  {editingDueDateId === cc.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const dayNum = Math.min(Math.max(Number(dueDateDraft.split('-')[2]) || 5, 1), 31);
                        onUpdateAccountMeta(cc.id, {
                          billDueDate: dueDateDraft,
                          billDueDay: dayNum
                        });
                        setEditingDueDateId(null);
                      }}
                      className="flex items-center gap-2"
                    >
                      <CalendarDatePicker
                        required
                        value={dueDateDraft}
                        onChange={setDueDateDraft}
                        ariaLabel={`${cc.name} credit card due date`}
                        className="w-44"
                      />
                      <button
                        type="submit"
                        title="Save due date"
                        className="p-1.5 rounded-lg hm-btn-primary cursor-pointer"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDueDateId(null)}
                        title="Cancel"
                        className="p-1.5 rounded-lg border hm-border cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block">
                          Monthly Due Date
                        </span>
                        <span className="font-bold">
                          (Next: {dueDateLabel})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDueDateDraft(cc.nextDueISO);
                          setEditingDueDateId(cc.id);
                        }}
                        title="Change Recurring Monthly Due Date"
                        className="p-1.5 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
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

      {/* INSUFFICIENT HDFC BANK BALANCE ALERT DIALOG */}
      {hdfcShortfallAlert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border hm-surface hm-border p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center gap-2.5 text-rose-500">
              <AlertTriangle size={22} />
              <h3 className="text-base font-extrabold">Insufficient HDFC Bank Balance</h3>
            </div>
            <p className="hm-text-muted leading-relaxed">
              Cannot pay the <strong>{hdfcShortfallAlert.cardName}</strong> bill of{' '}
              <strong className="font-mono-num">{formatINR(hdfcShortfallAlert.billAmount, false, true)}</strong> because your{' '}
              <strong>HDFC Bank (Salary Account)</strong> only has{' '}
              <strong className="font-mono-num">{formatINR(hdfcShortfallAlert.hdfcAvailable, false, true)}</strong> available
              (Shortfall: <strong className="font-mono-num">{formatINR(hdfcShortfallAlert.shortfall, false, true)}</strong>).
            </p>
            <button
              type="button"
              onClick={() => setHdfcShortfallAlert(null)}
              className="w-full py-2.5 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer"
            >
              Understood
            </button>
          </div>
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
                brand: type === 'credit' && name.toLowerCase().includes('hdfc') ? 'hdfc_cc' : name.toLowerCase(),
                type,
                openingBalance: 0,
                creditLimit: type === 'credit' ? 50000 : 0,
                alertThresholdPct: 10,
                billDueDay: 5,
                pinnedOnHome: pinnedCount < 4,
                includeInTotalBank: type === 'bank'
              });
              setName('');
              setNickname('');
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
                  onChange={(e) => setType(e.target.value)}
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
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer"
            >
              Create Account
            </button>
          </form>
        </div>
      )}
    </div>
  );
}