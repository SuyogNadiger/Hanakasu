import React, { useState, useMemo } from 'react';
import {
  X, Clock, Plus, ArrowRight, AlertCircle, Sparkles
} from 'lucide-react';
import {
  getTodayISO,
  getCurrentTimeStr,
  formatINR,
  evaluateMathExpression,
  smartParseMagicInput
} from '../engine/financeEngine';
import { BrandLogo } from './Sidebar';
import CalendarDatePicker from './CalendarDatePicker';

export default function TransactionModal({
  isOpen,
  onClose,
  onSave,
  onAddSubcategory,
  computedAccounts,
  liquidMfBalance,
  categories,
  editingTx = null
}) {
  const [magicInput, setMagicInput] = useState('');
  const [type, setType] = useState(() => editingTx?.type || 'expense');
  const [amountInput, setAmountInput] = useState(() => String(editingTx?.amount || ''));
  const [date, setDate] = useState(() => editingTx?.date || getTodayISO());
  const [time] = useState(() => editingTx?.time || getCurrentTimeStr());
  const [accountId, setAccountId] = useState(() => editingTx?.accountId || computedAccounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(() => editingTx?.toAccountId || 'liquid_mf');
  const [categoryId, setCategoryId] = useState(() => editingTx?.categoryId || 'cat_food');
  const [subcategory, setSubcategory] = useState(() => editingTx?.subcategory || '');
  const [description, setDescription] = useState(() => editingTx?.description || '');
  const [newSubName, setNewSubName] = useState('');
  const [showAddSub, setShowAddSub] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Strict Source Accounts:
  // - Income & Transfer: Banks & Cash ONLY (No Credit Card, No Liquid MF)
  // - Expense: Banks, Cash & Credit Card (No Liquid MF)
  const allowedSourceAccounts = useMemo(() => {
    return computedAccounts.filter(acc => {
      if (acc.type === 'liquid_mf') return false;
      if ((type === 'income' || type === 'transfer') && acc.type === 'credit') {
        return false;
      }
      return true;
    });
  }, [computedAccounts, type]);

  const selectedAccountId = allowedSourceAccounts.some(acc => acc.id === accountId)
    ? accountId
    : allowedSourceAccounts[0]?.id || '';

  // Strict Destination Tabs for Transfer:
  // Different Banks/Cash + Unspendable Liquid MF Vault
  const allowedDestinationTabs = useMemo(() => {
    if (type !== 'transfer') return [];
    const otherBanksAndCash = computedAccounts.filter(
      acc => acc.type !== 'credit' && acc.id !== selectedAccountId
    );
    return [
      ...otherBanksAndCash,
      {
        id: 'liquid_mf',
        name: 'Liquid MF (Savings)',
        nickname: 'Unspendable Reserve',
        brand: 'liquid',
        type: 'liquid_mf',
        currentBalance: liquidMfBalance || 0
      }
    ];
  }, [computedAccounts, type, selectedAccountId, liquidMfBalance]);

  const selectedToAccountId = allowedDestinationTabs.some(dest => dest.id === toAccountId)
    ? toAccountId
    : allowedDestinationTabs[0]?.id || 'liquid_mf';

  const relevantCategories = useMemo(() => {
    return categories.filter(c => (type === 'income' ? c.type === 'income' : c.type === 'expense'));
  }, [categories, type]);

  const activeCategoryObj = useMemo(() => {
    return relevantCategories.find(c => c.id === categoryId) || relevantCategories[0];
  }, [relevantCategories, categoryId]);

  // Point 9: Smart Magic Bar Handler
  const handleMagicBarChange = (val) => {
    setMagicInput(val);
    const parsed = smartParseMagicInput(val, categories, computedAccounts);
    if (parsed) {
      if (parsed.type) setType(parsed.type);
      if (parsed.amount) setAmountInput(String(parsed.amount));
      if (parsed.accountId) setAccountId(parsed.accountId);
      if (parsed.categoryId) setCategoryId(parsed.categoryId);
      if (parsed.subcategory !== undefined) setSubcategory(parsed.subcategory);
      if (parsed.description !== undefined) setDescription(parsed.description);
    }
  };

  if (!isOpen) return null;

  const evaluatedAmount = evaluateMathExpression(amountInput);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!evaluatedAmount || evaluatedAmount <= 0) {
      setErrorMsg('Enter an amount greater than ₹0.');
      return;
    }

    if (type === 'transfer' && (!selectedToAccountId || selectedAccountId === selectedToAccountId)) {
      setErrorMsg('Transfer must be between two different accounts.');
      return;
    }

    const sourceAcc = computedAccounts.find(a => a.id === selectedAccountId);
    const destObj = allowedDestinationTabs.find(d => d.id === selectedToAccountId);

    const finalDesc =
      description.trim() ||
      (type === 'transfer'
        ? `${sourceAcc?.name || 'Bank'} → ${destObj?.name || 'Liquid MF'}`
        : '');

    onSave({
      id: editingTx?.id,
      type,
      amount: evaluatedAmount,
      date,
      time,
      accountId: selectedAccountId,
      toAccountId: type === 'transfer' ? selectedToAccountId : null,
      categoryId: type === 'transfer' ? 'transfer' : activeCategoryObj?.id,
      subcategory:
        type === 'transfer'
          ? selectedToAccountId === 'liquid_mf'
            ? 'Liquid MF Savings'
            : 'Account Transfer'
          : subcategory,
      paymentMethod:
        sourceAcc?.type === 'credit'
          ? 'Credit Card'
          : sourceAcc?.type === 'cash'
          ? 'Cash'
          : 'UPI / GPay',
      description: finalDesc,
      starred: editingTx ? Boolean(editingTx.starred) : false,
      createdAt: editingTx?.createdAt
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border hm-surface hm-border shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b hm-border flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted block">
              Hanakasu Mantri
            </span>
            <h2 className="text-base font-extrabold tracking-tight">
              {editingTx ? 'Edit Transaction' : 'New Transaction'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hm-text-muted hover:opacity-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center gap-2 font-semibold">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SMART MAGIC BAR (Point 9: Restored!) */}
          {!editingTx && (
            <div className="p-3 rounded-xl border hm-elevated hm-border space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hm-text-muted">
                <Sparkles size={12} /> Smart Magic Bar — Type to Auto-Fill
              </label>
              <input
                type="text"
                value={magicInput}
                onChange={(e) => handleMagicBarChange(e.target.value)}
                placeholder='e.g. "180 cravings union" or "60 public sbi" or "1500 shopping card"'
                className="hm-input w-full rounded-lg px-3 py-2 text-xs font-medium outline-none"
              />
            </div>
          )}

          {/* 1. TYPE SWITCHER */}
          <div className="grid grid-cols-3 p-1 rounded-xl border hm-elevated hm-border font-bold">
            {['expense', 'income', 'transfer'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 rounded-lg capitalize transition cursor-pointer ${
                  type === t ? 'hm-btn-primary shadow-xs' : 'hm-text-muted hover:opacity-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 2. AMOUNT & SHORT NARRATIVE */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block mb-1">
                Amount (₹ or math)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0"
                className="hm-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-lg font-extrabold outline-none"
              />
              {/[+\-×÷*/]/.test(amountInput) && (
                <span className="text-[11px] hm-text-muted mt-1 block">
                  = <strong>{formatINR(evaluatedAmount, false, true)}</strong>
                </span>
              )}
            </div>

            <div className="sm:col-span-7">
              <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block mb-1">
                Short Narrative (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short note (e.g. Water, Dinner with friends)..."
                className="hm-input w-full rounded-xl px-3.5 py-3 text-xs font-semibold outline-none"
              />
            </div>
          </div>

          {/* 3. PAYING FROM / CREDITED TO TABS WITH AUTHENTIC LOGOS */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block">
              {type === 'income'
                ? 'Credited To (Banks & Cash Only)'
                : type === 'transfer'
                ? 'Transfer From (Banks & Cash Only)'
                : 'Paying From'}
            </label>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {allowedSourceAccounts.map(acc => {
                const selected = selectedAccountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccountId(acc.id)}
                    className={`px-3 py-2 rounded-xl border text-left shrink-0 flex items-center gap-2.5 transition cursor-pointer ${
                      selected
                        ? 'hm-btn-primary border-transparent shadow-sm'
                        : 'hm-elevated hm-border opacity-80 hover:opacity-100'
                    }`}
                  >
                    <BrandLogo brand={acc.brand} name={acc.name} size={24} />
                    <div>
                      <p className="font-bold text-xs leading-none">{acc.name}</p>
                      <p className="font-mono-num text-[10px] opacity-75 mt-1">
                        {formatINR(acc.currentBalance, false, true)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. TRANSFER TO TABS (INCLUDES UNSPENDABLE LIQUID MF) */}
          {type === 'transfer' && (
            <div className="space-y-1.5 pt-2 border-t hm-border">
              <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted flex items-center gap-1.5">
                <ArrowRight size={12} /> Transfer To (Different Party or Liquid MF Savings)
              </label>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {allowedDestinationTabs.map(dest => {
                  const selected = selectedToAccountId === dest.id;
                  return (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => setToAccountId(dest.id)}
                      className={`px-3 py-2 rounded-xl border text-left shrink-0 flex items-center gap-2.5 transition cursor-pointer ${
                        selected
                          ? 'hm-btn-primary border-transparent shadow-sm'
                          : 'hm-elevated hm-border opacity-80 hover:opacity-100'
                      }`}
                    >
                      <BrandLogo brand={dest.brand} name={dest.name} size={24} />
                      <div>
                        <p className="font-bold text-xs leading-none">{dest.name}</p>
                        <p className="font-mono-num text-[10px] opacity-75 mt-1">
                          {formatINR(dest.currentBalance, false, true)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. CATEGORY & SUBCATEGORY CHIPS */}
          {type !== 'transfer' && (
            <div className="space-y-3 pt-2 border-t hm-border">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted block mb-1.5">
                  Category
                </label>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {relevantCategories.map(cat => {
                    const active = activeCategoryObj?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategoryId(cat.id);
                          setSubcategory(cat.subcategories?.[0] || '');
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                          active
                            ? 'hm-btn-primary border-transparent'
                            : 'hm-elevated hm-border opacity-80 hover:opacity-100'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeCategoryObj && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted">
                      Subcategory
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddSub(!showAddSub)}
                      className="text-[10px] font-bold underline hm-text-muted hover:opacity-100 cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus size={11} /> Add Subcategory
                    </button>
                  </div>

                  {showAddSub && (
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder="New subcategory..."
                        className="hm-input flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newSubName.trim()) {
                            onAddSubcategory(activeCategoryObj.id, newSubName.trim());
                            setSubcategory(newSubName.trim());
                            setNewSubName('');
                          }
                          setShowAddSub(false);
                        }}
                        className="px-3 py-1.5 rounded-lg hm-btn-primary font-bold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {(activeCategoryObj.subcategories || []).map(sub => {
                      const activeSub = subcategory === sub;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSubcategory(activeSub ? '' : sub)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                            activeSub
                              ? 'hm-btn-primary border-transparent font-bold'
                              : 'hm-elevated hm-border opacity-75 hover:opacity-100'
                          }`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. DATE, TIME & SUBMIT */}
          <div className="pt-3 border-t hm-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CalendarDatePicker
                value={date}
                onChange={setDate}
                ariaLabel="Transaction date"
                className="w-40"
              />
              <span className="flex items-center gap-1 text-xs hm-text-muted">
                <Clock size={13} /> {time}
              </span>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl hm-btn-primary font-extrabold text-xs uppercase tracking-wider cursor-pointer"
            >
              {editingTx ? 'Save Changes' : `Save ${type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}