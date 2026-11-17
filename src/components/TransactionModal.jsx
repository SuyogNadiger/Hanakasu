import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Clock, Plus, ArrowRight, AlertCircle, Sparkles, Check
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
import { auth } from '../firebase';

function toTimeInputValue(value) {
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(value || '');
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toLowerCase() === 'pm') hour += 12;
    return `${String(hour).padStart(2, '0')}:${twelveHour[2]}`;
  }
  const twentyFourHour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '');
  return twentyFourHour ? `${twentyFourHour[1]}:${twentyFourHour[2]}` : '';
}

function toStoredTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '');
  if (!match) return getCurrentTimeStr();
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'pm' : 'am'}`;
}

function isDescriptionImprovement(candidate, current) {
  const candidateWords = String(candidate || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
  const currentWords = String(current || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
  if (!candidateWords.length) return false;
  if (!currentWords.length) return true;
  if (/^(expense|income|transaction|payment|purchase|transfer)$/.test(candidateWords.join(' '))) {
    return false;
  }
  return candidateWords.length > currentWords.length &&
    currentWords.every((word) => candidateWords.includes(word));
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSave,
  onAddSubcategory,
  computedAccounts,
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
  const [time, setTime] = useState(() => editingTx?.time || getCurrentTimeStr());
  const [accountId, setAccountId] = useState(() => editingTx?.accountId || computedAccounts.find(acc => acc.type !== 'credit')?.id || '');
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
  const [aiStatus, setAiStatus] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [geminiUnavailable, setGeminiUnavailable] = useState(false);
  const [accountManuallySelected, setAccountManuallySelected] = useState(false);
  const [destinationManuallySelected, setDestinationManuallySelected] = useState(false);

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
    () => smartParseMagicInput(magicInput, categories, computedAccounts),
    [magicInput, categories, computedAccounts],
  );

  // Apply deterministic account matches before asynchronous Gemini suggestions.
  const handleMagicBarChange = (val) => {
    setMagicInput(val);
    setAiPending(!geminiUnavailable && val.trim().length >= 4);
    setAccountManuallySelected(false);
    setDestinationManuallySelected(false);
    setAiStatus(geminiUnavailable
      ? 'Gemini is not configured on the server. Local suggestions are active; add GEMINI_API_KEY to enable AI parsing.'
      : '');
    const parsed = smartParseMagicInput(val, categories, computedAccounts);
    if (parsed) {
      if (parsed.type) setType(parsed.type);
      if (parsed.amount !== undefined) setAmountInput(String(parsed.amount));
      if (parsed.accountExplicit && parsed.accountId) setAccountId(parsed.accountId);
      setToAccountId(parsed.type === 'transfer' ? parsed.toAccountId || '' : '');
      if (parsed.categoryId) setCategoryId(parsed.categoryId);
      if (parsed.subcategory !== undefined) setSubcategory(parsed.subcategory);
      const localDescription = magicParsed?.description?.trim() || '';
      if (isDescriptionImprovement(parsed.description, localDescription)) {
        setDescription((current) => {
          const currentDescription = current.trim();
          return currentDescription && currentDescription !== localDescription
            ? current
            : parsed.description.trim();
        });
      }
      if (parsed.date) setDate(parsed.date);
      if (parsed.time) setTime(parsed.time);
    }
  };

  useEffect(() => {
    const text = magicInput.trim();
    if (!isOpen || editingTx || geminiUnavailable || text.length < 4) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAiStatus('Interpreting with Gemini…');
      try {
        const idToken = await auth?.currentUser?.getIdToken();
        if (!idToken) throw new Error('Sign in again to use Gemini suggestions.');
        const response = await fetch('/api/parse-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            text,
            today: getTodayISO(),
            categories,
            accounts: [
              {
                id: 'emergency_reserve',
                name: emergencyReserve.name || 'Emergency Reserve',
                type: 'emergency_reserve',
              },
              ...computedAccounts,
            ]
          })
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 503 && /not configured/i.test(result.error || '')) {
            setGeminiUnavailable(true);
            setAiPending(false);
            setAiStatus('Gemini is not configured on the server. Local suggestions are active; add GEMINI_API_KEY to enable AI parsing.');
            return;
          }
          throw new Error(result.error || 'Gemini transaction parsing failed.');
        }
        if (controller.signal.aborted) return;

        const parsed = result.suggestion || {};
        if (parsed.type) setType(parsed.type);
        if (parsed.amount !== undefined) setAmountInput(String(parsed.amount));
        if (parsed.categoryId) setCategoryId(parsed.categoryId);
        if (parsed.subcategory !== undefined) setSubcategory(parsed.subcategory);
        if (parsed.description !== undefined) setDescription(parsed.description);
        if (parsed.date) setDate(parsed.date);
        if (parsed.time) setTime(parsed.time);
        setAiPending(false);
        setAiStatus(
          Object.keys(parsed).length
            ? 'Gemini suggestions applied. Review before saving.'
            : 'Gemini could not identify transaction details. Local suggestions remain available.'
        );
      } catch (error) {
        if (error.name === 'AbortError') return;
        setAiPending(false);
        setAiStatus(`Gemini suggestions failed: ${error.message} Local suggestions remain available.`);
      }
    }, 650);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [magicInput, isOpen, editingTx, categories, computedAccounts, emergencyReserve, geminiUnavailable, magicParsed]);

  if (!isOpen) return null;

  const evaluatedAmount = evaluateMathExpression(amountInput);

  const handleClose = () => {
    setAiPending(false);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (aiPending) {
      setErrorMsg('Wait for transaction details to finish checking before saving.');
      return;
    }

    if (magicParsed?.accountAmbiguous && !accountManuallySelected) {
      setErrorMsg('More than one account matches the prompt. Select the correct Paying From account.');
      return;
    }

    if (magicParsed?.destinationAmbiguous && !destinationManuallySelected) {
      setErrorMsg('More than one destination account matches the prompt. Select the correct destination.');
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
      time,
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

          {/* SMART MAGIC BAR (Point 9: Restored!) */}
          {!editingTx && (
            <div className="p-3 rounded-xl border hm-elevated hm-border space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hm-text-muted">
                <Sparkles size={12} /> Describe the transaction
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={magicInput}
                  onChange={(e) => handleMagicBarChange(e.target.value)}
                  placeholder='e.g. "₹180 cravings from Union at 8:30 pm"'
                  className="hm-input min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-medium outline-none"
                />
                <button
                  type="submit"
                  aria-label="Save transaction"
                  title="Save transaction"
                  disabled={aiPending}
                  className="sm:hidden h-9 w-9 shrink-0 rounded-lg hm-btn-primary flex items-center justify-center cursor-pointer disabled:cursor-wait disabled:opacity-50"
                >
                  <Check size={18} strokeWidth={2.75} />
                </button>
              </div>
              {magicParsed?.accountAmbiguous && !accountManuallySelected && (
                <p className="text-[10px] font-semibold text-amber-500" role="alert">
                  More than one account matches. Select the correct Paying From account before saving.
                </p>
              )}
              {magicParsed?.accountExplicit &&
                magicParsed.accountId === selectedAccountId &&
                !accountManuallySelected && (
                  <p className="truncate text-[10px] hm-text-muted" aria-live="polite">
                    Account recognized: {selectedSourceAccount?.name}
                  </p>
                )}
              {aiPending && !aiStatus && (
                <p className="text-[10px] hm-text-muted" aria-live="polite">
                  Checking the transaction details…
                </p>
              )}
              {aiStatus && (
                <p className="text-[10px] hm-text-muted" aria-live="polite">
                  {aiStatus}
                </p>
              )}
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

          <div className="flex items-center justify-between gap-2">
            <CalendarDatePicker
              value={date}
              onChange={setDate}
              ariaLabel="Transaction date"
              compact
              className="w-36"
            />
            <label className="flex items-center gap-1 text-[11px] hm-text-muted">
              <Clock size={13} />
              <span className="sr-only">Transaction time</span>
              <input
                type="time"
                required
                value={toTimeInputValue(time)}
                onChange={(event) => setTime(toStoredTime(event.target.value))}
                aria-label="Transaction time"
                className="hm-input w-[6.25rem] rounded-lg px-1.5 py-1.5 text-[11px]"
              />
            </label>
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
              {/[+\-×÷xX*/]/.test(amountInput) && (
                <span className="mt-1 block text-center text-[11px] hm-text-muted sm:text-left">
                  = <strong>{formatINR(evaluatedAmount, false, true)}</strong>
                </span>
              )}
            </div>

            <div className="sm:col-span-7">
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

          {/* 7. SUBMIT */}
          <div className="hidden justify-end border-t hm-border pt-3 sm:flex">
            <button
              type="submit"
              disabled={aiPending}
              className="px-6 py-2.5 rounded-xl hm-btn-primary font-extrabold text-xs uppercase tracking-wider cursor-pointer disabled:cursor-wait disabled:opacity-50"
            >
              {editingTx ? 'Save Changes' : `Save ${type}`}
            </button>
          </div>
          <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end border-t hm-border hm-surface p-3 sm:hidden">
            <button
              type="submit"
              disabled={aiPending}
              className="w-full rounded-xl hm-btn-primary px-6 py-3 font-extrabold text-xs uppercase tracking-wider cursor-pointer disabled:cursor-wait disabled:opacity-50"
            >
              {editingTx ? 'Save Changes' : `Save ${type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}