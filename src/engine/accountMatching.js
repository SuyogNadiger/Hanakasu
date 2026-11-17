const GENERIC_WORDS = new Set([
  "account",
  "and",
  "bank",
  "card",
  "cash",
  "credit",
  "current",
  "my",
  "of",
  "savings",
  "the",
  "wallet",
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getAliases(account) {
  const aliases = [account.name, account.nickname, account.brand]
    .map(normalize)
    .filter((alias) => alias && !GENERIC_WORDS.has(alias));
  const acronyms = aliases
    .map((alias) =>
      alias
        .split(" ")
        .filter((word) => !["and", "of", "the"].includes(word))
        .map((word) => word[0])
        .join(""),
    )
    .filter((alias) => alias.length >= 3);
  return [...new Set([...aliases, ...acronyms])];
}

function createMatch(account, alias, ambiguous = false) {
  return {
    account,
    ambiguous,
    matchedTokens: alias ? normalize(alias).split(" ") : [],
  };
}

export function matchAccountMention(text, accounts = []) {
  const normalizedText = normalize(text);
  if (!normalizedText) return createMatch(null, "");

  const paddedText = ` ${normalizedText} `;
  const exactMatches = [];
  accounts.forEach((account) => {
    getAliases(account).forEach((alias) => {
      const position = paddedText.indexOf(` ${alias} `);
      if (position >= 0) exactMatches.push({ account, alias, position });
    });
  });

  if (exactMatches.length) {
    exactMatches.sort((a, b) => a.position - b.position || b.alias.length - a.alias.length);
    const best = exactMatches[0];
    const bestAccounts = new Map(
      exactMatches
        .filter(
          (match) =>
            match.position === best.position && match.alias.length === best.alias.length,
        )
        .map((match) => [match.account.id, match]),
    );
    if (bestAccounts.size === 1) {
      const match = bestAccounts.values().next().value;
      return createMatch(match.account, match.alias);
    }
    return createMatch(null, "", true);
  }

  const inputWords = new Set(normalizedText.split(" "));
  const scoredMatches = accounts
    .map((account) => {
      const aliasWords = new Set(
        getAliases(account).flatMap((alias) =>
          alias.split(" ").filter((word) => word.length >= 3 && !GENERIC_WORDS.has(word)),
        ),
      );
      const matchedTokens = [...aliasWords].filter((word) =>
        [...inputWords].some(
          (inputWord) =>
            inputWord === word || (inputWord.length >= 4 && word.startsWith(inputWord)),
        ),
      );
      return { account, matchedTokens, score: matchedTokens.length };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scoredMatches.length) return createMatch(null, "");
  const bestScore = scoredMatches[0].score;
  const bestMatches = scoredMatches.filter((match) => match.score === bestScore);
  if (bestMatches.length !== 1) return createMatch(null, "", true);
  return {
    account: bestMatches[0].account,
    ambiguous: false,
    matchedTokens: bestMatches[0].matchedTokens,
  };
}
