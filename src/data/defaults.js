export const ACCOUNT_TYPES = [
  { id: 'bank', label: 'Bank Account', isLiability: false, isLiquid: true, isBank: true },
  { id: 'cash', label: 'Cash Wallet', isLiability: false, isLiquid: true, isBank: false },
  { id: 'credit', label: 'Credit Card', isLiability: true, isLiquid: false, isBank: false },
];

export const PAYMENT_METHODS = ['UPI / GPay', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash', 'Auto-Debit'];

export const AUTOPAY_FREQUENCIES = ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'];

export const DEFAULT_CATEGORIES = [
  {
    id: 'cat_food',
    name: 'Food & Drinks',
    icon: '🍴',
    type: 'expense',
    color: '#E05A47',
    subcategories: ['Cravings', 'Swiggy / Zomato', 'Dining Out', 'Chai & Coffee', 'Mess / Tiffin'],
    keywords: ['biriyani', 'swiggy', 'zomato', 'food', 'chai', 'tea', 'coffee', 'lunch', 'dinner', 'breakfast', 'snacks', 'dosa', 'pizza', 'cravings']
  },
  {
    id: 'cat_transport',
    name: 'Transport',
    icon: '🚌',
    type: 'expense',
    color: '#2EA8C8',
    subcategories: ['Public', 'Taxi', 'Office transport', 'Petrol / Fuel', 'Train / Bus'],
    keywords: ['auto', 'uber', 'ola', 'rapido', 'bus', 'train', 'petrol', 'fuel', 'taxi', 'metro', 'office']
  },
  {
    id: 'cat_shopping',
    name: 'Shopping',
    icon: '🛍️',
    type: 'expense',
    color: '#D946EF',
    subcategories: ['Apparel', 'Gadgets', 'Amazon / Flipkart', 'Personal Care', 'Gifts'],
    keywords: ['amazon', 'flipkart', 'myntra', 'shirt', 'shoes', 'clothes', 'watch', 'earphones', 'shopping']
  },
  {
    id: 'cat_housing',
    name: 'Housing',
    icon: '🏠',
    type: 'expense',
    color: '#6366F1',
    subcategories: ['Rent / PG', 'Groceries', 'Home purpose', 'Maintenance', 'Utilities'],
    keywords: ['rent', 'pg', 'milk', 'vegetables', 'grocery', 'dmart', 'blinkit', 'zepto', 'home']
  },
  {
    id: 'cat_bills',
    name: 'Bills',
    icon: '🧾',
    type: 'expense',
    color: '#10B981',
    subcategories: ['Mobile Recharge', 'Wi-Fi', 'Electricity', 'Subscriptions', 'Gas / Water'],
    keywords: ['jio', 'airtel', 'recharge', 'wifi', 'electricity', 'netflix', 'spotify', 'bill']
  },
  {
    id: 'cat_leisure',
    name: 'Leisure',
    icon: '✨',
    type: 'expense',
    color: '#EC4899',
    subcategories: ['Entertainment', 'Movies', 'Outings', 'Games', 'Sports'],
    keywords: ['movie', 'party', 'outing', 'game', 'entertainment', 'fun']
  },
  {
    id: 'cat_other',
    name: 'Other',
    icon: '•••',
    type: 'expense',
    color: '#64748B',
    subcategories: ['Needs', 'Home purpose', 'Health & Medicine', 'Family', 'Miscellaneous'],
    keywords: ['water', 'medicine', 'doctor', 'pharmacy', 'hair', 'needs']
  },
  {
    id: 'inc_salary',
    name: 'Salary',
    icon: '💼',
    type: 'income',
    color: '#10B981',
    subcategories: ['Monthly Salary', 'Side Gig', 'Bonus'],
    keywords: ['salary', 'paycheck', 'gig', 'freelance']
  },
  {
    id: 'inc_gifts',
    name: 'Gifts & Returns',
    icon: '🎁',
    type: 'income',
    color: '#8B5CF6',
    subcategories: ['Gifts', 'IPO / Dividends', 'Cashback', 'Refund'],
    keywords: ['gift', 'ipo', 'dividend', 'cashback', 'refund']
  }
];

export const DEFAULT_ACCOUNTS = [
  {
    id: 'acc_cash',
    name: 'Cash Wallet',
    nickname: 'Physical Cash',
    brand: 'cash',
    type: 'cash',
    openingBalance: 0,
    pinnedOnHome: false,
    includeInTotalBank: false
  }
];

export const DEFAULT_INVESTMENTS = [];
export const DEFAULT_AUTOPAY_RULES = [];
export const DEFAULT_GOALS = [];

const LEGACY_PRESET_ACCOUNT_IDS = new Set([
  'acc_union',
  'acc_sbi',
  'acc_hdfc',
  'acc_idfc',
  'acc_cc_hdfc'
]);
const LEGACY_PRESET_INVESTMENT_IDS = new Set([
  'inv_ppfas',
  'inv_bandhan',
  'inv_tatagold'
]);
const LEGACY_PRESET_AUTOPAY_IDS = new Set(['auto_ppfas', 'auto_bandhan']);
const LEGACY_PRESET_GOAL_IDS = new Set(['goal_emergency']);

export function removeLegacyFinancialPresets(data) {
  const accounts = (data.accounts || []).filter(
    (account) => !LEGACY_PRESET_ACCOUNT_IDS.has(account.id),
  );
  if (!accounts.some((account) => account.id === 'acc_cash')) {
    accounts.push({ ...DEFAULT_ACCOUNTS[0] });
  }

  return {
    ...data,
    accounts,
    investments: (data.investments || []).filter(
      (investment) => !LEGACY_PRESET_INVESTMENT_IDS.has(investment.id),
    ),
    autopayRules: (data.autopayRules || []).filter(
      (rule) => !LEGACY_PRESET_AUTOPAY_IDS.has(rule.id),
    ),
    goals: (data.goals || []).filter(
      (goal) => !LEGACY_PRESET_GOAL_IDS.has(goal.id),
    ),
  };
}

export function hasLegacyFinancialPresets(data) {
  return (
    (data.accounts || []).some(
      (account) =>
        LEGACY_PRESET_ACCOUNT_IDS.has(account.id) ||
        account.type === 'liquid_mf',
    ) ||
    (data.investments || []).some((investment) =>
      LEGACY_PRESET_INVESTMENT_IDS.has(investment.id),
    ) ||
    (data.autopayRules || []).some((rule) =>
      LEGACY_PRESET_AUTOPAY_IDS.has(rule.id),
    ) ||
    (data.goals || []).some((goal) => LEGACY_PRESET_GOAL_IDS.has(goal.id))
  );
}

export const INITIAL_APP_DATA = {
  profile: {
    name: 'Suyog',
    email: '',
    emailVerified: false,
    monthlySalary: 0
  },
  settings: {
    theme: 'dark',
    hideBalances: false,
    pinCode: '',
    monthlySpendLimit: 0, // Point 5: Overall Monthly Budget Limit (₹)
    lastCcReminderMonth: '', // Tracks auto-monthly CC due reminder
    homeSavingsExcludedInstrumentIds: [],
    primaryAccountId: 'acc_cash'
  },
  liquidMfOpeningBalance: 0,
  emergencyReserve: {
    name: 'Emergency Reserve',
    sourceAccountId: 'liquid_mf',
    amount: 0
  },
  accounts: DEFAULT_ACCOUNTS,
  categories: DEFAULT_CATEGORIES,
  transactions: [],
  investments: DEFAULT_INVESTMENTS,
  autopayRules: DEFAULT_AUTOPAY_RULES,
  manualAlerts: [],
  alertLogs: [],
  goals: DEFAULT_GOALS
};