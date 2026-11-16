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
    id: 'acc_union',
    name: 'Union Bank',
    nickname: 'Primary UPI',
    brand: 'union',
    type: 'bank',
    openingBalance: 0,
    pinnedOnHome: true,
    includeInTotalBank: true
  },
  {
    id: 'acc_sbi',
    name: 'SBI',
    nickname: 'Savings Account',
    brand: 'sbi',
    type: 'bank',
    openingBalance: 0,
    pinnedOnHome: true,
    includeInTotalBank: true
  },
  {
    id: 'acc_hdfc',
    name: 'HDFC Bank',
    nickname: 'Salary Account',
    brand: 'hdfc',
    type: 'bank',
    openingBalance: 0,
    pinnedOnHome: true,
    includeInTotalBank: true
  },
  {
    id: 'acc_idfc',
    name: 'IDFC First Bank',
    nickname: 'Side Gig Account',
    brand: 'idfc',
    type: 'bank',
    openingBalance: 0,
    pinnedOnHome: false,
    includeInTotalBank: true
  },
  {
    id: 'acc_cc_hdfc',
    name: 'HDFC Moneyback+',
    nickname: 'Credit Card',
    brand: 'hdfc_cc',
    type: 'credit',
    openingBalance: 0,
    creditLimit: 50000,
    alertThresholdPct: 10,
    billDueDay: 5,
    billDueDate: '',
    pinnedOnHome: true,
    includeInTotalBank: false
  },
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

export const DEFAULT_INVESTMENTS = [
  {
    id: 'inv_ppfas',
    name: 'Parag Parikh Flexi Cap Fund',
    brand: 'ppfas',
    type: 'Mutual Fund (SIP)',
    investedAmount: 0,
    sipAmount: 0,
    sipDay: 1,
    accountId: 'acc_sbi'
  },
  {
    id: 'inv_bandhan',
    name: 'Bandhan Small Cap Fund',
    brand: 'bandhan',
    type: 'Mutual Fund (SIP)',
    investedAmount: 0,
    sipAmount: 0,
    sipDay: 1,
    accountId: 'acc_sbi'
  },
  {
    id: 'inv_tatagold',
    name: 'TATA Gold',
    brand: 'tata',
    type: 'Gold ETF / Equity',
    investedAmount: 0,
    sipAmount: 0,
    sipDay: null,
    accountId: 'acc_sbi'
  }
];

export const DEFAULT_AUTOPAY_RULES = [
  {
    id: 'auto_ppfas',
    title: 'Parag Parikh Flexi Cap SIP',
    category: 'SIP',
    amount: 0,
    frequency: 'Monthly',
    deductDate: '2026-12-01',
    deductDay: 1,
    accountId: 'acc_sbi',
    linkedInvestmentId: 'inv_ppfas'
  },
  {
    id: 'auto_bandhan',
    title: 'Bandhan Small Cap SIP',
    category: 'SIP',
    amount: 0,
    frequency: 'Monthly',
    deductDate: '2026-12-01',
    deductDay: 1,
    accountId: 'acc_sbi',
    linkedInvestmentId: 'inv_bandhan'
  }
];

export const DEFAULT_GOALS = [
  {
    id: 'goal_emergency',
    name: 'Emergency Reserve Fund',
    targetAmount: 100000,
    savedAmount: 0,
    targetDate: '2027-06-01'
  }
];

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
    lastCcReminderMonth: '' // Tracks auto-monthly CC due reminder
  },
  liquidMfOpeningBalance: 0,
  accounts: DEFAULT_ACCOUNTS,
  categories: DEFAULT_CATEGORIES,
  transactions: [],
  investments: DEFAULT_INVESTMENTS,
  autopayRules: DEFAULT_AUTOPAY_RULES,
  manualAlerts: [],
  alertLogs: [],
  goals: DEFAULT_GOALS
};