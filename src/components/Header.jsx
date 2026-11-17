import React, { useState } from 'react';
import {
  Eye, EyeOff, Sun, Moon, Bell, Plus, Calendar,
  ShieldCheck, SlidersHorizontal, UserCheck, X, Cloud, RefreshCw,
  AlertCircle, LogOut
} from 'lucide-react';
import CalendarDatePicker from './CalendarDatePicker';
import { getCurrentMonthKey } from '../engine/financeEngine';

export default function Header({
  selectedMonth,
  setSelectedMonth,
  hideBalances,
  onToggleHide,
  theme,
  onToggleTheme,
  profile,
  alertCount,
  syncStatus,
  syncError,
  onManualCloudSync,
  onSignOut,
  onOpenQuickAdd,
  onNavigate
}) {
  const [mobileTrayOpen, setMobileTrayOpen] = useState(false);
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-20 border-b hm-surface hm-border backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-2">
        {/* Left: Clickable Brand Emblem (Redirects to Home) + Month Selector */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            title="Go to Home Page"
            className="lg:hidden flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg hm-btn-primary font-black text-xs flex items-center justify-center group-hover:scale-105 transition">
              HM
            </div>
            <span className="text-xs font-extrabold uppercase tracking-tight group-hover:underline">
              Hanakasu Mantri
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
            <Calendar size={13} className="hm-text-muted" />
            <CalendarDatePicker
              mode="month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              maxValue={getCurrentMonthKey()}
              ariaLabel="Selected reporting month"
              className="w-36"
            />
          </div>
        </div>

        {/* Right: Desktop Controls + Mobile Collapsible Menu Button */}
        <div className="flex items-center gap-2">
          {/* Cloud Sync Indicator / Button */}
          <button
            type="button"
            onClick={onManualCloudSync}
            title={syncStatus === 'error'
              ? `Cloud sync failed: ${syncError || 'Click to retry'}`
              : `Cloud Sync: ${syncStatus === 'syncing' ? 'Syncing...' : 'Synced across devices (Click to refresh)'}`}
            className="p-2 rounded-xl border hm-elevated hm-border flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
          >
            {syncStatus === 'syncing' ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : syncStatus === 'error' ? (
              <AlertCircle size={14} className="text-rose-500" />
            ) : (
              <Cloud size={14} className={syncStatus === 'synced' ? 'text-emerald-500' : 'hm-text-muted'} />
            )}
            <span className="hidden md:inline">
              {syncStatus === 'syncing'
                ? 'Syncing'
                : syncStatus === 'error'
                  ? 'Sync failed'
                  : 'Synced'}
            </span>
          </button>

          <button
            onClick={onOpenQuickAdd}
            className="px-3.5 py-2 rounded-xl hm-btn-primary font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Entry</span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={onToggleHide}
              title={hideBalances ? 'Show Balances' : 'Hide Balances'}
              className="p-2 rounded-xl border hm-elevated hm-border cursor-pointer"
            >
              {hideBalances ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>

            <button
              onClick={onToggleTheme}
              title="Switch Dark / Light Mode"
              className="p-2 rounded-xl border hm-elevated hm-border cursor-pointer"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              onClick={() => onNavigate('autopay')}
              title="Autopay & Alerts"
              className="relative p-2 rounded-xl border hm-elevated hm-border cursor-pointer"
            >
              <Bell size={15} />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onNavigate('profile')}
              title="Profile & Verification"
              className="px-3 py-1.5 rounded-xl border hm-elevated hm-border font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>{profile?.name || 'Suyog'}</span>
              {profile?.emailVerified && (
                <ShieldCheck size={13} className="text-emerald-500" />
              )}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 rounded-xl border hm-elevated hm-border cursor-pointer"
            >
              <LogOut size={15} />
            </button>
          </div>

          <button
            onClick={() => setMobileTrayOpen(!mobileTrayOpen)}
            className="sm:hidden p-2 rounded-xl border hm-elevated hm-border cursor-pointer relative"
            title="Header Tools"
          >
            {mobileTrayOpen ? <X size={16} /> : <SlidersHorizontal size={16} />}
            {alertCount > 0 && !mobileTrayOpen && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-600" />
            )}
          </button>
        </div>
      </div>

      {mobileTrayOpen && (
        <div className="sm:hidden px-4 py-3 border-t hm-border hm-elevated space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold hm-text-muted">Active Month</span>
            <CalendarDatePicker
              mode="month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              maxValue={getCurrentMonthKey()}
              ariaLabel="Selected reporting month"
              className="w-36"
            />
          </div>

          <div className="grid grid-cols-5 gap-2 pt-1">
            <button
              onClick={() => {
                onToggleHide();
                setMobileTrayOpen(false);
              }}
              className="py-2 rounded-xl border hm-border flex flex-col items-center gap-1 font-semibold"
            >
              {hideBalances ? <EyeOff size={15} /> : <Eye size={15} />}
              <span className="text-[10px]">{hideBalances ? 'Show ₹' : 'Hide ₹'}</span>
            </button>

            <button
              onClick={() => {
                onToggleTheme();
                setMobileTrayOpen(false);
              }}
              className="py-2 rounded-xl border hm-border flex flex-col items-center gap-1 font-semibold"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              <span className="text-[10px]">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            <button
              onClick={() => {
                onNavigate('autopay');
                setMobileTrayOpen(false);
              }}
              className="py-2 rounded-xl border hm-border flex flex-col items-center gap-1 font-semibold"
            >
              <Bell size={15} />
              <span className="text-[10px]">Alerts ({alertCount})</span>
            </button>

            <button
              onClick={() => {
                onNavigate('profile');
                setMobileTrayOpen(false);
              }}
              className="py-2 rounded-xl border hm-border flex flex-col items-center gap-1 font-semibold"
            >
              <UserCheck size={15} />
              <span className="text-[10px]">Profile</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="py-2 rounded-xl border hm-border flex flex-col items-center gap-1 font-semibold"
            >
              <LogOut size={15} />
              <span className="text-[10px]">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}