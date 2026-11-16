import React, { useState } from 'react';
import { Pencil, Check, Plus, Trash2 } from 'lucide-react';
import { formatINR } from '../engine/financeEngine';
import { BrandLogo } from '../components/Sidebar';

export default function ReportsView({
  finState,
  data,
  hideBalances,
  onAlterBalance,
  onAlterLiquidMf,
  onAddInvestment,
  onUpdateInvestment,
  onDeleteInvestment
}) {
  const [editingLiquidMf, setEditingLiquidMf] = useState(false);
  const [liquidMfInput, setLiquidMfInput] = useState('');

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
    totalInvestedCost,
    totalInvestmentValue,
    computedAccounts
  } = finState;

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

          <div className="lg:col-span-7 grid grid-cols-3 divide-x hm-border">
            <div className="pr-4">
              <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                Banks & Cash
              </span>
              <span className="font-mono-num text-xl font-extrabold mt-1 block">
                {formatINR(allSpendableLiquidBalance, hideBalances, true)}
              </span>
            </div>

            <div className="px-4">
              <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                Liquid MF (Savings)
              </span>
              <span className="font-mono-num text-xl font-extrabold mt-1 block">
                {formatINR(liquidMfBalance, hideBalances, true)}
              </span>
            </div>

            <div className="pl-4">
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

      {/* 2. UNSPENDABLE LIQUID MF RESERVE ROW */}
      <section className="rounded-2xl border hm-surface hm-border p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <BrandLogo brand="liquid" size={36} />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
              Unspendable Emergency Reserve
            </span>
            <h2 className="text-base font-extrabold">Liquid MF Vault</h2>
          </div>
        </div>

        {editingLiquidMf ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              autoFocus
              value={liquidMfInput}
              onChange={(e) => setLiquidMfInput(e.target.value)}
              className="hm-input font-mono-num w-32 rounded-xl px-3 py-1.5 font-extrabold text-sm outline-none"
            />
            <button
              onClick={() => {
                onAlterLiquidMf(parseFloat(liquidMfInput) || 0, liquidMfBalance);
                setEditingLiquidMf(false);
              }}
              className="p-2 rounded-xl hm-btn-primary cursor-pointer"
            >
              <Check size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="font-mono-num text-2xl font-extrabold">
              {formatINR(liquidMfBalance, hideBalances, true)}
            </span>
            <button
              onClick={() => {
                setEditingLiquidMf(true);
                setLiquidMfInput(String(liquidMfBalance));
              }}
              title="Edit Liquid MF Balance"
              className="p-1.5 rounded-lg border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}
      </section>

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