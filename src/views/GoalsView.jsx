import React, { useState } from 'react';
import {
  Plus, Trash2, Pencil, AlertTriangle, Settings, ChevronDown, ChevronUp,
  TrendingUp, Bell
} from 'lucide-react';
import { formatDateDisplay, formatINR, parseLocalDateISO } from '../engine/financeEngine';
import CalendarDatePicker from '../components/CalendarDatePicker';

export default function GoalsView({
  data,
  finState,
  hideBalances,
  onAddGoal,
  onUpdateGoal,
  onContributeGoal,
  onDeleteGoal,
  onDispatchAlert
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

  // Issue 6: Gear menu state per goal
  const [gearOpenId, setGearOpenId] = useState(null);

  // Issue 6: Reminder modal state
  const [reminderGoalId, setReminderGoalId] = useState(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderAmount, setReminderAmount] = useState('');

  // Issue 6: Analysis modal state
  const [analysisGoalId, setAnalysisGoalId] = useState(null);

  // Issue 6: Mobile collapsible create form
  const hasGoals = data.goals.length > 0;
  const [createFormOpen, setCreateFormOpen] = useState(!hasGoals);

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

  // Issue 6: Analyse monthly contribution needed
  const analyseGoal = (goal) => {
    const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
    if (remaining <= 0) return { monthsLeft: 0, monthlyContribution: 0, message: 'Goal already achieved! 🎉' };

    const targetDateParsed = parseLocalDateISO(goal.targetDate);
    if (!targetDateParsed) return { monthsLeft: 0, monthlyContribution: 0, message: 'No target date set. Set a target date to get monthly contribution analysis.' };

    const now = new Date();
    const monthsLeft = Math.max(1,
      (targetDateParsed.getFullYear() - now.getFullYear()) * 12 +
      (targetDateParsed.getMonth() - now.getMonth())
    );
    const monthlyContribution = Math.ceil(remaining / monthsLeft);

    return {
      monthsLeft,
      monthlyContribution,
      remaining,
      message: `You need to contribute ${formatINR(monthlyContribution)} per month for ${monthsLeft} month${monthsLeft > 1 ? 's' : ''} to reach your goal of ${formatINR(goal.targetAmount)} by ${formatDateDisplay(goal.targetDate)}.`
    };
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

      {/* Issue 6: Collapsible Create Goal Form on mobile */}
      <div>
        {hasGoals && (
          <button
            type="button"
            onClick={() => setCreateFormOpen(!createFormOpen)}
            className="lg:hidden flex items-center gap-2 text-xs font-bold hm-text-muted mb-3 cursor-pointer"
          >
            {createFormOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {createFormOpen ? 'Hide Create Goal' : 'Create New Goal'}
          </button>
        )}
        <div className={`${hasGoals && !createFormOpen ? 'hidden lg:block' : ''}`}>
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
              if (hasGoals) setCreateFormOpen(false);
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
        </div>
      </div>

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

                  {/* Contribute + Gear Menu */}
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
                      <Plus size={14} /> Contribute
                    </button>

                    {/* Issue 6: Gear icon with Edit, Delete, Set Reminder, Analyse */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setGearOpenId(gearOpenId === g.id ? null : g.id)}
                        title="Goal options"
                        className="p-2 rounded-xl border hm-elevated hm-border hm-text-muted hover:opacity-100 cursor-pointer"
                      >
                        <Settings size={14} />
                      </button>
                      {gearOpenId === g.id && (
                        <div
                          role="menu"
                          className="absolute right-0 top-full z-20 mt-1 min-w-48 rounded-xl border hm-surface hm-border p-1.5 shadow-xl"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setGearOpenId(null);
                              setEditingGoalId(g.id);
                              setEditDraft({ ...g });
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:opacity-80 cursor-pointer"
                          >
                            <Pencil size={13} /> Edit Goal
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setGearOpenId(null);
                              setReminderGoalId(g.id);
                              setReminderDate('');
                              setReminderAmount(String(g.targetAmount - g.savedAmount > 0 ? Math.ceil((g.targetAmount - g.savedAmount) / 12) : 0));
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:opacity-80 cursor-pointer"
                          >
                            <Bell size={13} /> Set Reminder
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setGearOpenId(null);
                              setAnalysisGoalId(g.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:opacity-80 cursor-pointer"
                          >
                            <TrendingUp size={13} /> Analyse
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setGearOpenId(null);
                              onDeleteGoal(g.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 size={13} /> Delete Goal
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Issue 6: Reminder Modal */}
      {reminderGoalId && (() => {
        const goal = data.goals.find(g => g.id === reminderGoalId);
        if (!goal) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border hm-surface hm-border p-6 space-y-4 shadow-2xl text-xs">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Bell size={18} /> Set Contribution Reminder
              </h3>
              <p className="hm-text-muted">
                Get an email reminder to contribute towards <strong>{goal.name}</strong>.
              </p>
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase hm-text-muted block">
                  Reminder Date
                  <CalendarDatePicker
                    required
                    value={reminderDate}
                    onChange={setReminderDate}
                    ariaLabel="Reminder date"
                    className="mt-1 w-full"
                  />
                </label>
                <label className="text-[10px] font-bold uppercase hm-text-muted block">
                  Amount to Contribute (₹)
                  <input
                    type="number"
                    min="1"
                    required
                    value={reminderAmount}
                    onChange={(e) => setReminderAmount(e.target.value)}
                    className="hm-input font-mono-num mt-1 w-full rounded-lg px-3 py-2 text-xs"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!reminderDate || !reminderAmount) return;
                    if (onDispatchAlert) {
                      onDispatchAlert(
                        `Goal Contribution Reminder: Please contribute ${formatINR(Number(reminderAmount))} towards "${goal.name}" (Target: ${formatINR(goal.targetAmount)}, Saved: ${formatINR(goal.savedAmount)}). Reminder date: ${formatDateDisplay(reminderDate)}.`,
                        'GOAL CONTRIBUTION REMINDER'
                      );
                    }
                    setReminderGoalId(null);
                  }}
                  disabled={!reminderDate || !reminderAmount}
                  className="flex-1 py-2.5 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Reminder Email
                </button>
                <button
                  type="button"
                  onClick={() => setReminderGoalId(null)}
                  className="px-4 py-2.5 rounded-xl border hm-border font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Issue 6: Analysis Modal */}
      {analysisGoalId && (() => {
        const goal = data.goals.find(g => g.id === analysisGoalId);
        if (!goal) return null;
        const analysis = analyseGoal(goal);
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border hm-surface hm-border p-6 space-y-4 shadow-2xl text-xs">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <TrendingUp size={18} /> Goal Analysis
              </h3>
              <div className="space-y-3">
                <p className="font-bold text-sm">{goal.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border hm-border p-3">
                    <span className="text-[10px] hm-text-muted block">Target</span>
                    <span className="font-mono-num font-extrabold">{formatINR(goal.targetAmount)}</span>
                  </div>
                  <div className="rounded-xl border hm-border p-3">
                    <span className="text-[10px] hm-text-muted block">Saved</span>
                    <span className="font-mono-num font-extrabold">{formatINR(goal.savedAmount)}</span>
                  </div>
                  <div className="rounded-xl border hm-border p-3">
                    <span className="text-[10px] hm-text-muted block">Remaining</span>
                    <span className="font-mono-num font-extrabold">{formatINR(Math.max(0, goal.targetAmount - goal.savedAmount))}</span>
                  </div>
                  {analysis.monthsLeft > 0 && (
                    <div className="rounded-xl border hm-border p-3">
                      <span className="text-[10px] hm-text-muted block">Months Left</span>
                      <span className="font-mono-num font-extrabold">{analysis.monthsLeft}</span>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border hm-border p-4 bg-emerald-500/5">
                  <p className="font-semibold leading-relaxed">{analysis.message}</p>
                  {analysis.monthlyContribution > 0 && (
                    <p className="mt-2 text-lg font-extrabold font-mono-num text-emerald-500">
                      {formatINR(analysis.monthlyContribution)} / month
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnalysisGoalId(null)}
                className="w-full py-2.5 rounded-xl hm-btn-primary font-extrabold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}

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
