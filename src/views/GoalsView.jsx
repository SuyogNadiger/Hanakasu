import React, { useState } from 'react';
import {
  Plus, Trash2, Pencil, AlertTriangle
} from 'lucide-react';
import { formatDateDisplay, formatINR } from '../engine/financeEngine';
import CalendarDatePicker from '../components/CalendarDatePicker';

export default function GoalsView({
  data,
  finState,
  hideBalances,
  onAddGoal,
  onUpdateGoal,
  onContributeGoal,
  onDeleteGoal
}) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [contribMap, setContribMap] = useState({});
  const contributionAccounts = finState.computedAccounts.filter((account) => account.isLiquid);
  const [contributionAccountId, setContributionAccountId] = useState(
    contributionAccounts[0]?.id || '',
  );
  const contributionAccount =
    contributionAccounts.find((account) => account.id === contributionAccountId) ||
    contributionAccounts[0];

  const [shortfallAlert, setShortfallAlert] = useState(null);

  const handleContributeAttempt = (goal) => {
    const amt = parseFloat(contribMap[goal.id]);
    if (!amt || amt <= 0) return;

    if (!contributionAccount || amt > contributionAccount.currentBalance) {
      setShortfallAlert({
        goalName: goal.name,
        requested: amt,
        accountName: contributionAccount?.name || 'available account',
        available: contributionAccount?.currentBalance || 0
      });
      return;
    }

    onContributeGoal(goal.id, amt, contributionAccount.id);
    setContribMap({ ...contribMap, [goal.id]: '' });
  };

  return (
    <div className="space-y-8">
      <div className="border-b hm-border pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest hm-text-muted">
            Savings Goals
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">
            Savings Goals
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label htmlFor="goal-contribution-account" className="hm-text-muted">
            Contribution account:
          </label>
          <select
            id="goal-contribution-account"
            value={contributionAccount?.id || ''}
            onChange={(event) => setContributionAccountId(event.target.value)}
            className="hm-input rounded-lg px-2 py-1.5"
          >
            {contributionAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <strong className="font-mono-num font-extrabold">
            {formatINR(contributionAccount?.currentBalance || 0, hideBalances, true)} available
          </strong>
        </div>
      </div>

      {/* Create Goal Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !targetAmount) return;
          onAddGoal({
            id: 'goal_' + Date.now(),
            name: name.trim(),
            targetAmount: Number(targetAmount),
            savedAmount: 0,
            targetDate
          });
          setName('');
          setTargetAmount('');
          setTargetDate('');
        }}
        className="p-4 rounded-2xl border hm-surface hm-border grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
      >
        <input
          type="text"
          required
          placeholder="Goal Title (e.g. Emergency Reserve)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="hm-input rounded-xl px-3.5 py-2.5 outline-none"
        />
        <input
          type="number"
          required
          placeholder="Target Amount (₹)"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          className="hm-input font-mono-num rounded-xl px-3.5 py-2.5 outline-none"
        />
        <CalendarDatePicker
          value={targetDate}
          onChange={setTargetDate}
          ariaLabel="Goal target date"
          className="w-full"
        />
        <button
          type="submit"
          className="rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider py-2.5 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} /> Create Goal
        </button>
      </form>

      {/* Goals List */}
      <div className="divide-y hm-border border-y">
        {data.goals.map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
          const isEditing = editingGoalId === g.id;

          return (
            <div key={g.id} className="py-6 space-y-4">
              {isEditing ? (
                <div className="p-4 rounded-2xl border hm-surface hm-border grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] hm-text-muted block mb-1">Goal Title</label>
                    <input
                      type="text"
                      value={editDraft.name}
                      onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                      className="hm-input w-full rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] hm-text-muted block mb-1">Saved (₹)</label>
                    <input
                      type="number"
                      value={editDraft.savedAmount}
                      onChange={(e) => setEditDraft({ ...editDraft, savedAmount: Number(e.target.value) })}
                      className="hm-input font-mono-num w-full rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] hm-text-muted block mb-1">Target (₹)</label>
                    <input
                      type="number"
                      value={editDraft.targetAmount}
                      onChange={(e) => setEditDraft({ ...editDraft, targetAmount: Number(e.target.value) })}
                      className="hm-input font-mono-num w-full rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] hm-text-muted block mb-1">Target Date</label>
                    <CalendarDatePicker
                      value={editDraft.targetDate || ''}
                      onChange={(targetDate) => setEditDraft({ ...editDraft, targetDate })}
                      ariaLabel="Goal target date"
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateGoal(g.id, editDraft);
                        setEditingGoalId(null);
                      }}
                      className="flex-1 py-2 rounded-lg hm-btn-primary font-extrabold cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGoalId(null)}
                      className="px-3 py-2 rounded-lg border hm-border cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-lg font-extrabold">{g.name}</h3>
                    <p className="text-xs hm-text-muted font-mono-num">
                      Saved: <strong>{formatINR(g.savedAmount, hideBalances)}</strong> /{' '}
                      <strong>{formatINR(g.targetAmount, hideBalances)}</strong> ({pct}%) • Due:{' '}
                      {formatDateDisplay(g.targetDate) || 'Open'}
                    </p>
                    <div className="w-full max-w-md h-2 rounded-full hm-elevated overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Contribute from the selected account + Pencil Edit + Delete */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input
                      type="number"
                      placeholder="Contribute ₹"
                      value={contribMap[g.id] || ''}
                      onChange={(e) => setContribMap({ ...contribMap, [g.id]: e.target.value })}
                      className="hm-input font-mono-num w-36 rounded-xl px-3 py-2 outline-none"
                    />
                    <button
                      onClick={() => handleContributeAttempt(g)}
                      className="px-3.5 py-2 rounded-xl hm-btn-primary font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} /> + Contribute
                    </button>

                    <button
                      onClick={() => {
                        setEditingGoalId(g.id);
                        setEditDraft({ ...g });
                      }}
                      title="Edit Goal"
                      className="p-2 rounded-xl border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      onClick={() => onDeleteGoal(g.id)}
                      title="Delete Goal"
                      className="p-2 hm-text-muted hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {shortfallAlert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border hm-surface hm-border p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center gap-2.5 text-rose-500">
              <AlertTriangle size={22} />
              <h3 className="text-base font-extrabold">Insufficient Balance</h3>
            </div>
            <p className="hm-text-muted leading-relaxed">
              You tried to contribute{' '}
              <strong className="font-mono-num">{formatINR(shortfallAlert.requested, false, true)}</strong> to{' '}
              <strong>{shortfallAlert.goalName}</strong>, but {shortfallAlert.accountName} has only{' '}
              <strong className="font-mono-num">{formatINR(shortfallAlert.available, false, true)}</strong> available.
            </p>
            <button
              onClick={() => setShortfallAlert(null)}
              className="w-full py-2.5 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}

    </div>
  );
}