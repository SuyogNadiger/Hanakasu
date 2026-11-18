import { ACCOUNT_TYPES } from "../data/defaults.js";
import { auth } from "../firebase.js";
import { matchAccountMention } from "./accountMatching.js";

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
  if (!expr || !String(expr).trim()) return 0;
  const cleaned = String(expr)
    .replace(/[×xX]/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  const tokens = cleaned.match(/(?:\d+(?:\.\d*)?|\.\d+|[()+\-*/])/g);
  if (!tokens || tokens.join("") !== cleaned) return 0;

  let position = 0;
  const parseExpression = () => {
    let value = parseTerm();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const parseTerm = () => {
    let value = parseFactor();
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const right = parseFactor();
      if (operator === "/" && right === 0) throw new Error("Cannot divide by zero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const parseFactor = () => {
    if (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const value = parseFactor();
      return operator === "-" ? -value : value;
    }
    if (tokens[position] === "(") {
      position++;
      const value = parseExpression();
      if (tokens[position++] !== ")") throw new Error("Unclosed expression.");
      return value;
    }
    const token = tokens[position++];
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      throw new Error("Invalid expression.");
    }
    return Number(token);
  };

  try {
    const result = parseExpression();
    return position === tokens.length && Number.isFinite(result)
      ? Math.max(0, Number(result.toFixed(2)))
      : 0;
  } catch {
    return 0;
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

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsNormalizedWord(text, word) {
  const variants = [word, `${word}s`, `${word}es`];
  if (word.endsWith("y") && word.length > 2) {
    variants.push(`${word.slice(0, -1)}ies`);
  }
  return variants.some((variant) => text.includes(` ${variant} `));
}

function parseMagicTime(text) {
  const match = text.match(
    /\b(?:at\s*)?((?:1[0-2]|0?[1-9]):[0-5]\d\s*(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d|(?:1[0-2]|0?[1-9])\s*(?:am|pm))\b/i,
  );
  if (!match) return null;
  const time = match[1].replace(/\s+/g, "").toLowerCase();
  const timeMatch = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(time);
  if (!timeMatch) return null;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || 0);
  const suffix = timeMatch[3];
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "am") hour %= 12;
    else if (hour !== 12) hour += 12;
  }
  if (hour > 23) return null;
  const period = hour >= 12 ? "pm" : "am";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function smartParseMagicInput(
  rawText,
  categories = [],
  accounts = [],
  primaryAccountId = "",
) {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  const timeMatch = text.match(
    /\b(?:at\s*)?(?:(?:1[0-2]|0?[1-9]):[0-5]\d\s*(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d|(?:1[0-2]|0?[1-9])\s*(?:am|pm))\b/i,
  );
  const isoDateMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const amountSource = text
    .replace(timeMatch?.[0] || "", " ")
    .replace(isoDateMatch?.[0] || "", " ");
  const amountPattern =
    /(?:₹\s*|rs\.?\s*|inr\s*|rupees?\s*)?(\d+(?:,\d+)*(?:\.\d+)?)(?:\s*(k|thousand|l|lakh|lakhs|m|million|rupees?|inr|rs)\b)?(?:\s*\/-)?/gi;
  const amountMatches = [];
  let amountCandidate;
  while ((amountCandidate = amountPattern.exec(amountSource))) {
    const precedingWords = amountSource
      .slice(Math.max(0, amountCandidate.index - 24), amountCandidate.index);
    const hasCurrencyPrefix = /^(?:₹|rs|inr)/i.test(amountCandidate[0]);
    const suffix = amountCandidate[2]?.toLowerCase();
    const hasCurrencySuffix = ["rupee", "rupees", "inr", "rs"].includes(suffix);
    const hasAmountCue =
      /\b(?:amount|spent|paid|cost|total|worth|for|price)\s*(?:of\s*)?$/i.test(precedingWords);
    amountMatches.push({
      match: amountCandidate,
      priority: hasCurrencyPrefix || hasCurrencySuffix ? 3 : hasAmountCue ? 2 : 1,
    });
  }
  const amountMatch = amountMatches
    .sort((first, second) =>
      second.priority - first.priority ||
      first.match.index - second.match.index,
    )[0]?.match;
  const amountSuffix = amountMatch?.[2]?.toLowerCase();
  const amountMultiplier = ["k", "thousand"].includes(amountSuffix)
    ? 1000
    : ["l", "lakh", "lakhs"].includes(amountSuffix)
      ? 100000
      : ["m", "million"].includes(amountSuffix)
        ? 1000000
        : 1;
  const amount = amountMatch
    ? parseFloat(amountMatch[1].replace(/,/g, "")) * amountMultiplier
    : "";
  const lower = text.toLowerCase();

  let type = "expense";
  if (/\b(transfer|move|moved|send|sent)\b/i.test(lower)) {
    type = "transfer";
  } else if (
    /\b(salary|income|credited|received|bonus|dividend|ipo|gift|refund|cashback)\b/i.test(lower)
  ) {
    type = "income";
  }

  const eligibleAccounts = accounts.filter(
    (account) =>
      account.type !== "liquid_mf" &&
      !((type === "income" || type === "transfer") && account.type === "credit"),
  );
  const fromClause = /\bfrom\s+(.+?)(?=\s+\bto\b|$)/i.exec(text)?.[1];
  const toClause = /\b(?:to|into)\s+(.+?)(?=\s+\bfrom\b|\s+\bfor\b|$)/i.exec(text)?.[1];
  const sourceSearchText = toClause ? text.replace(toClause, " ") : text;
  const sourceMatch = matchAccountMention(sourceSearchText, eligibleAccounts);
  const mentionedAccount = sourceMatch.account;
  const sourceMentionAmbiguous = sourceMatch.ambiguous;
  const defaultAccount =
    eligibleAccounts.find((account) => account.id === primaryAccountId) ||
    eligibleAccounts.find((account) => account.type !== "credit") ||
    eligibleAccounts[0];
  const creditAccounts = accounts.filter((account) => account.type === "credit");
  const creditMatch = matchAccountMention(text, creditAccounts);
  const mentionedCreditCard = creditMatch.account;
  const cardAccount =
    type === "expense" && /\b(credit card|card|cc)\b/i.test(lower)
      ? mentionedCreditCard || (creditAccounts.length === 1 ? creditAccounts[0] : null)
      : null;
  const contextualSource = fromClause
    ? matchAccountMention(fromClause, eligibleAccounts).account
    : null;
  const accountAmbiguous =
    !contextualSource &&
    !mentionedAccount &&
    !cardAccount &&
    (sourceMentionAmbiguous ||
      (type === "expense" &&
        /\b(credit card|card|cc)\b/i.test(lower) &&
        creditAccounts.length > 1 &&
        !mentionedCreditCard));
  const sourceAccount = cardAccount || contextualSource || mentionedAccount || defaultAccount;
  const resolvedSourceAccountId = sourceAccount?.id || "";
  const destinationMention =
    type === "transfer" && toClause
      ? matchAccountMention(toClause, eligibleAccounts).account
      : null;
  const destinationAmbiguous =
    type === "transfer" &&
    Boolean(toClause) &&
    matchAccountMention(toClause, eligibleAccounts).ambiguous;
  const toAccountId =
    type === "transfer" &&
    /\b(?:to|into)\s+(?:my\s+)?(?:liquid\s*(?:mf|fund)|emergency\s+reserve)\b/i.test(lower)
      ? "emergency_reserve"
      : destinationMention && destinationMention.id !== resolvedSourceAccountId
        ? destinationMention.id
        : undefined;

  const relevantCats = categories.filter((c) =>
    type === "income" ? c.type === "income" : c.type === "expense",
  );
  const normalizedText = ` ${normalizeSearchText(text)} `;
  const genericSubcategories = new Set([
    "family",
    "home purpose",
    "miscellaneous",
    "needs",
  ]);
  let matchedCat = null;
  let matchedSub = "";
  let bestCategoryScore = 0;
  for (const cat of relevantCats) {
    for (const sub of cat.subcategories || []) {
      const phrase = normalizeSearchText(sub);
      if (!phrase) continue;
      const exactPhrase = normalizedText.includes(` ${phrase} `);
      const matchedWord = phrase
        .split(" ")
        .filter((word) => word.length >= 4)
        .find((word) => containsNormalizedWord(normalizedText, word));
      const generic = genericSubcategories.has(phrase);
      const score = exactPhrase
        ? (generic ? 150 : 500) + phrase.length
        : matchedWord
          ? (generic ? 100 : 330) + matchedWord.length
          : 0;
      if (score > bestCategoryScore) {
        bestCategoryScore = score;
        matchedCat = cat;
        matchedSub = sub;
      }
    }

    const categoryName = normalizeSearchText(cat.name);
    if (categoryName && normalizedText.includes(` ${categoryName} `)) {
      const score = 600 + categoryName.length;
      if (score > bestCategoryScore) {
        bestCategoryScore = score;
        matchedCat = cat;
        matchedSub = "";
      }
    }

    for (const keyword of cat.keywords || []) {
      const phrase = normalizeSearchText(keyword);
      if (phrase && normalizedText.includes(` ${phrase} `)) {
        const score = 300 + phrase.length;
        if (score > bestCategoryScore) {
          bestCategoryScore = score;
          matchedCat = cat;
          matchedSub = "";
        }
      }
    }
  }

  if (!matchedCat) {
    matchedCat =
      relevantCats.find((cat) => cat.id === "cat_other") ||
      relevantCats[0] ||
      null;
  }
  const explicitNote = /\b(?:note|memo|description)\s*[:=-]\s*(.+)$/i.exec(text)?.[1];
  let narrative = (explicitNote || text)
    .replace(amountMatch?.[0] || "", " ")
    .replace(timeMatch?.[0] || "", " ")
    .replace(isoDateMatch?.[0] || "", " ")
    .replace(/\b(?:today|yesterday|via|using|from|into|my|i|me|spent|paid|buy|bought|purchase|purchased|received|income|salary|transfer|move|moved|send|sent|gpay|upi|bank|account|cash|wallet|credit|card|savings|current|transaction|expense|note|memo|description)\b/gi, " ");
  const matchedTokens = new Set([
    ...sourceMatch.matchedTokens,
    ...creditMatch.matchedTokens,
    ...(fromClause ? matchAccountMention(fromClause, eligibleAccounts).matchedTokens : []),
    ...(toClause ? matchAccountMention(toClause, eligibleAccounts).matchedTokens : []),
  ]);
  matchedTokens.forEach((token) => {
    if (token) {
      narrative = narrative.replace(
        new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"),
        " ",
      );
    }
  });
  narrative = narrative
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:]+|[,.;:]+$/g, "")
    .trim();
  let trimmedNarrative;
  do {
    trimmedNarrative = narrative;
    narrative = narrative
      .replace(/^(?:(?:at|for|to|on|in|with|and|the|a|an)\s+)+/i, "")
      .replace(/(?:\s+(?:at|for|to|on|in|with|and|the|a|an))+$/i, "")
      .trim();
  } while (narrative !== trimmedNarrative);

  if (narrative) {
    narrative = narrative.charAt(0).toUpperCase() + narrative.slice(1);
  }

  const result = {
    amount,
    type,
    accountId: resolvedSourceAccountId,
    accountExplicit: Boolean(cardAccount || contextualSource || mentionedAccount),
    accountAmbiguous,
    destinationAmbiguous,
    categoryId: matchedCat?.id || "cat_other",
    subcategory: matchedSub,
    description: narrative,
  };
  if (toAccountId) result.toAccountId = toAccountId;
  if (timeMatch) result.time = parseMagicTime(text);
  if (isoDateMatch) result.date = isoDateMatch[0];
  else if (/\byesterday\b/i.test(text)) {
    const yesterday = parseLocalDateISO(getTodayISO());
    yesterday.setDate(yesterday.getDate() - 1);
    result.date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  } else if (/\btoday\b/i.test(text)) {
    result.date = getTodayISO();
  }
  return result;
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
  let emailAccepted = false;
  let deliveryError = "";

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
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Sign in to send this email.");
      }
      const response = await fetch("/api/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          Authorization: `Bearer ${idToken}`,
        },
        body: payloadStr,
      });
      if (!response.ok) {
        let responseError = "";
        try {
          const result = await response.json();
          if (typeof result.error === "string") {
            responseError = result.error.slice(0, 200);
          }
        } catch {
          // Use the status below when the endpoint does not return JSON.
        }
        throw new Error(
          responseError || `Email service returned HTTP ${response.status}.`,
        );
      }
      emailAccepted = true;
    } catch (error) {
      console.error("Email delivery failed:", error);
      deliveryError =
        error instanceof Error
          ? error.message
          : "Email delivery failed. Check the email service configuration.";
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

  return {
    accepted: emailAccepted,
    error:
      deliveryError ||
      (emailAccepted ? "" : "No recipient email address is configured."),
  };
}

function getNextPaymentDateInfo(cc = {}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let recurringDay = Number(cc.billDueDay) || 0;
  if (cc.billDueDate && /^\d{4}-\d{2}-\d{2}$/.test(cc.billDueDate)) {
    recurringDay = Number(cc.billDueDate.split("-")[2]) || recurringDay;
  }
  if (recurringDay < 1 || recurringDay > 31) {
    return {
      recurringDay: null,
      nextDueISO: "",
      nextDueLabel: "Not set",
      isDueToday: false,
      isOnOrBeforeDue: false,
    };
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
    emergencyReserve = {},
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
      if (tx.accountId === "liquid_mf") {
        liquidMfBalance = Number((liquidMfBalance - amt).toFixed(2));
      } else if (acc && !acc.isLiability) {
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
  computedAccounts.forEach((account) => {
    account.grossBalance = account.currentBalance;
  });
  const liquidMfGrossBalance = liquidMfBalance;
  const bankAccounts = computedAccounts.filter((a) => a.isBank);
  const configuredReserveAmount = Math.max(
    0,
    Number(emergencyReserve.amount) || 0,
  );
  const reserveSourceAccount =
    emergencyReserve.sourceAccountId === "liquid_mf"
      ? null
      : accountMap[emergencyReserve.sourceAccountId];
  const reserveSourceBalance =
    emergencyReserve.sourceAccountId === "liquid_mf"
      ? liquidMfGrossBalance
      : reserveSourceAccount?.grossBalance || 0;
  const emergencyReserveBalance = Math.min(
    configuredReserveAmount,
    Math.max(0, reserveSourceBalance),
  );
  const emergencyReserveShortfall = Number(
    (configuredReserveAmount - emergencyReserveBalance).toFixed(2),
  );
  if (emergencyReserve.sourceAccountId === "liquid_mf") {
    liquidMfBalance = Number(
      (liquidMfBalance - emergencyReserveBalance).toFixed(2),
    );
  } else if (reserveSourceAccount) {
    reserveSourceAccount.reservedAmount = emergencyReserveBalance;
    reserveSourceAccount.currentBalance = Number(
      (reserveSourceAccount.currentBalance - emergencyReserveBalance).toFixed(2),
    );
  }
  const emergencyReserveSourceBalance = Math.max(0, reserveSourceBalance);

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
    const limit = Math.max(0, Number(cc.creditLimit) || 0);
    const thresholdPct = Math.max(0, Number(cc.alertThresholdPct) || 0);
    const thresholdAmt = (limit * thresholdPct) / 100;
    const used = Math.max(0, Number(cc.currentBalance.toFixed(2)));
    const utilizationPct =
      limit > 0 ? Number(((used / limit) * 100).toFixed(1)) : 0;
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
      isExceeded: thresholdAmt > 0 && used >= thresholdAmt && used > 0,
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

  const monthlySavings = Number(
    (allSpendableLiquidBalance + liquidMfBalance).toFixed(2),
  );
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
    emergencyReserveBalance +
    totalInvestmentValue +
    totalGoalsSaved;
  const totalLiabilities = totalCreditCardDebt;
  const netWorth = totalAssets - totalLiabilities;

  return {
    computedAccounts,
    bankAccounts,
    selectedBankBalance,
    allSpendableLiquidBalance,
    liquidMfBalance,
    emergencyReserveBalance,
    emergencyReserveShortfall,
    emergencyReserveSourceBalance,
    liquidMfGrossBalance,
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
