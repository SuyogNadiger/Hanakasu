import React, { useState, useMemo } from 'react';
import {
  X, Clock, Plus, ArrowRight, AlertCircle, Check
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

function toTimeInputValue(value) {
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(value || '');
  if (twelveHour) {
    const hour = Number(twelveHour[1]) % 12 +
      (twelveHour[3].toLowerCase() === 'pm' ? 12 : 0);
    return `${String(hour).padStart(2, '0')}:${twelveHour[2]}`;
  }
  const twentyFourHour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '');
  return twentyFourHour ? `${twentyFourHour[1]}:${twentyFourHour[2]}` : '';
}

function toStoredTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '');
  if (!match) return null;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'pm' : 'am'}`;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSave,
  onAddSubcategory,
  computedAccounts,
  primaryAccountId = '',
  emergencyReserve = { name: 'Emergency Reserve', sourceAccountId: 'liquid_mf' },
  emergencyReserveBalance = 0,
  categories,
  editingTx = null,
  showAccountBalances = true
}) {
  const [magicInput, setMagicInput] = useState('');
  const [type, setType] = useState(() => editingTx?.type || 'expense');
  const [amountInput, setAmountInput] = useState(() => String(editingTx?.amount || ''));
  const [date, setDate] = useState(() => editingTx?.date || getTodayISO());
  const initialTime = editingTx?.time || getCurrentTimeStr();
  const [timeInput, setTimeInput] = useState(() => toTimeInputValue(initialTime));
  const [accountId, setAccountId] = useState(() =>
    editingTx?.accountId ||
    primaryAccountId ||
    computedAccounts.find((account) => account.type !== 'credit')?.id ||
    '',
  );
  const [toAccountId, setToAccountId] = useState(() =>
    editingTx?.isEmergencyReserveContribution || editingTx?.toAccountId === 'liquid_mf'
      ? 'emergency_reserve'
      : editingTx?.toAccountId || '',
  );
  const [categoryId, setCategoryId] = useState(() => editingTx?.categoryId || '');
  const [subcategory, setSubcategory] = useState(() => editingTx?.subcategory || '');
  const [description, setDescription] = useState(() => editingTx?.description || '');
  const [newSubName, setNewSubName] = useState('');
  const [showAddSub, setShowAddSub] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [accountManuallySelected, setAccountManuallySelected] = useState(false);
  const [destinationManuallySelected, setDestinationManuallySelected] = useState(false);

  // Strict Source Accounts:
  // - Income & Transfer: Banks & Cash ONLY (No Credit Card, No Liquid MF)
  // - Expense: Banks, Cash & Credit Card (No Liquid MF)
  const allowedSourceAccounts = useMemo(() => {
    return computedAccounts
      .filter(acc => {
        if (acc.type === 'liquid_mf') return false;
        if ((type === 'income' || type === 'transfer') && acc.type === 'credit') {
          return false;
        }
        return true;
      })
      .sort((first, second) => {
        if (first.type === 'cash' || second.type === 'cash') {
          return Number(first.type === 'cash') - Number(second.type === 'cash');
        }
        if (first.id === primaryAccountId) return -1;
        if (second.id === primaryAccountId) return 1;
        return 0;
      });
  }, [computedAccounts, type, primaryAccountId]);

  const selectedAccountId = allowedSourceAccounts.some(acc => acc.id === accountId)
    ? accountId
    : allowedSourceAccounts[0]?.id || '';
  const selectedSourceAccount = computedAccounts.find(
    (account) => account.id === selectedAccountId,
  );

  // Transfers can go to another account or the locked emergency reserve.
  const allowedDestinationTabs = useMemo(() => {
    if (type !== 'transfer') return [];
    const otherBanksAndCash = computedAccounts.filter(
      acc => acc.type !== 'credit' && acc.id !== selectedAccountId
    );
    return [
      ...otherBanksAndCash,
      {
        id: 'emergency_reserve',
        name: emergencyReserve.name || 'Emergency Reserve',
        nickname: 'Locked reserve',
        brand: 'liquid',
        type: 'emergency_reserve',
        currentBalance: emergencyReserveBalance || 0,
      }
    ];
  }, [computedAccounts, type, selectedAccountId, emergencyReserve, emergencyReserveBalance]);

  const selectedToAccountId = allowedDestinationTabs.some(dest => dest.id === toAccountId)
    ? toAccountId
    : '';

  const relevantCategories = useMemo(() => {
    return categories.filter(c => (type === 'income' ? c.type === 'income' : c.type === 'expense'));
  }, [categories, type]);

  const activeCategoryObj = useMemo(() => {
    return relevantCategories.find(c => c.id === categoryId) || null;
  }, [relevantCategories, categoryId]);
  const magicParsed = useMemo(
    () => smartParseMagicInput(magicInput, categories, computedAccounts, primaryAccountId),
    [magicInput, categories, computedAccounts, primaryAccountId],
  );

  const applyTime = (value) => {
    const formattedInput = toTimeInputValue(value);
    if (!formattedInput) return;
    setTimeInput(formattedInput);
  };

  // Parse locally so recognized transaction details are available immediately.
  const handleMagicBarChange = (val) => {
    setMagicInput(val);
    setAccountManuallySelected(false);
    setDestinationManuallySelected(false);
    const parsed = smartParseMagicInput(val, categories, computedAccounts, primaryAccountId);
    if (parsed) {
      if (parsed.type) setType(parsed.type);
      if (parsed.amount !== undefined) setAmountInput(String(parsed.amount));
      if (parsed.accountExplicit && parsed.accountId) setAccountId(parsed.accountId);
      setToAccountId(parsed.type === 'transfer' ? parsed.toAccountId || '' : '');
      if (parsed.categoryId) setCategoryId(parsed.categoryId);
      if (parsed.subcategory !== undefined) setSubcategory(parsed.subcategory);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.date) setDate(parsed.date);
      if (parsed.time) applyTime(parsed.time);
    }
  };

  if (!isOpen) return null;

  const evaluatedAmount = evaluateMathExpression(amountInput);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (magicParsed?.accountAmbiguous && !accountManuallySelected) {
      setErrorMsg('More than one account matches the prompt. Select the correct Paying From account.');
      return;
    }

    if (magicParsed?.destinationAmbiguous && !destinationManuallySelected) {
      setErrorMsg('More than one destination account matches the prompt. Select the correct destination.');
      return;
    }

    const transactionTime = toStoredTime(timeInput);
    if (!transactionTime) {
      setErrorMsg('Choose a valid transaction time.');
      return;
    }

    if (!evaluatedAmount || evaluatedAmount <= 0) {
      setErrorMsg('Enter an amount greater than ₹0.');
      return;
    }

    if (type !== 'transfer' && !activeCategoryObj) {
      setErrorMsg('Select a category before saving.');
      return;
    }

    if (!selectedAccountId) {
      setErrorMsg('Add an account before saving this transaction.');
      return;
    }

    if (type === 'transfer' && !selectedToAccountId) {
      setErrorMsg('Select a destination account for this transfer.');
      return;
    }

    if (type === 'transfer' && selectedAccountId === selectedToAccountId) {
      setErrorMsg('Transfer must be between two different accounts.');
      return;
    }

    const sourceAcc = computedAccounts.find(a => a.id === selectedAccountId);
    const destObj = allowedDestinationTabs.find(d => d.id === selectedToAccountId);
    const balanceAvailable =
      (Number(sourceAcc?.currentBalance) || 0) +
      (editingTx?.accountId === selectedAccountId &&
      ['expense', 'transfer'].includes(editingTx.type)
        ? Number(editingTx.amount) || 0
        : 0);
    if (
      ['expense', 'transfer'].includes(type) &&
      Number(sourceAcc?.reservedAmount) > 0 &&
      evaluatedAmount > balanceAvailable
    ) {
      setErrorMsg('This amount exceeds the spendable balance; the emergency reserve is locked.');
      return;
    }

    const finalDesc =
      description.trim() ||
      (type === 'transfer'
        ? `${sourceAcc?.name || 'Bank'} → ${destObj?.name || 'Emergency Reserve'}`
        : '');
    const isEmergencyReserveContribution =
      type === 'transfer' && selectedToAccountId === 'emergency_reserve';
    const actualDestinationId = isEmergencyReserveContribution
      ? emergencyReserve.sourceAccountId || 'liquid_mf'
      : selectedToAccountId;

    onSave({
      id: editingTx?.id,
      type,
      amount: evaluatedAmount,
      date,
      time: transactionTime,
      accountId: selectedAccountId,
      toAccountId: type === 'transfer' ? actualDestinationId : null,
      isEmergencyReserveContribution,
      categoryId: type === 'transfer' ? 'transfer' : activeCategoryObj.id,
      subcategory:
        type === 'transfer'
          ? isEmergencyReserveContribution
            ? 'Emergency Reserve Contribution'
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
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border hm-surface hm-border shadow-2xl sm:max-h-[92vh] sm:rounded-2xl">
        {/* Header */}
        <div className="relative flex items-center justify-center border-b hm-border px-5 py-3 sm:justify-between sm:px-6 sm:py-4">
          <div className="text-center sm:text-left">
            <span className="hidden text-[10px] font-bold uppercase tracking-widest hm-text-muted sm:block">
              Hanakasu Mantri
            </span>
            <h2 className="text-base font-extrabold tracking-tight capitalize">
              {editingTx ? 'Edit Transaction' : 'New transaction'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close transaction window"
            className="absolute right-4 rounded-lg p-1.5 hm-text-muted hover:opacity-100 cursor-pointer sm:static"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-xs sm:space-y-4 sm:p-6">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center gap-2 font-semibold">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. TYPE SWITCHER */}
          <div className="grid grid-cols-3 p-1 rounded-xl border hm-elevated hm-border font-bold">
            {['income', 'expense', 'transfer'].map(t => (
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

          <div className="grid min-w-0 grid-cols-2 items-stretch gap-1.5 sm:flex sm:gap-2">
            <div className="grid min-w-0 grid-cols-2 gap-1.5">
              <CalendarDatePicker
                value={date}
                onChange={setDate}
                ariaLabel="Transaction date"
                compact
                className="h-8 w-full min-w-0 sm:w-36"
              />
              <label className="relative block h-8 w-full min-w-0 text-[11px] hm-text-muted sm:w-36">
                <span className="sr-only">Transaction time</span>
                <Clock
                  size={13}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
                />
                <input
                  type="time"
                  required
                  step="60"
                  value={timeInput}
                  onChange={(event) => setTimeInput(event.target.value)}
                  aria-label="Transaction time"
                  style={{ paddingLeft: '1.7rem', paddingRight: '0.35rem' }}
                  className="hm-input h-8 w-full rounded-lg py-1.5 text-[11px]"
                />
              </label>
            </div>
            <button
              type="submit"
              className="h-8 w-full min-w-0 whitespace-nowrap rounded-lg hm-btn-primary px-2 text-[10px] font-extrabold sm:hidden"
              aria-label={`Save ${type}`}
            >
              {editingTx ? 'Save changes' : `Save ${type}`}
            </button>
          </div>

          {/* 3. PAYING FROM / CREDITED TO TABS WITH AUTHENTIC LOGOS */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider hm-text-muted">
              <span>
                {type === 'income'
                  ? 'Credited To'
                  : type === 'transfer'
                  ? 'Transfer From'
                  : 'Paying From'}
              </span>
              <span className="max-w-[55%] truncate text-right font-semibold normal-case">
                {selectedSourceAccount?.name}
              </span>
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {allowedSourceAccounts.map(acc => {
                const selected = selectedAccountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setAccountId(acc.id);
                      setAccountManuallySelected(true);
                      setErrorMsg('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-left shrink-0 flex items-center gap-2 transition cursor-pointer ${
                      selected
                        ? 'hm-btn-primary border-transparent shadow-sm'
                        : 'hm-elevated hm-border opacity-80 hover:opacity-100'
                    }`}
                  >
                    <BrandLogo brand={acc.brand} name={acc.name} size={20} />
                    <div>
                      <p className="font-bold text-[11px] leading-none">{acc.name}</p>
                      {showAccountBalances && (
                        <p className="font-mono-num text-[9px] opacity-75 mt-0.5">
                          {formatINR(acc.currentBalance, false, true)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. TRANSFER TO TABS */}
          {type === 'transfer' && (
            <div className="space-y-1.5 pt-2 border-t hm-border">
              <label className="text-[10px] font-bold uppercase tracking-wider hm-text-muted flex items-center gap-1.5">
                <ArrowRight size={12} /> Transfer To (Including Emergency Reserve)
              </label>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {allowedDestinationTabs.map(dest => {
                  const selected = selectedToAccountId === dest.id;
                  return (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => {
                        setToAccountId(dest.id);
                        setDestinationManuallySelected(true);
                        setErrorMsg('');
                      }}
                      className={`px-3 py-2 rounded-xl border text-left shrink-0 flex items-center gap-2.5 transition cursor-pointer ${
                        selected
                          ? 'hm-btn-primary border-transparent shadow-sm'
                          : 'hm-elevated hm-border opacity-80 hover:opacity-100'
                      }`}
                    >
                      <BrandLogo brand={dest.brand} name={dest.name} size={24} />
                      <div>
                        <p className="font-bold text-xs leading-none">{dest.name}</p>
                        {showAccountBalances && (
                          <p className="font-mono-num text-[10px] opacity-75 mt-1">
                            {formatINR(dest.currentBalance, false, true)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. AMOUNT & SHORT NARRATIVE */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="mb-1 block text-center text-[10px] font-bold uppercase tracking-wider hm-text-muted sm:text-left">
                Amount (numbers or math)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(event) =>
                  setAmountInput(event.target.value.replace(/[^0-9.+\-*/×÷xX()]/g, ''))
                }
                aria-label="Amount or arithmetic expression"
                placeholder="0"
                className="hm-input font-mono-num w-full rounded-xl px-3.5 py-3 text-center text-3xl font-extrabold outline-none sm:py-2.5 sm:text-left sm:text-lg"
              />
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short note"
                aria-label="Short note"
                className="w-full border-0 bg-transparent px-0 py-0.5 text-center text-xs font-semibold leading-5 outline-none placeholder:opacity-60 sm:hidden"
              />
              {/[+\-×÷xX*/]/.test(amountInput) && (
                <span className="mt-1 block text-center text-[11px] hm-text-muted sm:text-left">
                  = <strong>{formatINR(evaluatedAmount, false, true)}</strong>
                </span>
              )}
            </div>

            <div className="hidden sm:col-span-7 sm:block">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider hm-text-muted">
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

          {/* 6. CATEGORY & SUBCATEGORY CHIPS */}
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
                          setSubcategory('');
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

          {!editingTx && (
            <div className="space-y-1.5 rounded-xl border p-3 hm-elevated hm-border">
              <label className="block text-[10px] font-bold uppercase tracking-wider hm-text-muted">
                Quick entry
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={magicInput}
                  onChange={(event) => handleMagicBarChange(event.target.value)}
                  placeholder='e.g. "₹180 cravings from Union at 8:30 pm"'
                  className="hm-input min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-medium outline-none"
                  aria-label="Describe transaction for quick entry"
                />
                <button
                  type="submit"
                  aria-label={`Save ${type}`}
                  title={`Save ${type}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hm-btn-primary cursor-pointer sm:hidden"
                >
                  <Check size={17} />
                </button>
              </div>
              {magicParsed?.accountAmbiguous && !accountManuallySelected && (
                <p className="text-[10px] font-semibold text-amber-500" role="alert">
                  More than one account matches. Select the correct Paying From account before saving.
                </p>
              )}
              {magicParsed?.destinationAmbiguous && !destinationManuallySelected && (
                <p className="text-[10px] font-semibold text-amber-500" role="alert">
                  More than one destination matches. Choose the correct Transfer To account.
                </p>
              )}
              {magicParsed?.accountExplicit &&
                magicParsed.accountId === selectedAccountId &&
                !accountManuallySelected && (
                  <p className="truncate text-[10px] hm-text-muted" aria-live="polite">
                    Matched account: {selectedSourceAccount?.name}
                  </p>
                )}
              {!magicParsed?.accountAmbiguous && magicParsed?.categoryId && type !== 'transfer' && (
                <p className="truncate text-[10px] hm-text-muted" aria-live="polite">
                  Matched category: {activeCategoryObj?.name}
                  {magicParsed.subcategory ? ` · ${magicParsed.subcategory}` : ''}
                </p>
              )}
            </div>
          )}

          {/* 7. SUBMIT */}
          <div className="hidden justify-end border-t hm-border pt-3 sm:flex">
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