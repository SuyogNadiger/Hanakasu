import React, { useState } from 'react';
import { Pencil, Check, Plus, Trash2, X } from 'lucide-react';
import { formatINR } from '../engine/financeEngine';
import { BrandLogo } from '../components/Sidebar';

export default function ReportsView({
  finState,
  data,
  hideBalances,
  onAlterBalance,
  onAlterLiquidMf,
  onUpdateEmergencyReserve,
  onWithdrawEmergencyReserve,
  onAddInvestment,
  onUpdateInvestment,
  onDeleteInvestment
}) {
  const [editingLiquidMf, setEditingLiquidMf] = useState(false);
  const [liquidMfInput, setLiquidMfInput] = useState('');
  const [reserveSettingsOpen, setReserveSettingsOpen] = useState(false);
  const [reserveDraft, setReserveDraft] = useState({
    name: data.emergencyReserve?.name || 'Emergency Reserve',
    sourceAccountId: data.emergencyReserve?.sourceAccountId || 'liquid_mf',
    amount: data.emergencyReserve?.amount ?? 0,
  });
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const bankAccounts = finState.computedAccounts.filter((account) => account.type === 'bank');
  const [withdrawalAccountId, setWithdrawalAccountId] = useState(bankAccounts[0]?.id || '');

  const [editingInvId, setEditingInvId] = useState(null);
  const [invDraft, setInvDraft] = useState({});

  const [editingBankId, setEditingBankId] = useState(null);
  const [bankInput, setBankInput] = useState('');

  const [newInvName, setNewInvName] = useState('');
  const [newInvType, setNewInvType] = useState('Mutual Fund (SIP)');

  const {
    netWorth,
    totalAssets,
    totalLiabilities,
    allSpendableLiquidBalance,
    liquidMfBalance,
    liquidMfGrossBalance,
    emergencyReserveBalance,
    emergencyReserveShortfall,
    totalInvestedCost,
    totalInvestmentValue,
    computedAccounts
  } = finState;
  const reserveSourceName =
    reserveDraft.sourceAccountId === 'liquid_mf'
      ? 'Liquid fund'
      : computedAccounts.find((account) => account.id === reserveDraft.sourceAccountId)?.name || 'Bank account';

  return (
    <div className="space-y-10">
      {/* 1. CLEAN NET WORTH SUMMARY HEADER */}
      <section className="border-b hm-border pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-5">
            <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
              Consolidated Net Worth
            </span>
            <div className="font-mono-num text-4xl sm:text-5xl font-extrabold tracking-tight mt-1">
              {formatINR(netWorth, hideBalances, true)}
            </div>
            <p className="text-xs hm-text-muted mt-1">
              Total Assets {formatINR(totalAssets, hideBalances)} − Liabilities {formatINR(totalLiabilities, hideBalances)}
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 gap-y-4 divide-x hm-border sm:grid-cols-4">
            <div className="pr-3 sm:pr-4">
              <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                Banks & Cash
              </span>
              <span className="font-mono-num text-xl font-extrabold mt-1 block">
                {formatINR(allSpendableLiquidBalance, hideBalances, true)}
              </span>
            </div>

            <div className="px-3 sm:px-4">
              <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                Liquid Fund Available
              </span>
              <span className="font-mono-num text-xl font-extrabold mt-1 block">
                {formatINR(liquidMfBalance, hideBalances, true)}
              </span>
            </div>

            <div className="px-3 sm:px-4">
              <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                Emergency Reserve
              </span>
              <span className="font-mono-num text-xl font-extrabold mt-1 block">
                {formatINR(emergencyReserveBalance, hideBalances, true)}
              </span>
              <span className="text-[10px] hm-text-muted">Locked in {reserveSourceName}</span>
            </div>

            <div className="pl-3 sm:pl-4">
              <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                MF & Gold Portfolio Value
              </span>
              <span className="font-mono-num text-xl font-extrabold mt-1 block">
                {formatINR(totalInvestmentValue, hideBalances, true)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border hm-surface hm-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <BrandLogo brand="liquid" size={34} />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
              Locked reserve
            </span>
            <h2 className="truncate text-sm font-extrabold">{data.emergencyReserve?.name || 'Emergency Reserve'}</h2>
            <p className="text-[11px] hm-text-muted">Saved in {reserveSourceName} · excluded from spendable balances</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span className="font-mono-num text-xl font-extrabold">
            {formatINR(emergencyReserveBalance, hideBalances, true)}
          </span>
          <button
            type="button"
            onClick={() => {
              setReserveDraft({
                name: data.emergencyReserve?.name || 'Emergency Reserve',
                sourceAccountId: data.emergencyReserve?.sourceAccountId || 'liquid_mf',
                amount: data.emergencyReserve?.amount ?? 0,
              });
              setReserveSettingsOpen(true);
            }}
            aria-label="Edit reserve settings and withdrawals"
            title="Edit reserve settings and withdrawals"
            className="rounded-lg border hm-elevated hm-border p-2 hm-text-muted cursor-pointer"
          >
            <Pencil size={15} />
          </button>
        </div>
      </section>

      {reserveSettingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reserve settings"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReserveSettingsOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border hm-surface hm-border p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider">Reserve settings</h2>
                <p className="mt-1 text-[11px] hm-text-muted">Edit the lock or withdraw reserve funds to a bank.</p>
              </div>
              <button
                type="button"
                onClick={() => setReserveSettingsOpen(false)}
                aria-label="Close reserve settings"
                className="rounded-lg p-1.5 hm-text-muted cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {emergencyReserveShortfall > 0 && (
              <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                The configured reserve exceeds its source balance by {formatINR(emergencyReserveShortfall)}. The unavailable portion is not counted in net worth.
              </p>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (onUpdateEmergencyReserve(reserveDraft)) {
                  setReserveDraft({ ...reserveDraft, amount: Number(reserveDraft.amount) });
                  setReserveSettingsOpen(false);
                }
              }}
              className="grid grid-cols-1 gap-3 border-t hm-border pt-4 sm:grid-cols-2"
            >
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                Reserve name
                <input
                  required
                  value={reserveDraft.name}
                  onChange={(event) => setReserveDraft({ ...reserveDraft, name: event.target.value })}
                  className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                />
              </label>
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                Saved in
                <select
                  value={reserveDraft.sourceAccountId}
                  onChange={(event) => setReserveDraft({ ...reserveDraft, sourceAccountId: event.target.value })}
                  className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                >
                  <option value="liquid_mf">Liquid fund</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                Amount to lock
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={reserveDraft.amount}
                  onChange={(event) => setReserveDraft({ ...reserveDraft, amount: event.target.value })}
                  className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                />
              </label>
              {reserveDraft.sourceAccountId === 'liquid_mf' && (
                <div className="text-[10px] font-bold uppercase hm-text-muted">
                  Liquid fund total
                  {editingLiquidMf ? (
                    <div className="mt-1 flex gap-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        autoFocus
                        value={liquidMfInput}
                        onChange={(event) => setLiquidMfInput(event.target.value)}
                        className="hm-input min-w-0 flex-1 rounded-lg px-2 py-2 text-xs normal-case"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onAlterLiquidMf(Number(liquidMfInput), liquidMfGrossBalance);
                          setEditingLiquidMf(false);
                        }}
                        className="rounded-lg hm-btn-primary p-2 cursor-pointer"
                        aria-label="Save liquid fund total"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLiquidMf(true);
                        setLiquidMfInput(String(liquidMfGrossBalance));
                      }}
                      className="mt-1 flex w-full items-center justify-between rounded-lg border hm-border px-2.5 py-2 text-xs normal-case"
                    >
                      {formatINR(liquidMfGrossBalance, hideBalances, true)} <Pencil size={12} />
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-end sm:col-span-2">
                <button type="submit" className="rounded-lg hm-btn-primary px-3 py-2 text-xs font-bold cursor-pointer">
                  Save reserve settings
                </button>
              </div>
            </form>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (onWithdrawEmergencyReserve(Number(withdrawalAmount), withdrawalAccountId)) {
                  setWithdrawalAmount('');
                  setReserveSettingsOpen(false);
                }
              }}
              className="grid grid-cols-1 gap-3 border-t hm-border pt-4 sm:grid-cols-[1fr_1fr_auto]"
            >
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                Withdraw to bank
                <select
                  required
                  value={withdrawalAccountId}
                  onChange={(event) => setWithdrawalAccountId(event.target.value)}
                  className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                >
                  <option value="" disabled>Select destination bank</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase hm-text-muted">
                Withdrawal amount
                <input
                  required
                  type="number"
                  min="0.01"
                  max={emergencyReserveBalance}
                  step="any"
                  value={withdrawalAmount}
                  onChange={(event) => setWithdrawalAmount(event.target.value)}
                  className="hm-input mt-1 w-full rounded-lg px-2.5 py-2 text-xs normal-case"
                />
              </label>
              <button
                type="submit"
                disabled={!bankAccounts.length || emergencyReserveBalance <= 0}
                className="rounded-lg hm-btn-primary px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Withdraw reserve
              </button>
              {!bankAccounts.length && (
                <p className="text-xs hm-text-muted sm:col-span-2">
                  Add a bank account before withdrawing the reserve.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 3. SIMPLIFIED MUTUAL FUNDS & GOLD PORTFOLIO (Point 12: No Gain/Loss Clutter) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b hm-border pb-3">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider">
                Mutual Funds & Gold Holdings
              </h2>
              <p className="text-xs hm-text-muted">
                Current portfolio value {formatINR(totalInvestmentValue, hideBalances, true)} · Invested {formatINR(totalInvestedCost, hideBalances, true)}
              </p>
              <p className="text-[11px] hm-text-muted">
                Enter each holding’s current market value; holdings without one use invested amount. Prices are not fetched automatically.
              </p>
            </div>
          </div>

          <div className="divide-y hm-border border-b">
            {data.investments.map(inv => {
              const isEditing = editingInvId === inv.id;
              return (
                <div key={inv.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <BrandLogo brand={inv.brand} name={inv.name} size={34} />
                    <div>
                      <p className="font-extrabold text-sm">{inv.name}</p>
                      <p className="text-[11px] hm-text-muted">
                        {inv.type}
                        {inv.sipAmount > 0 && ` • Auto-SIP: ${formatINR(inv.sipAmount)} on Day ${inv.sipDay || 1}`}
                      </p>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div>
                        <span className="text-[10px] hm-text-muted block">Invested (₹)</span>
                        <input
                          type="number"
                          value={invDraft.investedAmount}
                          onChange={(e) =>
                            setInvDraft({ ...invDraft, investedAmount: Number(e.target.value) })
                          }
                          className="hm-input font-mono-num w-28 rounded-lg px-2.5 py-1 font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] hm-text-muted block">Current Value (₹)</span>
                        <input
                          type="number"
                          step="any"
                          value={invDraft.currentValue ?? invDraft.investedAmount ?? 0}
                          onChange={(e) =>
                            setInvDraft({ ...invDraft, currentValue: Number(e.target.value) })
                          }
                          className="hm-input font-mono-num w-28 rounded-lg px-2.5 py-1 font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] hm-text-muted block">Monthly SIP (₹)</span>
                        <input
                          type="number"
                          value={invDraft.sipAmount || 0}
                          onChange={(e) =>
                            setInvDraft({ ...invDraft, sipAmount: Number(e.target.value) })
                          }
                          className="hm-input font-mono-num w-24 rounded-lg px-2.5 py-1 font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] hm-text-muted block">SIP Day</span>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={invDraft.sipDay || 1}
                          onChange={(e) =>
                            setInvDraft({ ...invDraft, sipDay: Number(e.target.value) })
                          }
                          className="hm-input font-mono-num w-14 rounded-lg px-2 py-1 text-center font-bold"
                        />
                      </div>
                      <button
                        onClick={() => {
                          onUpdateInvestment(inv.id, invDraft);
                          setEditingInvId(null);
                        }}
                        className="p-2 rounded-lg hm-btn-primary mt-3.5 cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-num text-base font-extrabold">
                        {formatINR(inv.currentValue ?? inv.investedAmount, hideBalances, true)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingInvId(inv.id);
                          setInvDraft({ ...inv });
                        }}
                        title="Edit Holding"
                        className="p-1.5 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteInvestment(inv.id)}
                        className="p-1.5 hm-text-muted hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Simple Add Holding Row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newInvName.trim()) return;
              onAddInvestment({
                id: 'inv_' + Date.now(),
                name: newInvName.trim(),
                brand: newInvName.toLowerCase(),
                type: newInvType,
                investedAmount: 0,
                sipAmount: 0,
                sipDay: 1
              });
              setNewInvName('');
            }}
            className="flex gap-2 pt-1 text-xs"
          >
            <input
              type="text"
              placeholder="Add Fund or Stock..."
              value={newInvName}
              onChange={(e) => setNewInvName(e.target.value)}
              className="hm-input flex-1 rounded-xl px-3.5 py-2 outline-none"
            />
            <select
              value={newInvType}
              onChange={(e) => setNewInvType(e.target.value)}
              className="hm-input rounded-xl px-3 py-2 outline-none"
            >
              <option value="Mutual Fund (SIP)">Mutual Fund</option>
              <option value="Gold ETF / Equity">Stocks / Gold</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl hm-btn-primary font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add
            </button>
          </form>
        </div>

        {/* Right 5 Cols: All Banks, Cash & Cards Directory */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border-b hm-border pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              All Bank & Cash Balances
            </h2>
            <p className="text-xs hm-text-muted">Complete liquidity overview in one place</p>
          </div>

          <div className="divide-y hm-border border-b text-xs">
            {computedAccounts.map(acc => (
              <div key={acc.id} className="py-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <BrandLogo brand={acc.brand} name={acc.name} size={28} />
                  <div>
                    <p className="font-extrabold text-sm">{acc.name}</p>
                    <p className="text-[11px] hm-text-muted">{acc.nickname}</p>
                  </div>
                </div>

                {editingBankId === acc.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="any"
                      autoFocus
                      value={bankInput}
                      onChange={(e) => setBankInput(e.target.value)}
                      className="hm-input font-mono-num w-28 rounded-lg px-2 py-1 font-bold text-right"
                    />
                    <button
                      onClick={() => {
                        onAlterBalance(acc.id, parseFloat(bankInput) || 0, acc.currentBalance);
                        setEditingBankId(null);
                      }}
                      className="p-1.5 rounded-lg hm-btn-primary cursor-pointer"
                    >
                      <Check size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-sm font-extrabold">
                      {formatINR(acc.currentBalance, hideBalances, true)}
                    </span>
                    <button
                      onClick={() => {
                        setEditingBankId(acc.id);
                        setBankInput(String(acc.currentBalance));
                      }}
                      title="Edit Balance"
                      className="p-1.5 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}