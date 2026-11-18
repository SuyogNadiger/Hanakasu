import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { formatINR } from '../engine/financeEngine';

const EMPTY_TRANSACTIONS = [];

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

function DonutChart({ title, groups, total, hideBalances }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`${title} category breakdown`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="hm-text-muted opacity-15"
        />
        {total > 0 && groups.map((group) => {
          const length = (group.total / total) * circumference;
          const segment = (
            <circle
              key={group.id}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={group.color}
              strokeWidth="12"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return segment;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <span className="text-[9px] font-bold uppercase tracking-wider hm-text-muted">Total</span>
        <strong className="max-w-full truncate font-mono-num text-xs font-extrabold">
          {formatINR(total, hideBalances)}
        </strong>
      </div>
    </div>
  );
}

function BreakdownSection({ title, icon, color, groups, total, hideBalances }) {
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

      <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <DonutChart title={title} groups={groups} total={total} hideBalances={hideBalances} />
        {groups.length === 0 ? (
          <p className="py-5 text-xs hm-text-muted">No {title.toLowerCase()} recorded for this month.</p>
        ) : (
          <div className="space-y-4">
            {groups.map(group => {
              const sharePct = total > 0 ? (group.total / total) * 100 : 0;
              return (
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
                      <span className="shrink-0 text-right">
                        <span className="block font-mono-num font-bold">
                          {formatINR(group.total, hideBalances)}
                        </span>
                        <span className="text-[10px] hm-text-muted">{sharePct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="ml-9 mt-2 h-1.5 overflow-hidden rounded-full hm-elevated">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, sharePct)}%`, backgroundColor: group.color }}
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
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function CategoriesView({ data, selectedMonth, hideBalances }) {
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

    </div>
  );
}
