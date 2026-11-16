import React, { useState, useMemo, useCallback } from 'react';
import {
  SlidersHorizontal, Download, Plus, Settings, Star,
  RotateCcw, Users, Trash2, Edit2, BellPlus, X, AlertTriangle
} from 'lucide-react';
import { formatINR, parseLocalDateISO } from '../engine/financeEngine';
import { BrandLogo } from '../components/Sidebar';

export default function TransactionsView({
  data,
  hideBalances,
  onOpenQuickAdd,
  onEditTx,
  onUpdateTxDirect,
  onDeleteTx,
  onCreateManualAlert,
  lastDeletedTx,
  onUndoDelete
}) {
  const { transactions = [], accounts = [], categories = [] } = data;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [starredOnly, setStarredOnly] = useState(false);

  // Gear Menu Dropdown State
  const [openGearId, setOpenGearId] = useState(null);

  // AlertDialog State before Deleting (Point 10)
  const [confirmDeleteTx, setConfirmDeleteTx] = useState(null);

  // Split Transaction Modal State (Point 10)
  const [splitModalTx, setSplitModalTx] = useState(null);
  const [numPeople, setNumPeople] = useState(2);
  const [friendShares, setFriendShares] = useState([{ name: 'Person 1', amount: '' }]);

  const getAccount = (id) => {
    if (id === 'liquid_mf') return { name: 'Liquid MF (Savings)', brand: 'liquid' };
    return accounts.find(a => a.id === id) || { name: 'Account', brand: 'bank' };
  };
  const getCategory = useCallback((id) => categories.find(c => c.id === id), [categories]);

  const filtered = useMemo(() => {
    return transactions
      .filter(tx => {
        const q = search.toLowerCase();
        const cat = getCategory(tx.categoryId);
        const matchSearch =
          !q ||
          tx.description?.toLowerCase().includes(q) ||
          tx.subcategory?.toLowerCase().includes(q) ||
          cat?.name?.toLowerCase().includes(q) ||
          String(tx.amount).includes(q);
        const matchType = typeFilter === 'all' || tx.type === typeFilter;
        const matchAcc = accountFilter === 'all' || tx.accountId === accountFilter || tx.toAccountId === accountFilter;
        const matchStar = !starredOnly || Boolean(tx.starred);
        return matchSearch && matchType && matchAcc && matchStar;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [transactions, search, typeFilter, accountFilter, starredOnly, getCategory]);

  // Summary Totals for Filtered View
  const summaryTotals = useMemo(() => {
    const inc = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const exp = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    return { inc, exp, net: inc - exp };
  }, [filtered]);

  // Group by Date for Clean Timeline Presentation
  const groupedByDate = useMemo(() => {
    const groups = {};
    filtered.forEach(tx => {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Open Split Calculator Modal
  const handleOpenSplitModal = (tx) => {
    setOpenGearId(null);
    const baseAmt = Number(tx.originalAmount || tx.amount) || 0;
    setSplitModalTx({ ...tx, baseAmt });
    setNumPeople(2);
    setFriendShares([{ name: 'Friend 1', amount: '' }]);
  };

  const handlePeopleCountChange = (count) => {
    const n = Math.max(2, Math.min(20, Number(count) || 2));
    setNumPeople(n);
    const othersCount = n - 1;
    const updated = Array.from({ length: othersCount }, (_, i) => ({
      name: friendShares[i]?.name || `Person ${i + 1}`,
      amount: friendShares[i]?.amount || ''
    }));
    setFriendShares(updated);
  };

  // "Split Equally" Button Handler
  const handleSplitEqually = () => {
    if (!splitModalTx) return;
    const eachShare = Number((splitModalTx.baseAmt / numPeople).toFixed(2));
    setFriendShares(prev => prev.map(p => ({ ...p, amount: String(eachShare) })));
  };

  const totalFriendsShare = friendShares.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const myRemainingSpend = splitModalTx
    ? Math.max(0, Number((splitModalTx.baseAmt - totalFriendsShare).toFixed(2)))
    : 0;

  const handleCommitSplit = () => {
    if (!splitModalTx) return;
    const splitSummary = friendShares
      .filter(p => parseFloat(p.amount) > 0)
      .map(p => `${p.name}: ₹${p.amount}`)
      .join(', ');

    onUpdateTxDirect({
      ...splitModalTx,
      originalAmount: splitModalTx.baseAmt,
      amount: myRemainingSpend,
      description: splitModalTx.description
        ? `${splitModalTx.description} (Split ${numPeople} ways • ${splitSummary})`
        : `Split bill (${splitSummary})`
    });
    setSplitModalTx(null);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'Type', 'Category', 'Subcategory', 'Narrative', 'Account', 'Amount', 'Starred'];
    const rows = filtered.map(tx => [
      tx.date,
      tx.time || '',
      tx.type,
      `"${getCategory(tx.categoryId)?.name || tx.type}"`,
      `"${tx.subcategory || ''}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      `"${getAccount(tx.accountId).name}"`,
      tx.amount,
      tx.starred ? 'Yes' : 'No'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hanakasu-Mantri-ledger.csv`;
    a.click();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 1. TOP SEARCH, FILTER TOGGLE & SUMMARY BAR */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category, note or ₹..."
              className="hm-input flex-1 rounded-2xl px-4 py-2.5 text-xs font-semibold outline-none"
            />
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                filtersOpen ? 'hm-btn-primary' : 'hm-surface hm-border'
              }`}
              title="Filter Criteria"
            >
              <SlidersHorizontal size={14} />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="p-2.5 rounded-2xl border hm-surface hm-border text-xs font-bold cursor-pointer"
              title="Export CSV"
            >
              <Download size={15} />
            </button>
            <button
              onClick={onOpenQuickAdd}
              className="px-4 py-2.5 rounded-2xl hm-btn-primary font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        {/* Collapsible Filter Criteria */}
        {filtersOpen && (
          <div className="p-4 rounded-2xl border hm-surface hm-border grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="hm-input rounded-xl px-3 py-2 outline-none"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="transfer">Transfers</option>
            </select>

            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="hm-input rounded-xl px-3 py-2 outline-none"
            >
              <option value="all">All Accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
              <option value="liquid_mf">Liquid MF (Savings)</option>
            </select>

            <button
              type="button"
              onClick={() => setStarredOnly(!starredOnly)}
              className={`rounded-xl px-3 py-2 border font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                starredOnly ? 'hm-btn-primary' : 'hm-input'
              }`}
            >
              <Star size={13} className={starredOnly ? 'fill-current' : ''} />
              <span>{starredOnly ? 'Showing Starred Only' : 'Filter Starred'}</span>
            </button>
          </div>
        )}

        {/* Top Summary Totals Strip (Inflow | Outflow | Net Σ) */}
        <div className="px-4 py-2.5 rounded-2xl border hm-surface hm-border flex items-center justify-between text-xs font-mono-num">
          <span className="text-emerald-500 font-bold">
            +{formatINR(summaryTotals.inc, hideBalances, true)}
          </span>
          <span className="text-rose-400 font-bold">
            −{formatINR(summaryTotals.exp, hideBalances, true)}
          </span>
          <span className="font-extrabold">
            Σ {summaryTotals.net >= 0 ? '+' : ''}
            {formatINR(summaryTotals.net, hideBalances, true)}
          </span>
        </div>
      </div>

      {/* 5-SECOND AUTO-DISMISSING UNDO BANNER (Point 10) */}
      {lastDeletedTx && (
        <div className="p-3.5 rounded-2xl border hm-elevated hm-border flex items-center justify-between text-xs shadow-lg">
          <span>
            Deleted <strong>{lastDeletedTx.subcategory || lastDeletedTx.description || 'Transaction'}</strong> (Disappears in 5s)
          </span>
          <button
            onClick={onUndoDelete}
            className="px-3.5 py-1.5 rounded-xl hm-btn-primary font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={13} /> Undo
          </button>
        </div>
      )}

      {/* 2. DATE-GROUPED TIMELINE LEDGER */}
      {groupedByDate.length === 0 ? (
        <div className="py-16 text-center text-xs hm-text-muted">
          No transactions match your view.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([dateStr, dayTxs]) => {
            const dObj = parseLocalDateISO(dateStr);
            const dayNum = dObj ? String(dObj.getDate()).padStart(2, '0') : '--';
            const weekday = dObj ? dObj.toLocaleDateString('en-IN', { weekday: 'long' }) : 'Unknown date';
            const monthYear = dObj ? dObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : dateStr || 'Date not set';

            const dayNet = dayTxs.reduce((acc, t) => {
              if (t.type === 'income') return acc + Number(t.amount);
              if (t.type === 'expense') return acc - Number(t.amount);
              return acc;
            }, 0);

            return (
              <div key={dateStr} className="border-b hm-border pb-4 space-y-3">
                {/* Date Group Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-num text-2xl font-extrabold leading-none">
                      {dayNum}
                    </span>
                    <div>
                      <p className="text-xs font-bold leading-tight">{weekday}</p>
                      <p className="text-[11px] hm-text-muted">{monthYear}</p>
                    </div>
                  </div>

                  <span
                    className={`font-mono-num text-xs font-extrabold ${
                      dayNet > 0 ? 'text-emerald-500' : dayNet < 0 ? 'text-rose-400' : 'hm-text-muted'
                    }`}
                  >
                    Σ {dayNet > 0 ? '+' : ''}
                    {formatINR(dayNet, hideBalances, true)}
                  </span>
                </div>

                {/* Day's Transactions */}
                <div className="space-y-1.5">
                  {dayTxs.map(tx => {
                    const cat = getCategory(tx.categoryId);
                    const acc = getAccount(tx.accountId);
                    const toAcc = tx.toAccountId ? getAccount(tx.toAccountId) : null;
                    const isPos = tx.type === 'income';
                    const isTransfer = tx.type === 'transfer' || tx.type === 'cc_bill_payment';

                    // Compact Primary Title: Category • Subcategory (Point 10)
                    const primaryTitle = isTransfer
                      ? `${acc.name} → ${toAcc?.name || 'Account'}`
                      : `${cat?.name || 'Entry'}${tx.subcategory ? ` • ${tx.subcategory}` : ''}`;

                    return (
                      <div
                        key={tx.id}
                        className="relative p-3 rounded-2xl hover:bg-[#412D15]/15 transition flex items-center justify-between gap-3"
                      >
                        {/* Left: Category Circle + Compact Info */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0 text-white font-bold shadow-xs"
                            style={{ backgroundColor: cat?.color || '#412D15' }}
                          >
                            {isTransfer ? '⇄' : cat?.icon || '•'}
                          </div>

                          <div className="min-w-0">
                            {/* Compact Title + Gold Star ONLY if Starred */}
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs sm:text-sm font-bold truncate">
                                {primaryTitle}
                              </p>
                              {tx.starred && (
                                <Star
                                  size={13}
                                  className="fill-amber-400 text-amber-400 shrink-0"
                                  title="Starred Transaction"
                                />
                              )}
                            </div>

                            {/* Bank Logo + Bank Name */}
                            <div className="flex items-center gap-1.5 text-[11px] hm-text-muted mt-0.5">
                              <BrandLogo brand={acc.brand} name={acc.name} size={14} />
                              <span className="font-semibold text-sky-400">{acc.name}</span>
                            </div>

                            {/* Small Subtle Narrative Note (Only if entered) */}
                            {tx.description && (
                              <p className="text-[11px] hm-text-muted truncate mt-0.5 max-w-xs sm:max-w-md">
                                {tx.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Amount, Time & Single Settings Gear Icon */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span
                              className={`font-mono-num text-sm font-extrabold block ${
                                isPos
                                  ? 'text-emerald-500'
                                  : tx.type === 'expense'
                                  ? 'text-rose-400'
                                  : ''
                              }`}
                            >
                              {isPos ? '+' : tx.type === 'expense' ? '' : ''}
                              {formatINR(tx.amount, hideBalances, true)}
                            </span>
                            {tx.time && (
                              <span className="text-[10px] hm-text-muted block">
                                {tx.time}
                              </span>
                            )}
                          </div>

                          {/* Single Settings / Gear Icon (Point 10) */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenGearId(openGearId === tx.id ? null : tx.id)
                              }
                              className="p-2 rounded-xl border hm-border hm-elevated hm-text-muted hover:opacity-100 cursor-pointer"
                              title="Transaction Options"
                            >
                              <Settings size={14} />
                            </button>

                            {openGearId === tx.id && (
                              <div className="absolute right-0 top-full mt-1.5 w-48 z-40 rounded-2xl border hm-surface hm-border shadow-2xl p-1.5 space-y-1 text-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateTxDirect({ ...tx, starred: !tx.starred });
                                    setOpenGearId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left font-semibold flex items-center gap-2 hover:bg-[#412D15]/25 cursor-pointer"
                                >
                                  <Star
                                    size={13}
                                    className={tx.starred ? 'fill-amber-400 text-amber-400' : ''}
                                  />
                                  <span>{tx.starred ? 'Remove Star' : 'Star Transaction'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenGearId(null);
                                    onEditTx(tx);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left font-semibold flex items-center gap-2 hover:bg-[#412D15]/25 cursor-pointer"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit Transaction</span>
                                </button>

                                {tx.type === 'expense' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSplitModal(tx)}
                                    className="w-full px-3 py-2 rounded-xl text-left font-semibold flex items-center gap-2 hover:bg-[#412D15]/25 cursor-pointer"
                                  >
                                    <Users size={13} />
                                    <span>Split Transaction</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenGearId(null);
                                    onCreateManualAlert(tx);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left font-semibold flex items-center gap-2 hover:bg-[#412D15]/25 cursor-pointer"
                                >
                                  <BellPlus size={13} />
                                  <span>Set SMS/Mail Alert</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenGearId(null);
                                    setConfirmDeleteTx(tx);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left font-semibold text-rose-400 flex items-center gap-2 hover:bg-rose-500/15 cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                  <span>Delete Transaction</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. DELETE CONFIRMATION ALERT DIALOG (Point 10) */}
      {confirmDeleteTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border hm-surface hm-border p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={22} />
              <h3 className="text-base font-extrabold">Delete Transaction?</h3>
            </div>
            <p className="hm-text-muted leading-relaxed">
              Are you sure you want to delete{' '}
              <strong>
                {confirmDeleteTx.subcategory || confirmDeleteTx.description || 'this entry'}
              </strong>{' '}
              of <strong>{formatINR(confirmDeleteTx.amount, false, true)}</strong>?
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTx(null)}
                className="px-4 py-2 rounded-xl border hm-border font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTx(confirmDeleteTx.id);
                  setConfirmDeleteTx(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-extrabold cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SPLIT TRANSACTION CALCULATOR MODAL (Point 10) */}
      {splitModalTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border hm-surface hm-border p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b hm-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
                  Bill Split Calculator
                </span>
                <h3 className="text-base font-extrabold">
                  Total Bill: {formatINR(splitModalTx.baseAmt, false, true)}
                </h3>
              </div>
              <button onClick={() => setSplitModalTx(null)} className="p-1 hm-text-muted">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="font-bold">Total People (Incl. You):</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={numPeople}
                  onChange={(e) => handlePeopleCountChange(e.target.value)}
                  className="hm-input font-mono-num w-16 rounded-xl px-2.5 py-1.5 text-center font-extrabold outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSplitEqually}
                className="px-3.5 py-2 rounded-xl hm-btn-primary font-extrabold cursor-pointer"
              >
                Split Equally
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <span className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block">
                Respective Shares of Other {numPeople - 1} People (Refunded to You):
              </span>
              {friendShares.map((person, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2">
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => {
                      const next = [...friendShares];
                      next[idx].name = e.target.value;
                      setFriendShares(next);
                    }}
                    className="hm-input col-span-3 rounded-xl px-3 py-2 font-semibold outline-none"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="₹ Share"
                    value={person.amount}
                    onChange={(e) => {
                      const next = [...friendShares];
                      next[idx].amount = e.target.value;
                      setFriendShares(next);
                    }}
                    className="hm-input font-mono-num col-span-2 rounded-xl px-3 py-2 font-bold outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl border hm-elevated hm-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block">
                  Your Net Remaining Spending
                </span>
                <span className="text-[11px] hm-text-muted">
                  ({formatINR(splitModalTx.baseAmt)} − {formatINR(totalFriendsShare)} refunded)
                </span>
              </div>
              <span className="font-mono-num text-lg font-extrabold text-emerald-500">
                {formatINR(myRemainingSpend, false, true)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCommitSplit}
              className="w-full py-3 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer"
            >
              Set {formatINR(myRemainingSpend, false, true)} as My Spending
            </button>
          </div>
        </div>
      )}
    </div>
  );
}