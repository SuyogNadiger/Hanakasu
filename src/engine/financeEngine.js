import { ACCOUNT_TYPES } from "../data/defaults";

export const getTodayISO = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export function parseLocalDateISO(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : null;
}

export function formatDateDisplay(value) {
  const date = parseLocalDateISO(value);
  return date
    ? date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : value || "";
}

export const getCurrentTimeStr = () => {
  const d = new Date();
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const getCurrentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const formatINR = (
  amount,
  hideBalances = false,
  showDecimals = false,
) => {
  if (hideBalances) return "₹ •••••";
  const n = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
};

export function evaluateMathExpression(expr) {
  if (!expr) return 0;
  const cleaned = String(expr)
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[^0-9.+\-*/]/g, "");
  if (!cleaned) return 0;
  try {
    const result = Function(`"use strict"; return (${cleaned})`)();
    return Number.isFinite(result) ? Math.max(0, Number(result.toFixed(2))) : 0;
  } catch {
    return parseFloat(cleaned) || 0;
  }
}

export function getNextRecurrenceDateISO(dateStr, frequency = "Monthly") {
  const base = parseLocalDateISO(dateStr) || new Date();
  const monthDelta =
    {
      Monthly: 1,
      Quarterly: 3,
      "Half Yearly": 6,
      Yearly: 12,
    }[frequency] || 1;
  const targetMonth = new Date(
    base.getFullYear(),
    base.getMonth() + monthDelta,
    1,
  );
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
  ).getDate();
  const targetDay = Math.min(base.getDate(), lastDay);
  return `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

export function smartParseMagicInput(rawText, categories = [], accounts = []) {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  const amountMatch = text.match(/(?:₹|rs\.?\s*)?(\d+(?:,\d+)*(?:\.\d+)?)/i);
  const amount = amountMatch
    ? parseFloat(amountMatch[1].replace(/,/g, ""))
    : "";
  const lower = text.toLowerCase();

  let type = "expense";
  if (
    /\b(salary|income|credited|received|bonus|dividend|ipo|gift)\b/i.test(lower)
  ) {
    type = "income";
  } else if (/\b(transfer|moved|sent to)\b/i.test(lower)) {
    type = "transfer";
  }

  let accountId = accounts[0]?.id || "acc_union";
  for (const acc of accounts) {
    if (lower.includes(acc.name.toLowerCase().split(" ")[0])) {
      if ((type === "income" || type === "transfer") && acc.type === "credit")
        continue;
      accountId = acc.id;
      break;
    }
  }
  if (type === "expense" && /\b(cc|card|moneyback)\b/i.test(lower)) {
    const cc = accounts.find((a) => a.type === "credit");
    if (cc) accountId = cc.id;
  }

  const relevantCats = categories.filter((c) =>
    type === "income" ? c.type === "income" : c.type === "expense",
  );
  let matchedCat =
    relevantCats.find((c) => c.id === "cat_other") || relevantCats[0];
  let matchedSub = "";

  for (const cat of relevantCats) {
    const subHit = (cat.subcategories || []).find((s) =>
      lower.includes(s.toLowerCase()),
    );
    if (subHit) {
      matchedCat = cat;
      matchedSub = subHit;
      break;
    }
    const kwHit = (cat.keywords || []).some((k) =>
      lower.includes(k.toLowerCase()),
    );
    if (kwHit || lower.includes(cat.name.toLowerCase().split(" ")[0])) {
      matchedCat = cat;
      matchedSub = cat.subcategories?.[0] || "";
      break;
    }
  }

  let narrative = text
    .replace(amountMatch ? amountMatch[0] : "", "")
    .replace(
      /\b(via|using|from|in|on|union|sbi|hdfc|idfc|card|cc|gpay|upi)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (narrative) {
    narrative = narrative.charAt(0).toUpperCase() + narrative.slice(1);
  }

  return {
    amount,
    type,
    accountId,
    categoryId: matchedCat?.id || "cat_other",
    subcategory: matchedSub,
    description: narrative,
  };
}

function buildPaletteEmailHTML({
  subject,
  message,
  holderName,
  badge = "PRIVATE LEDGER DISPATCH",
  codeHighlight = "",
  theme = "dark",
}) {
  const isLight = theme === "light";
  const bgMain = isLight ? "#E1DCC9" : "#000000";
  const fgMain = isLight ? "#000000" : "#E1DCC9";

  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    .hm-email-wrap { background-color: ${bgMain} !important; color: ${fgMain} !important; }
    .hm-email-card { background-color: ${bgMain} !important; color: ${fgMain} !important; border: 1.5px solid ${fgMain} !important; }
    .hm-email-invert { background-color: ${fgMain} !important; color: ${bgMain} !important; }
    .hm-email-rule { border-color: ${fgMain} !important; }
    @media (prefers-color-scheme: dark) {
      .hm-email-wrap, .hm-email-card { background-color: #000000 !important; color: #E1DCC9 !important; border-color: #E1DCC9 !important; }
      .hm-email-invert { background-color: #E1DCC9 !important; color: #000000 !important; }
      .hm-email-rule { border-color: #E1DCC9 !important; }
    }
    @media (prefers-color-scheme: light) {
      .hm-email-wrap, .hm-email-card { background-color: #E1DCC9 !important; color: #000000 !important; border-color: #000000 !important; }
      .hm-email-invert { background-color: #000000 !important; color: #E1DCC9 !important; }
      .hm-email-rule { border-color: #000000 !important; }
    }
  </style>
</head>
<body class="hm-email-wrap" style="margin:0;padding:36px 16px;background-color:${bgMain};color:${fgMain};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div class="hm-email-card" style="max-width:520px;margin:0 auto;background-color:${bgMain};color:${fgMain};border:1.5px solid ${fgMain};border-radius:18px;overflow:hidden;">
    <div class="hm-email-rule" style="padding:22px 28px;border-bottom:1.5px solid ${fgMain};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <span class="hm-email-invert" style="display:inline-block;padding:6px 10px;background-color:${fgMain};color:${bgMain};font-weight:900;font-size:12px;border-radius:8px;letter-spacing:0.5px;">HM</span>
            <span style="margin-left:10px;font-size:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${fgMain};">Hanakasu Mantri</span>
          </td>
          <td align="right" style="font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${fgMain};font-weight:800;">
            ${badge}
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:30px 28px;">
      <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:${fgMain};font-weight:700;">
        Account Holder: ${holderName || "Suyog"}
      </p>
      <h1 style="margin:0 0 20px 0;font-size:20px;font-weight:800;color:${fgMain};line-height:1.3;">
        ${subject}
      </h1>
      <div class="hm-email-rule" style="padding:20px;border:1.5px solid ${fgMain};border-radius:14px;margin-bottom:22px;">
        <p style="margin:0;font-size:14px;line-height:1.65;color:${fgMain};font-weight:600;">
          ${message}
        </p>
        ${
          codeHighlight
            ? `<div class="hm-email-invert" style="margin-top:18px;padding:16px;background-color:${fgMain};color:${bgMain};border-radius:10px;text-align:center;">
                <span style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:4px;">One-Time Security Code</span>
                <span style="font-family:monospace;font-size:28px;font-weight:900;letter-spacing:6px;">${codeHighlight}</span>
              </div>`
            : ""
        }
      </div>
      <table class="hm-email-rule" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${fgMain};padding-top:16px;font-size:11px;color:${fgMain};">
        <tr>
          <td>Timestamp: <strong>${dateStr}</strong></td>
          <td align="right">Dispatch: <strong>Hanakasu Mantri</strong></td>
        </tr>
      </table>
    </div>
    <div class="hm-email-invert" style="padding:14px 28px;background-color:${fgMain};color:${bgMain};text-align:center;font-size:10px;font-weight:800;letter-spacing:1px;">
      HANAKASU MANTRI • PERSONAL WEALTH RESERVE
    </div>
  </div>
</body>
</html>`;
}

export async function triggerWorkableAlert({
  message,
  subject = "Hanakasu Mantri — Financial Dispatch",
  profile,
  theme = "dark",
  badge = "PRIVATE LEDGER DISPATCH",
  codeHighlight = "",
}) {
  const targetEmail = profile?.email?.trim();

  // 1. SEND EMAIL FIRST (Never blocked by Browser Notification permissions)
  if (targetEmail) {
    const prefersLight =
      theme === "light" ||
      (typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches &&
        theme !== "dark");

    const htmlBody = buildPaletteEmailHTML({
      subject,
      message,
      holderName: profile?.name || "Suyog",
      badge,
      codeHighlight,
      theme: prefersLight ? "light" : "dark",
    });

    const formattedTextFallback = [
      `HANAKASU MANTRI — ${badge}`,
      `Account Holder: ${profile?.name || "Suyog"}`,
      ``,
      message,
      codeHighlight ? `\nSECURITY CODE: ${codeHighlight}\n` : "",
      `Timestamp: ${new Date().toLocaleString("en-IN")}`,
    ].join("\n");

    const payloadStr = JSON.stringify({
      action: "send_email",
      senderName: "Hanakasu Mantri",
      name: "Hanakasu Mantri",
      email: targetEmail,
      subject,
      message: formattedTextFallback,
      htmlBody,
      timestamp: new Date().toISOString(),
    });

    try {
      await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: payloadStr,
      });
    } catch {
      // Email delivery is best-effort; browser notifications continue below.
    }
  }

  // 2. NON-BLOCKING SAFE NOTIFICATION (PWA & Mobile Safe)
  try {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) =>
            reg.showNotification(subject, {
              body: message,
              icon: "/hm-icon.svg",
            }),
          )
          .catch(() => {});
      } else {
        new Notification(subject, { body: message });
      }
    }
  } catch {
    // Ignore notification constructor restrictions on mobile browsers
  }
}

/**
 * CROSS-DEVICE CLOUD DATABASE PULL (Phone <-> Desktop)
 */
export async function pullCloudDatabase() {
  try {
    const res = await fetch(`/api/webhook?action=pull_db&t=${Date.now()}`, {
      method: "GET",
      redirect: "follow",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
}

/**
 * CROSS-DEVICE CLOUD DATABASE PUSH + 24/7 OFFLINE SCHEDULE SYNC
 */
export async function pushCloudDatabase(fullData, ccAlerts = []) {
  if (!fullData) return false;

  const schedulePayload = {
    name: fullData.profile?.name || "Suyog",
    email: fullData.profile?.email || "",
    emailVerified: Boolean(fullData.profile?.emailVerified),
    ccList: ccAlerts.map((c) => ({
      name: c.name,
      used: c.used,
      recurringDay: c.recurringDay,
    })),
    autopayRules: (fullData.autopayRules || []).map((r) => ({
      title: r.title,
      amount: r.amount,
      frequency: r.frequency,
      deductDate: r.deductDate,
      deductDay: r.deductDay,
    })),
    manualAlerts: (fullData.manualAlerts || []).map((m) => ({
      title: m.title,
      amount: m.amount,
      alertDate: m.alertDate,
    })),
    syncedAt: new Date().toISOString(),
  };

  const bodyStr = JSON.stringify({
    action: "sync_db",
    db: fullData,
    schedule: schedulePayload,
  });

  try {
    const res = await fetch("/api/webhook", {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: bodyStr,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyzeGoalWithAI(goal, finState, profile) {
  const remaining = Math.max(
    0,
    (Number(goal.targetAmount) || 0) - (Number(goal.savedAmount) || 0),
  );
  const today = new Date();
  const target =
    parseLocalDateISO(goal.targetDate) ||
    new Date(today.getFullYear() + 1, today.getMonth(), 1);
  const monthsLeft = Math.max(
    1,
    Math.ceil((target - today) / (1000 * 60 * 60 * 24 * 30)),
  );
  const requiredMonthly = Math.ceil(remaining / monthsLeft);

  const configuredSalary = Number(profile?.monthlySalary) || 0;
  const actualMonthlyIncome = finState.monthlyIncome || 0;
  const effectiveMonthlyIncome = Math.max(
    configuredSalary,
    actualMonthlyIncome,
    finState.avgMonthlyIncome || 0,
  );
  const monthlySurplus = Math.max(
    0,
    effectiveMonthlyIncome - finState.monthlyExpense,
  );

  const salarySharePct =
    effectiveMonthlyIncome > 0
      ? Number(((requiredMonthly / effectiveMonthlyIncome) * 100).toFixed(1))
      : 100;

  let isPossibleVerdict = "Possible & Comfortable";
  if (remaining === 0) {
    isPossibleVerdict = "Goal Completed ✓";
  } else if (effectiveMonthlyIncome === 0) {
    isPossibleVerdict = "Add Monthly Salary in Profile to Verify";
  } else if (requiredMonthly <= monthlySurplus && salarySharePct <= 35) {
    isPossibleVerdict = "Yes — Easily Possible on Your Salary";
  } else if (requiredMonthly <= effectiveMonthlyIncome * 0.6) {
    isPossibleVerdict = "Possible with Moderate Expense Control";
  } else {
    isPossibleVerdict = "Stretch Target — Extend Target Date";
  }

  return {
    monthsLeft,
    requiredMonthly,
    effectiveMonthlyIncome,
    monthlySurplus,
    salarySharePct,
    isPossibleVerdict,
    summary:
      effectiveMonthlyIncome > 0
        ? `Based on your monthly income of ${formatINR(effectiveMonthlyIncome)} and current SBI balance of ${formatINR(finState.sbiBalance)}, saving ${formatINR(requiredMonthly)}/month takes ${salarySharePct}% of your monthly income over ${monthsLeft} months.`
        : `You need ${formatINR(requiredMonthly)}/month for ${monthsLeft} months. Set your Monthly Salary in Profile to benchmark against your income.`,
    recommendations: [
      `SBI Balance Check: Your SBI Savings Account currently holds ${formatINR(finState.sbiBalance)}. Goal contributions deduct directly from SBI.`,
      effectiveMonthlyIncome > 0
        ? `Monthly Surplus after expenses is ${formatINR(monthlySurplus)} (Income ${formatINR(effectiveMonthlyIncome)} − Spent ${formatINR(finState.monthlyExpense)}).`
        : `Record your salary inflow or set Monthly Salary in Profile to see surplus coverage.`,
      `Setting aside ${formatINR(Math.ceil(requiredMonthly / 4))}/week keeps you on track for ${formatDateDisplay(goal.targetDate) || "your target"}.`,
    ],
  };
}

function getNextPaymentDateInfo(cc = {}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let recurringDay = Number(cc.billDueDay) || 5;
  if (cc.billDueDate && /^\d{4}-\d{2}-\d{2}$/.test(cc.billDueDate)) {
    recurringDay = Number(cc.billDueDate.split("-")[2]) || recurringDay;
  }
  recurringDay = Math.min(Math.max(recurringDay, 1), 31);

  const maxDaysThisMonth = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth() + 1,
    0,
  ).getDate();
  let nextDue = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth(),
    Math.min(recurringDay, maxDaysThisMonth),
  );

  if (todayStart > nextDue) {
    const maxDaysNextMonth = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth() + 2,
      0,
    ).getDate();
    nextDue = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth() + 1,
      Math.min(recurringDay, maxDaysNextMonth),
    );
  }

  const iso = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}-${String(nextDue.getDate()).padStart(2, "0")}`;
  const isDueToday =
    todayStart.getDate() === Math.min(recurringDay, maxDaysThisMonth);

  return {
    recurringDay,
    nextDueISO: iso,
    nextDueLabel: `${nextDue.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} (Every Month on Day ${recurringDay})`,
    isDueToday,
    isOnOrBeforeDue: todayStart <= nextDue,
  };
}

export function computeFinancialState(
  data,
  selectedMonth = getCurrentMonthKey(),
) {
  const {
    accounts = [],
    transactions = [],
    investments = [],
    goals = [],
    categories = [],
    settings = {},
    liquidMfOpeningBalance = 0,
  } = data;

  const accountMap = {};
  accounts.forEach((acc) => {
    if (acc.type === "liquid_mf") return;
    const typeInfo =
      ACCOUNT_TYPES.find((t) => t.id === acc.type) || ACCOUNT_TYPES[0];
    accountMap[acc.id] = {
      ...acc,
      isLiability: typeInfo.isLiability,
      isLiquid: typeInfo.isLiquid,
      isBank: typeInfo.isBank,
      currentBalance: Number(acc.openingBalance) || 0,
      txCount: 0,
      lastBillPaidAt: null,
    };
  });

  let liquidMfBalance = Number(liquidMfOpeningBalance) || 0;

  const chronologicalTxs = [...transactions].sort((a, b) => {
    const dateCmp = (a.date || "").localeCompare(b.date || "");
    if (dateCmp !== 0) return dateCmp;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  chronologicalTxs.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    const acc = accountMap[tx.accountId];
    const toAcc = tx.toAccountId ? accountMap[tx.toAccountId] : null;

    if (tx.type === "income") {
      if (acc && !acc.isLiability) {
        acc.currentBalance = Number((acc.currentBalance + amt).toFixed(2));
        acc.txCount += 1;
      }
    } else if (tx.type === "expense") {
      if (acc) {
        acc.currentBalance = Number(
          (acc.currentBalance + (acc.isLiability ? amt : -amt)).toFixed(2),
        );
        acc.txCount += 1;
      }
    } else if (tx.type === "transfer") {
      if (acc && !acc.isLiability) {
        acc.currentBalance = Number((acc.currentBalance - amt).toFixed(2));
        acc.txCount += 1;
      }
      if (tx.toAccountId === "liquid_mf") {
        liquidMfBalance = Number((liquidMfBalance + amt).toFixed(2));
      } else if (toAcc) {
        toAcc.currentBalance = Number(
          (toAcc.currentBalance + (toAcc.isLiability ? -amt : amt)).toFixed(2),
        );
        toAcc.txCount += 1;
      }
    } else if (tx.type === "cc_bill_payment") {
      if (acc) {
        acc.currentBalance = Number((acc.currentBalance - amt).toFixed(2));
        acc.txCount += 1;
      }
      if (toAcc && toAcc.isLiability) {
        toAcc.currentBalance = Number(
          Math.max(0, toAcc.currentBalance - amt).toFixed(2),
        );
        toAcc.lastBillPaidAt = tx.date;
        toAcc.txCount += 1;
      }
    } else if (tx.type === "investment_contrib" || tx.type === "goal_contrib") {
      if (acc) {
        acc.currentBalance = Number((acc.currentBalance - amt).toFixed(2));
        acc.txCount += 1;
      }
    }
  });

  const computedAccounts = Object.values(accountMap);
  const bankAccounts = computedAccounts.filter((a) => a.isBank);
  const sbiBalance = Number(
    (accountMap["acc_sbi"]?.currentBalance || 0).toFixed(2),
  );
  const hdfcBankBalance = Number(
    (accountMap["acc_hdfc"]?.currentBalance || 0).toFixed(2),
  );

  const selectedBankBalance = bankAccounts
    .filter((a) => a.includeInTotalBank !== false)
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const allSpendableLiquidBalance = computedAccounts
    .filter((a) => a.isLiquid)
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const pinnedAccounts = computedAccounts
    .filter((a) => a.pinnedOnHome)
    .slice(0, 4);

  const creditCards = computedAccounts.filter((a) => a.type === "credit");
  const ccAlerts = creditCards.map((cc) => {
    const limit = Number(cc.creditLimit) || 50000;
    const thresholdPct = Number(cc.alertThresholdPct) || 10;
    const thresholdAmt = (limit * thresholdPct) / 100;
    const used = Math.max(0, Number(cc.currentBalance.toFixed(2)));
    const utilizationPct = Number(((used / limit) * 100).toFixed(1));
    const dueInfo = getNextPaymentDateInfo(cc);

    return {
      ...cc,
      used,
      limit,
      thresholdPct,
      thresholdAmt,
      utilizationPct,
      recurringDay: dueInfo.recurringDay,
      nextDueISO: dueInfo.nextDueISO,
      nextDueLabel: dueInfo.nextDueLabel,
      isDueToday: dueInfo.isDueToday,
      isBillPaidAndZero: used <= 0,
      isExceeded: used >= thresholdAmt && used > 0,
    };
  });

  const getMonthMetrics = (mKey) => {
    const mTx = transactions.filter((t) => t.date && t.date.startsWith(mKey));

    const income = mTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const pureExpenses = mTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return {
      income,
      expense: pureExpenses,
      txList: mTx,
    };
  };

  const currentM = getMonthMetrics(selectedMonth);
  const monthlyIncome = currentM.income;
  const monthlyExpense = currentM.expense;

  const monthlySpendLimit = Number(settings.monthlySpendLimit) || 0;
  const isOverBudgetLimit =
    monthlySpendLimit > 0 && monthlyExpense > monthlySpendLimit;

  const monthlySavings = Number((sbiBalance + liquidMfBalance).toFixed(2));
  const savingsRate =
    monthlyIncome > 0
      ? Number(((monthlySavings / monthlyIncome) * 100).toFixed(1))
      : 0;

  const [selY, selM] = selectedMonth.split("-").map(Number);
  const cashFlowSeries = [];
  let total6MoIncome = 0;
  let activeIncomeMonths = 0;

  for (let i = 5; i >= 0; i--) {
    const d = new Date(selY, selM - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short" });
    const m = getMonthMetrics(key);
    if (m.income > 0) {
      total6MoIncome += m.income;
      activeIncomeMonths += 1;
    }
    cashFlowSeries.push({
      key,
      label,
      income: m.income,
      expense: m.expense,
      saved: monthlySavings,
      isSelected: key === selectedMonth,
    });
  }

  const avgMonthlyIncome =
    activeIncomeMonths > 0
      ? Math.round(total6MoIncome / activeIncomeMonths)
      : monthlyIncome;

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const categoryBreakdown = expenseCategories
    .map((cat) => {
      const catTxs = currentM.txList.filter(
        (t) => t.type === "expense" && t.categoryId === cat.id,
      );
      const spent = catTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const subMap = {};
      catTxs.forEach((t) => {
        const sub = t.subcategory || "General";
        subMap[sub] = (subMap[sub] || 0) + (Number(t.amount) || 0);
      });

      const shareOfTotal =
        monthlyExpense > 0 ? Math.round((spent / monthlyExpense) * 100) : 0;
      return {
        ...cat,
        spent,
        shareOfTotal,
        subBreakdown: Object.entries(subMap).map(([name, amount]) => ({
          name,
          amount,
        })),
      };
    })
    .sort((a, b) => b.spent - a.spent);

  const totalInvestedCost = investments.reduce(
    (s, i) => s + (Number(i.investedAmount) || 0),
    0,
  );
  const totalInvestmentValue = investments.reduce(
    (sum, investment) =>
      sum + (Number(investment.currentValue ?? investment.investedAmount) || 0),
    0,
  );
  const totalGoalsSaved = goals.reduce(
    (s, g) => s + (Number(g.savedAmount) || 0),
    0,
  );
  const totalCreditCardDebt = creditCards.reduce(
    (s, c) => s + Math.max(0, c.currentBalance),
    0,
  );

  const totalAssets =
    allSpendableLiquidBalance +
    liquidMfBalance +
    totalInvestmentValue +
    totalGoalsSaved;
  const totalLiabilities = totalCreditCardDebt;
  const netWorth = totalAssets - totalLiabilities;

  return {
    computedAccounts,
    bankAccounts,
    sbiBalance,
    hdfcBankBalance,
    selectedBankBalance,
    allSpendableLiquidBalance,
    liquidMfBalance,
    pinnedAccounts,
    ccAlerts,
    monthlyIncome,
    avgMonthlyIncome,
    monthlyExpense,
    monthlySpendLimit,
    isOverBudgetLimit,
    monthlySavings,
    savingsRate,
    cashFlowSeries,
    categoryBreakdown,
    totalInvestedCost,
    totalInvestmentValue,
    totalGoalsSaved,
    totalAssets,
    totalLiabilities,
    netWorth,
    monthTx: currentM.txList,
  };
}
