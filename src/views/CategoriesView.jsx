import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, LoaderCircle, Sparkles } from 'lucide-react';
import { auth } from '../firebase';
import { formatINR } from '../engine/financeEngine';

const EMPTY_TRANSACTIONS = [];

function getRecentMonthKeys(selectedMonth) {
  const [year, month] = selectedMonth.split('-').map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 6 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

function sumTransactions(transactions, type) {
  return transactions
    .filter(transaction => transaction.type === type)
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
}

function summarizeCategories(transactions, type, categories) {
  const knownCategories = new Map(categories.map(category => [category.id, category]));
  const grouped = new Map();
  transactions
    .filter(transaction => transaction.type === type)
    .forEach(transaction => {
      const category = knownCategories.get(transaction.categoryId);
      const key = category?.id || 'uncategorized';
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: category?.name || 'Uncategorized',
          color: category?.color || '#64748B',
          icon: category?.icon || '•',
          total: 0,
          subcategories: new Map(),
        });
      }
      const group = grouped.get(key);
      const amount = Number(transaction.amount) || 0;
      const subcategory = transaction.subcategory || 'No subcategory';
      group.total += amount;
      group.subcategories.set(
        subcategory,
        (group.subcategories.get(subcategory) || 0) + amount,
      );
    });

  return [...grouped.values()]
    .map(group => ({
      ...group,
      subcategories: [...group.subcategories.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.total - a.total);
}

function buildAdvisorSummary(transactions, categories, selectedMonth) {
  const knownCategories = new Map(categories.map(category => [category.id, category]));
  const months = getRecentMonthKeys(selectedMonth).map(month => {
    const monthTransactions = transactions.filter(
      transaction => transaction.date?.slice(0, 7) === month,
    );
    const categoryTotals = (type) => {
      const totals = new Map();
      monthTransactions
        .filter(transaction => transaction.type === type)
        .forEach(transaction => {
          const label = knownCategories.get(transaction.categoryId)?.name || 'Uncategorized';
          totals.set(label, (totals.get(label) || 0) + (Number(transaction.amount) || 0));
        });
      return [...totals.entries()]
        .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20);
    };

    return {
      month,
      income: Number(sumTransactions(monthTransactions, 'income').toFixed(2)),
      expenses: Number(sumTransactions(monthTransactions, 'expense').toFixed(2)),
      incomeByCategory: categoryTotals('income'),
      expensesByCategory: categoryTotals('expense'),
    };
  });

  return { selectedMonth, months };
}

function BreakdownSection({ title, icon, color, groups, total, hideBalances }) {
  const peak = Math.max(1, ...groups.map(group => group.total));
  const Icon = icon;

  return (
    <section className="space-y-4 rounded-2xl border hm-surface hm-border p-5">
      <div className="flex items-start justify-between gap-3 border-b hm-border pb-3">
        <div className="flex items-center gap-2.5">
          <Icon size={18} className={color} />
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider">{title}</h2>
            <p className="text-[11px] hm-text-muted">{groups.length} categories</p>
          </div>
        </div>
        <span className={`font-mono-num text-lg font-extrabold ${color}`}>
          {formatINR(total, hideBalances, true)}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="py-5 text-xs hm-text-muted">No {title.toLowerCase()} recorded for this month.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <details key={group.id} className="group">
              <summary className="list-none cursor-pointer">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-bold">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                      style={{ backgroundColor: `${group.color}25`, color: group.color }}
                    >
                      {group.icon}
                    </span>
                    <span className="truncate">{group.name}</span>
                  </span>
                  <span className="font-mono-num font-bold">
                    {formatINR(group.total, hideBalances)}
                  </span>
                </div>
                <div className="ml-9 mt-2 h-1.5 overflow-hidden rounded-full hm-elevated">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (group.total / peak) * 100)}%`, backgroundColor: group.color }}
                  />
                </div>
              </summary>
              <div className="ml-9 mt-2 space-y-1 border-l hm-border pl-3">
                {group.subcategories.map(subcategory => (
                  <div key={subcategory.name} className="flex items-center justify-between gap-3 py-1 text-[11px] hm-text-muted">
                    <span className="truncate">{subcategory.name}</span>
                    <span className="font-mono-num">{formatINR(subcategory.amount, hideBalances)}</span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CategoriesView({ data, selectedMonth, hideBalances }) {
  const [advisorBusy, setAdvisorBusy] = useState(false);
  const [advisorError, setAdvisorError] = useState('');
  const [advisorResult, setAdvisorResult] = useState(null);
  const transactions = data.transactions || EMPTY_TRANSACTIONS;
  const monthTransactions = useMemo(
    () => transactions.filter(transaction => transaction.date?.slice(0, 7) === selectedMonth),
    [transactions, selectedMonth],
  );
  const expenseGroups = useMemo(
    () => summarizeCategories(monthTransactions, 'expense', data.categories || []),
    [monthTransactions, data.categories],
  );
  const incomeGroups = useMemo(
    () => summarizeCategories(monthTransactions, 'income', data.categories || []),
    [monthTransactions, data.categories],
  );
  const monthlyIncome = sumTransactions(monthTransactions, 'income');
  const monthlyExpenses = sumTransactions(monthTransactions, 'expense');
  const otherActivity = monthTransactions.filter(
    transaction => !['income', 'expense'].includes(transaction.type),
  );
  const transferTotal = otherActivity
    .filter(transaction => transaction.type === 'transfer')
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const cardPaymentsTotal = otherActivity
    .filter(transaction => transaction.type === 'cc_bill_payment')
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const savingsTotal = otherActivity
    .filter(transaction => ['goal_contrib', 'investment_contrib'].includes(transaction.type))
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);

  const handleAdvisorRequest = async () => {
    setAdvisorBusy(true);
    setAdvisorError('');
    setAdvisorResult(null);
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error('Sign in again before requesting an analysis.');
      const response = await fetch('/api/financial-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(buildAdvisorSummary(transactions, data.categories || [], selectedMonth)),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 503 && /not configured/i.test(result.error || '')) {
          throw new Error('Gemini is not configured on the server. Add GEMINI_API_KEY to enable AI analysis.');
        }
        if (response.status === 503) {
          throw new Error('Gemini is temporarily busy. Your category summaries are still available; please try insights again shortly.');
        }
        throw new Error(result.error || 'Financial analysis failed.');
      }
      setAdvisorResult(result);
    } catch (error) {
      setAdvisorError(error.message || 'Financial analysis failed. Please try again.');
    } finally {
      setAdvisorBusy(false);
    }
  };

  const monthLabel = new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-7">
      <section>
        <h1 className="text-xl font-extrabold tracking-tight">Categories</h1>
        <p className="mt-1 text-xs hm-text-muted">Spending, income, and category details for {monthLabel}.</p>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border hm-surface hm-border p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider hm-text-muted">
            <ArrowDownRight size={13} className="text-rose-500" /> Expenses
          </span>
          <strong className="mt-2 block font-mono-num text-xl text-rose-500">
            {formatINR(monthlyExpenses, hideBalances, true)}
          </strong>
        </div>
        <div className="rounded-2xl border hm-surface hm-border p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider hm-text-muted">
            <ArrowUpRight size={13} className="text-emerald-500" /> Income
          </span>
          <strong className="mt-2 block font-mono-num text-xl text-emerald-500">
            {formatINR(monthlyIncome, hideBalances, true)}
          </strong>
        </div>
        <div className="rounded-2xl border hm-surface hm-border p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider hm-text-muted">
            <ArrowLeftRight size={13} className="hm-text-muted" /> Net flow
          </span>
          <strong className={`mt-2 block font-mono-num text-xl ${monthlyIncome - monthlyExpenses >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {formatINR(monthlyIncome - monthlyExpenses, hideBalances, true)}
          </strong>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BreakdownSection
          title="Spending"
          icon={ArrowDownRight}
          color="text-rose-500"
          groups={expenseGroups}
          total={monthlyExpenses}
          hideBalances={hideBalances}
        />
        <BreakdownSection
          title="Income"
          icon={ArrowUpRight}
          color="text-emerald-500"
          groups={incomeGroups}
          total={monthlyIncome}
          hideBalances={hideBalances}
        />
      </section>

      <section className="rounded-2xl border hm-surface hm-border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider">Other money movements</h2>
            <p className="mt-1 text-[11px] hm-text-muted">Transfers and savings contributions, shown separately from income and expenses.</p>
          </div>
          <div className="flex gap-5 text-xs">
            <span>Transfers <strong className="ml-1 font-mono-num">{formatINR(transferTotal, hideBalances)}</strong></span>
            <span>Savings <strong className="ml-1 font-mono-num">{formatINR(savingsTotal, hideBalances)}</strong></span>
            <span>Card payments <strong className="ml-1 font-mono-num">{formatINR(cardPaymentsTotal, hideBalances)}</strong></span>
          </div>
        </div>
        {otherActivity.length > 0 && (
          <p className="mt-3 text-[11px] hm-text-muted">{otherActivity.length} other transaction{otherActivity.length === 1 ? '' : 's'} this month. Transfers are not treated as spending.</p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border hm-surface hm-border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
              <Sparkles size={16} /> AI financial insights
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] hm-text-muted">
              Gemini receives only six months of category totals and cash-flow totals when you request an analysis—not transaction descriptions, account names, or IDs.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdvisorRequest}
            disabled={advisorBusy}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl hm-btn-primary px-4 py-2.5 text-xs font-bold cursor-pointer disabled:cursor-wait disabled:opacity-60"
          >
            {advisorBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {advisorBusy ? 'Analyzing…' : 'Analyze my finances'}
          </button>
        </div>
        {advisorError && <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">{advisorError}</p>}
        {advisorResult && (
          <div className="space-y-3 border-t hm-border pt-4 text-xs">
            <p className="font-semibold">{advisorResult.summary}</p>
            {advisorResult.observations?.length > 0 && (
              <div>
                <h3 className="mb-1 font-bold">Observations</h3>
                <ul className="list-inside list-disc space-y-1 hm-text-muted">
                  {advisorResult.observations.map((item, index) => <li key={`observation-${index}`}>{item}</li>)}
                </ul>
              </div>
            )}
            {advisorResult.actions?.length > 0 && (
              <div>
                <h3 className="mb-1 font-bold">Practical next steps</h3>
                <ul className="list-inside list-disc space-y-1 hm-text-muted">
                  {advisorResult.actions.map((item, index) => <li key={`action-${index}`}>{item}</li>)}
                </ul>
              </div>
            )}
            <p className="border-t hm-border pt-3 text-[10px] hm-text-muted">
              AI-generated educational guidance, not regulated financial, tax, or investment advice. Verify the figures and use your judgment.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
