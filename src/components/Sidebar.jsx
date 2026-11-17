import React, { useState } from 'react';
import {
  LayoutGrid, ArrowLeftRight, Landmark, Target, PieChart,
  Briefcase, BellRing, UserCheck, Plus, Menu, X
} from 'lucide-react';

export function BrandLogo({ brand, name = '', size = 28 }) {
  const key = (brand || '').toLowerCase();
  const label = (name || '').toLowerCase();

  // 1. HDFC MONEYBACK+ CREDIT CARD
  if (key === 'hdfc_cc' || label.includes('moneyback') || (label.includes('hdfc') && label.includes('card'))) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
        <rect x="2" y="6" width="36" height="28" rx="5" fill="#004C8F" stroke="#ED232A" strokeWidth="1.5" />
        <path d="M2 11C2 8.23858 4.23858 6 7 6H33C35.7614 6 38 8.23858 38 11V13H2V11Z" fill="#ED232A" />
        <rect x="6" y="17" width="9" height="7" rx="1.5" fill="#FBBF24" />
        <line x1="6" y1="20.5" x2="15" y2="20.5" stroke="#92400E" strokeWidth="0.8" />
        <line x1="10.5" y1="17" x2="10.5" y2="24" stroke="#92400E" strokeWidth="0.8" />
        <rect x="27" y="16" width="7" height="7" fill="#ED232A" rx="1" />
        <rect x="28.5" y="17.5" width="4" height="4" fill="#FFFFFF" />
        <rect x="29.5" y="18.5" width="2" height="2" fill="#004C8F" />
        <circle cx="8" cy="29" r="1" fill="#E2E8F0" />
        <circle cx="11.5" cy="29" r="1" fill="#E2E8F0" />
        <circle cx="15" cy="29" r="1" fill="#E2E8F0" />
        <text x="24" y="31" fill="#FFFFFF" fontSize="6.5" fontWeight="800" fontFamily="sans-serif">M+</text>
      </svg>
    );
  }

  // 2. STATE BANK OF INDIA
  if (key.includes('sbi') || label.includes('sbi')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-full shadow-xs">
        <circle cx="20" cy="20" r="20" fill="#00A9E0" />
        <circle cx="20" cy="15.5" r="5" fill="#FFFFFF" />
        <rect x="18.2" y="19" width="3.6" height="21" fill="#FFFFFF" />
      </svg>
    );
  }

  // 3. HDFC BANK
  if (key.includes('hdfc') || label.includes('hdfc')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
        <rect width="40" height="40" rx="8" fill="#ED232A" />
        <rect x="7" y="7" width="26" height="26" fill="#FFFFFF" />
        <rect x="18" y="0" width="4" height="40" fill="#FFFFFF" />
        <rect x="0" y="18" width="40" height="4" fill="#FFFFFF" />
        <rect x="12" y="12" width="16" height="16" fill="#004C8F" />
      </svg>
    );
  }

  // 4. UNION BANK OF INDIA
  if (key.includes('union') || label.includes('union')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
        <rect width="40" height="40" rx="8" fill="#1B365D" />
        <path
          d="M11 10V23C11 27.97 15.03 32 20 32C24.97 32 29 27.97 29 23V10H24V23C24 25.2 22.2 27 20 27C17.8 27 16 25.2 16 23V10H11Z"
          fill="#E31837"
        />
        <circle cx="20" cy="15" r="3" fill="#00AEEF" />
      </svg>
    );
  }

  // 5. IDFC FIRST BANK
  if (key.includes('idfc') || label.includes('idfc')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
        <rect width="40" height="40" rx="8" fill="#9D1D27" />
        <rect x="11" y="10" width="4.5" height="20" rx="1" fill="#FFFFFF" />
        <rect x="19" y="10" width="10" height="4.5" rx="1" fill="#FFFFFF" />
        <rect x="19" y="17.8" width="8" height="4.2" rx="1" fill="#FFFFFF" />
      </svg>
    );
  }

  // 6. PARAG PARIKH FLEXI CAP
  if (key.includes('ppfas') || label.includes('parag')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
        <rect width="40" height="40" rx="8" fill="#0D5C3A" />
        <circle cx="20" cy="20" r="11" fill="#D4AF37" />
        <path d="M15 20L19 24L26 16" stroke="#0D5C3A" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  // 7. BANDHAN MUTUAL FUND
  if (key.includes('bandhan') || label.includes('bandhan')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
        <rect width="40" height="40" rx="8" fill="#102A43" />
        <path d="M20 8C25 15 28 19 20 32C12 19 15 15 20 8Z" fill="#F59E0B" />
        <circle cx="20" cy="24" r="3.5" fill="#E11D48" />
      </svg>
    );
  }

  // 8. TATA GOLD
  if (key.includes('tata') || label.includes('tata')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
        <rect width="40" height="40" rx="8" fill="#1E40AF" />
        <ellipse cx="20" cy="20" rx="14" ry="10" fill="none" stroke="#FBBF24" strokeWidth="2.2" />
        <rect x="12" y="14" width="16" height="3.2" fill="#FFFFFF" />
        <rect x="18.2" y="14" width="3.6" height="14" fill="#FFFFFF" />
      </svg>
    );
  }

  // 9. LIQUID MF VAULT
  if (key.includes('liquid') || label.includes('liquid')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
        <rect width="40" height="40" rx="8" fill="#412D15" />
        <path d="M20 8L30 13V21C30 27.5 25.5 32.5 20 34C14.5 32.5 10 27.5 10 21V13L20 8Z" fill="#E1DCC9" />
      </svg>
    );
  }

  // 10. CASH WALLET
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-lg shadow-xs">
      <rect width="40" height="40" rx="8" fill="#412D15" />
      <rect x="9" y="12" width="22" height="16" rx="3" fill="#E1DCC9" />
      <circle cx="25" cy="20" r="2.5" fill="#1F150C" />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'transactions', label: 'Ledger', icon: ArrowLeftRight },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'categories', label: 'Categories', icon: PieChart },
  { id: 'reports', label: 'Wealth', icon: Briefcase },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'autopay', label: 'Autopay', icon: BellRing },
  { id: 'profile', label: 'Profile', icon: UserCheck },
];
const MOBILE_PRIMARY_IDS = new Set(['overview', 'transactions', 'categories', 'reports']);

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  alertCount
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const mobilePrimaryItems = NAV_ITEMS.filter(item => MOBILE_PRIMARY_IDS.has(item.id));
  const mobileMoreItems = NAV_ITEMS.filter(item => !MOBILE_PRIMARY_IDS.has(item.id));

  return (
    <>
      <aside className="hidden lg:flex flex-col justify-between w-60 h-screen sticky top-0 shrink-0 border-r hm-surface hm-border px-5 py-7 select-none overflow-y-auto">
        <div className="space-y-7">
          {/* CLICKABLE APP LOGO & NAME -> REDIRECTS TO HOME (OVERVIEW) */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            title="Go to Home Page"
            className="flex items-center gap-3 text-left w-full group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl hm-btn-primary font-black text-sm flex items-center justify-center tracking-tighter group-hover:scale-105 transition">
              HM
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight block leading-none uppercase group-hover:underline">
                ಹಣಕಾಸು ಮಂತ್ರಿ 
              </span>
              <span className="text-[10px] tracking-widest uppercase hm-text-muted mt-1 block">
                Personal Reserve
              </span>
            </div>
          </button>

          <button
            onClick={onOpenQuickAdd}
            className="w-full py-3 px-4 rounded-xl hm-btn-primary font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
          >
            <Plus size={15} strokeWidth={2.5} /> New Entry
          </button>

          <nav className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest hm-text-muted mb-2">
              Workspace
            </p>
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'hm-btn-primary font-bold shadow-xs'
                      : 'hm-text-muted hover:opacity-100 hover:bg-[#412D15]/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'autopay' && alertCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t hm-border text-[11px] hm-text-muted">
          Hanakasu Mantri • Private Ledger
        </div>
      </aside>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t hm-surface hm-border backdrop-blur-xl">
        {moreOpen && (
          <div
            role="menu"
            aria-label="More navigation options"
            className="absolute bottom-full right-2 mb-2 w-52 rounded-2xl border hm-surface hm-border p-2 shadow-2xl"
          >
            {mobileMoreItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMoreOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${
                    activeTab === item.id ? 'hm-btn-primary font-bold' : 'hm-text-muted'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={16} />
                    {item.label}
                  </span>
                  {item.id === 'autopay' && alertCount > 0 && (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-1 py-1.5">
          {mobilePrimaryItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative flex min-w-0 flex-col items-center justify-center py-1 rounded-lg transition cursor-pointer ${
                  active ? 'font-extrabold' : 'hm-text-muted'
                }`}
              >
                <Icon size={17} />
                <span className="text-[9px] mt-0.5 tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen(open => !open)}
            className={`flex min-w-0 flex-col items-center justify-center py-1 rounded-lg transition cursor-pointer ${
              moreOpen || mobileMoreItems.some(item => item.id === activeTab)
                ? 'font-extrabold'
                : 'hm-text-muted'
            }`}
          >
            {moreOpen ? <X size={17} /> : <Menu size={17} />}
            <span className="mt-0.5 text-[9px] tracking-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}