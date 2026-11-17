import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_AUTOPAY_RULES,
  DEFAULT_CATEGORIES,
  DEFAULT_GOALS,
  DEFAULT_INVESTMENTS,
  hasLegacyFinancialPresets,
  removeLegacyFinancialPresets,
} from "../data/defaults.js";
import {
  computeFinancialState,
  evaluateMathExpression,
  smartParseMagicInput,
} from "./financeEngine.js";

test("new user defaults keep Cash Wallet and categories without seeded assets", () => {
  assert.deepEqual(DEFAULT_ACCOUNTS.map((account) => account.id), ["acc_cash"]);
  assert.ok(DEFAULT_CATEGORIES.length > 0);
  assert.deepEqual(DEFAULT_INVESTMENTS, []);
  assert.deepEqual(DEFAULT_AUTOPAY_RULES, []);
  assert.deepEqual(DEFAULT_GOALS, []);
});

test("legacy seed cleanup preserves custom accounts and transaction history", () => {
  const transaction = { id: "tx_1", accountId: "acc_sbi", amount: 25 };
  const cleaned = removeLegacyFinancialPresets({
    accounts: [
      { id: "acc_sbi", type: "bank" },
      { id: "acc_custom", type: "bank" },
    ],
    investments: [{ id: "inv_ppfas" }, { id: "inv_custom" }],
    autopayRules: [{ id: "auto_ppfas" }, { id: "auto_custom" }],
    goals: [{ id: "goal_emergency" }, { id: "goal_custom" }],
    transactions: [transaction],
  });

  assert.equal(hasLegacyFinancialPresets(cleaned), false);
  assert.deepEqual(
    cleaned.accounts.map((account) => account.id).sort(),
    ["acc_cash", "acc_custom"],
  );
  assert.deepEqual(cleaned.investments.map((item) => item.id), ["inv_custom"]);
  assert.deepEqual(cleaned.autopayRules.map((item) => item.id), ["auto_custom"]);
  assert.deepEqual(cleaned.goals.map((goal) => goal.id), ["goal_custom"]);
  assert.deepEqual(cleaned.transactions, [transaction]);
});

test("bank reserve is removed from spendable balance but counted once in net worth", () => {
  const state = computeFinancialState({
    accounts: [
      {
        id: "bank_main",
        type: "bank",
        openingBalance: 5000,
        includeInTotalBank: true,
      },
    ],
    transactions: [
      {
        id: "expense_1",
        type: "expense",
        amount: 1000,
        accountId: "bank_main",
        date: "2026-01-02",
      },
    ],
    emergencyReserve: {
      name: "Rainy Day",
      sourceAccountId: "bank_main",
      amount: 1200,
    },
  });

  assert.equal(state.computedAccounts[0].grossBalance, 4000);
  assert.equal(state.computedAccounts[0].currentBalance, 2800);
  assert.equal(state.emergencyReserveBalance, 1200);
  assert.equal(state.totalAssets, 4000);
});

test("reserve transfers route to the configured bank and lock the transferred amount", () => {
  const state = computeFinancialState({
    accounts: [
      { id: "cash", type: "cash", openingBalance: 1000 },
      { id: "bank_main", type: "bank", openingBalance: 1000 },
    ],
    transactions: [{
      id: "reserve_contribution",
      type: "transfer",
      amount: 200,
      accountId: "cash",
      toAccountId: "bank_main",
      date: "2026-01-02",
    }],
    emergencyReserve: {
      name: "Rainy Day",
      sourceAccountId: "bank_main",
      amount: 200,
    },
  });

  assert.equal(state.computedAccounts.find((account) => account.id === "cash").currentBalance, 800);
  assert.equal(state.computedAccounts.find((account) => account.id === "bank_main").grossBalance, 1200);
  assert.equal(state.computedAccounts.find((account) => account.id === "bank_main").currentBalance, 1000);
  assert.equal(state.emergencyReserveBalance, 200);
  assert.equal(state.totalAssets, 2000);
});

test("liquid fund reserve withdrawal transfers value to a bank without double counting", () => {
  const state = computeFinancialState({
    accounts: [
      {
        id: "bank_main",
        type: "bank",
        openingBalance: 1000,
        includeInTotalBank: true,
      },
    ],
    liquidMfOpeningBalance: 2000,
    emergencyReserve: {
      name: "Rainy Day",
      sourceAccountId: "liquid_mf",
      amount: 1500,
    },
    transactions: [
      {
        id: "withdrawal_1",
        type: "transfer",
        amount: 500,
        accountId: "liquid_mf",
        toAccountId: "bank_main",
        date: "2026-01-02",
      },
    ],
  });

  assert.equal(state.emergencyReserveBalance, 1500);
  assert.equal(state.liquidMfGrossBalance, 1500);
  assert.equal(state.liquidMfBalance, 0);
  assert.equal(state.computedAccounts[0].currentBalance, 1500);
  assert.equal(state.totalAssets, 3000);
});

test("credit cards do not receive hidden default limits, alerts, or due dates", () => {
  const state = computeFinancialState({
    accounts: [
      {
        id: "card_1",
        type: "credit",
        openingBalance: 100,
      },
    ],
  });
  const [card] = state.ccAlerts;

  assert.equal(card.limit, 0);
  assert.equal(card.thresholdPct, 0);
  assert.equal(card.utilizationPct, 0);
  assert.equal(card.nextDueLabel, "Not set");
  assert.equal(card.isExceeded, false);
});

test("magic parsing extracts a currency amount, category, subcategory, account, and time", () => {
  const parsed = smartParseMagicInput(
    "₹180 cravings from Cash Wallet at 8:30 pm",
    DEFAULT_CATEGORIES,
    DEFAULT_ACCOUNTS,
  );

  assert.equal(parsed.amount, 180);
  assert.equal(parsed.type, "expense");
  assert.equal(parsed.categoryId, "cat_food");
  assert.equal(parsed.subcategory, "Cravings");
  assert.equal(parsed.accountId, "acc_cash");
  assert.equal(parsed.time, "8:30 pm");
});

test("magic transfer parsing identifies source and destination instead of guessing", () => {
  const accounts = [
    { id: "cash", name: "Cash Wallet", type: "cash" },
    { id: "bank", name: "Savings Account", type: "bank" },
    { id: "card", name: "Travel Card", type: "credit" },
  ];
  const parsed = smartParseMagicInput(
    "transfer ₹500 from Cash Wallet to Savings Account",
    DEFAULT_CATEGORIES,
    accounts,
  );

  assert.equal(parsed.amount, 500);
  assert.equal(parsed.type, "transfer");
  assert.equal(parsed.accountId, "cash");
  assert.equal(parsed.toAccountId, "bank");

  const reversed = smartParseMagicInput(
    "transfer ₹500 to Savings Account from Cash Wallet",
    DEFAULT_CATEGORIES,
    accounts,
  );
  assert.equal(reversed.accountId, "cash");
  assert.equal(reversed.toAccountId, "bank");

  const reserve = smartParseMagicInput(
    "transfer ₹500 from Cash Wallet to emergency reserve",
    DEFAULT_CATEGORIES,
    accounts,
  );
  assert.equal(reserve.toAccountId, "emergency_reserve");
});

test("magic parsing resolves a distinctive account name and does not confuse transfer destination for source", () => {
  const accounts = [
    { id: "cash", name: "Cash Wallet", type: "cash" },
    { id: "union", name: "Union Bank of India", type: "bank" },
  ];
  const expense = smartParseMagicInput(
    "₹250 groceries from Union",
    DEFAULT_CATEGORIES,
    accounts,
  );
  const transfer = smartParseMagicInput(
    "transfer ₹500 to Union from Cash Wallet",
    DEFAULT_CATEGORIES,
    accounts,
  );
  const sent = smartParseMagicInput(
    "send ₹100 to Union from Cash Wallet",
    DEFAULT_CATEGORIES,
    accounts,
  );

  assert.equal(expense.accountId, "union");
  assert.equal(expense.accountExplicit, true);
  assert.equal(transfer.accountId, "cash");
  assert.equal(transfer.toAccountId, "union");
  assert.equal(sent.type, "transfer");
  assert.equal(sent.accountId, "cash");
  assert.equal(sent.toAccountId, "union");
});

test("magic parsing recognizes bank nicknames and acronyms while preserving note wording", () => {
  const accounts = [
    { id: "cash", name: "Cash Wallet", type: "cash" },
    {
      id: "union",
      name: "Union Bank of India",
      nickname: "Union",
      brand: "Union Bank of India",
      type: "bank",
    },
  ];
  const acronym = smartParseMagicInput(
    "₹230 lunch with friends from UBI",
    DEFAULT_CATEGORIES,
    accounts,
  );
  const nickname = smartParseMagicInput(
    "₹150 chai from Union",
    DEFAULT_CATEGORIES,
    accounts,
  );

  assert.equal(acronym.accountId, "union");
  assert.equal(acronym.description, "Lunch with friends");
  assert.equal(nickname.accountId, "union");
  assert.equal(nickname.description, "Chai");
});

test("magic parsing retains the merchant and explicit note instead of dropping context", () => {
  const accounts = [
    { id: "union", name: "Union Bank of India", type: "bank" },
  ];
  const merchant = smartParseMagicInput(
    "₹450 paid at Cafe Coffee Day for client meeting from Union Bank of India at 12:00 pm",
    DEFAULT_CATEGORIES,
    accounts,
  );
  const explicitNote = smartParseMagicInput(
    "₹900 note: Dinner with family",
    DEFAULT_CATEGORIES,
    accounts,
  );

  assert.equal(merchant.description, "Cafe Coffee Day for client meeting");
  assert.equal(merchant.accountId, "union");
  assert.equal(explicitNote.description, "Dinner with family");
});

test("magic parsing flags an ambiguous account mention instead of guessing", () => {
  const accounts = [
    { id: "union_savings", name: "Union Bank Savings", type: "bank" },
    { id: "union_current", name: "Union Bank Current", type: "bank" },
  ];
  const parsed = smartParseMagicInput(
    "₹250 groceries from Union",
    DEFAULT_CATEGORIES,
    accounts,
  );

  assert.equal(parsed.accountAmbiguous, true);
  assert.equal(parsed.accountExplicit, false);
});

test("amount evaluation accepts arithmetic and rejects malformed expressions", () => {
  assert.equal(evaluateMathExpression("2 × (3 + 1)"), 8);
  assert.equal(evaluateMathExpression("1,250 / 2"), 625);
  assert.equal(evaluateMathExpression("12 +"), 0);
  assert.equal(evaluateMathExpression("100 rupees"), 0);
});

test("magic parsing maps a specific category keyword to a useful subcategory", () => {
  const parsed = smartParseMagicInput("60 chai", DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS);
  const shorthand = smartParseMagicInput("salary 50k", DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS);

  assert.equal(parsed.categoryId, "cat_food");
  assert.equal(parsed.subcategory, "Chai & Coffee");
  assert.equal(shorthand.amount, 50000);
  assert.equal(shorthand.type, "income");
});
