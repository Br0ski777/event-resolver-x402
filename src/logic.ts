import type { Hono } from "hono";

// ─── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry { data: any; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 120_000; // 2 min (fresher data for event resolution)

function cached<T>(key: string): T | null {
  const e = cache.get(key);
  return e && Date.now() - e.ts < CACHE_TTL ? (e.data as T) : null;
}
function setCache(key: string, data: any) { cache.set(key, { data, ts: Date.now() }); }

// ─── CoinGecko Helpers ─────────────────────────────────────────────────────

const COINGECKO_ALIASES: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
  doge: "dogecoin",
  ada: "cardano",
  xrp: "ripple",
  dot: "polkadot",
  matic: "polygon",
  avax: "avalanche-2",
  link: "chainlink",
  uni: "uniswap",
  atom: "cosmos",
  near: "near",
  bnb: "binancecoin",
  ltc: "litecoin",
  shib: "shiba-inu",
  arb: "arbitrum",
  op: "optimism",
  apt: "aptos",
  sui: "sui",
};

function normalizeCoinId(asset: string): string {
  const lower = asset.toLowerCase().trim();
  return COINGECKO_ALIASES[lower] || lower;
}

async function getCryptoPrice(coinId: string): Promise<{ price: number; name: string } | null> {
  const cacheKey = `price_${coinId}`;
  const c = cached<{ price: number; name: string }>(cacheKey);
  if (c) return c;

  try {
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) return null;
    const data = await resp.json() as Record<string, { usd: number }>;
    if (!data[coinId]?.usd) return null;
    const result = { price: data[coinId].usd, name: coinId };
    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ─── DuckDuckGo Instant Answer ─────────────────────────────────────────────

interface DDGResult {
  abstract: string;
  abstractSource: string;
  abstractURL: string;
  relatedTopics: { text: string; firstURL: string }[];
  answer: string;
  heading: string;
}

async function searchDDG(query: string): Promise<DDGResult | null> {
  const cacheKey = `ddg_${query}`;
  const c = cached<DDGResult>(cacheKey);
  if (c) return c;

  try {
    const resp = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const result: DDGResult = {
      abstract: data.Abstract || "",
      abstractSource: data.AbstractSource || "",
      abstractURL: data.AbstractURL || "",
      relatedTopics: (data.RelatedTopics || [])
        .filter((t: any) => t.Text)
        .slice(0, 5)
        .map((t: any) => ({ text: t.Text, firstURL: t.FirstURL })),
      answer: data.Answer || "",
      heading: data.Heading || "",
    };
    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ─── Price Question Detector ───────────────────────────────────────────────

interface PriceQuestion {
  asset: string;
  threshold: number;
  direction: "above" | "below";
}

function parsePriceQuestion(question: string): PriceQuestion | null {
  const q = question.toLowerCase();

  // Match patterns like "Will BTC reach $100K", "Is ETH above $3000", "Did SOL hit 200"
  const reachPatterns = [
    /(?:will|did|has|is|can)\s+(\w+)\s+(?:reach|hit|cross|exceed|surpass|go above|break|top)\s+\$?([\d,]+\.?\d*)\s*k?\b/i,
    /(?:will|did|has|is)\s+(\w+)\s+(?:be|stay|remain)\s+(?:above|over)\s+\$?([\d,]+\.?\d*)\s*k?\b/i,
    /(\w+)\s+(?:above|over|exceed|surpass)\s+\$?([\d,]+\.?\d*)\s*k?\b/i,
  ];

  const belowPatterns = [
    /(?:will|did|has|is)\s+(\w+)\s+(?:drop|fall|go|dip)\s+(?:below|under)\s+\$?([\d,]+\.?\d*)\s*k?\b/i,
    /(?:will|did|has|is)\s+(\w+)\s+(?:be|stay|remain)\s+(?:below|under)\s+\$?([\d,]+\.?\d*)\s*k?\b/i,
    /(\w+)\s+(?:below|under)\s+\$?([\d,]+\.?\d*)\s*k?\b/i,
  ];

  for (const pattern of reachPatterns) {
    const match = q.match(pattern);
    if (match) {
      let threshold = parseFloat(match[2].replace(/,/g, ""));
      if (q.includes(match[2] + "k")) threshold *= 1000;
      return { asset: normalizeCoinId(match[1]), threshold, direction: "above" };
    }
  }

  for (const pattern of belowPatterns) {
    const match = q.match(pattern);
    if (match) {
      let threshold = parseFloat(match[2].replace(/,/g, ""));
      if (q.includes(match[2] + "k")) threshold *= 1000;
      return { asset: normalizeCoinId(match[1]), threshold, direction: "below" };
    }
  }

  return null;
}

// ─── Resolve Logic ─────────────────────────────────────────────────────────

interface Source {
  name: string;
  url: string;
  agrees: boolean;
}

interface ResolveResult {
  question: string;
  resolved: boolean;
  outcome: string | number;
  confidence: number;
  sources: Source[];
  timestamp: string;
  type: "binary" | "numeric" | "categorical";
}

async function resolveEvent(question: string, type: string = "binary"): Promise<ResolveResult> {
  const sources: Source[] = [];
  let outcome: string | number = "No";
  let confidence = 0;
  let resolved = false;

  // 1. Check if it's a price question
  const priceQ = parsePriceQuestion(question);
  if (priceQ) {
    const priceData = await getCryptoPrice(priceQ.asset);
    if (priceData) {
      const crossed = priceQ.direction === "above"
        ? priceData.price >= priceQ.threshold
        : priceData.price <= priceQ.threshold;

      outcome = type === "numeric" ? priceData.price : (crossed ? "Yes" : "No");
      confidence = 95; // Price data is highly reliable
      resolved = true;
      sources.push({
        name: "CoinGecko",
        url: `https://www.coingecko.com/en/coins/${priceQ.asset}`,
        agrees: crossed,
      });

      return {
        question,
        resolved,
        outcome,
        confidence,
        sources,
        timestamp: new Date().toISOString(),
        type: type as ResolveResult["type"],
      };
    }
  }

  // 2. Search web for the question
  const [ddgResult, ddgVerify] = await Promise.all([
    searchDDG(question),
    searchDDG(question + " result outcome"),
  ]);

  // Analyze DDG results
  if (ddgResult) {
    const allText = [
      ddgResult.abstract,
      ddgResult.answer,
      ddgResult.heading,
      ...ddgResult.relatedTopics.map(t => t.text),
    ].join(" ").toLowerCase();

    if (allText.length > 20) {
      // Look for affirmative/negative signals
      const yesSignals = ["yes", "won", "passed", "approved", "confirmed", "achieved", "succeeded", "completed", "true"];
      const noSignals = ["no", "lost", "failed", "rejected", "denied", "did not", "hasn't", "hasn't yet", "false"];

      let yesCount = 0;
      let noCount = 0;
      for (const signal of yesSignals) {
        if (allText.includes(signal)) yesCount++;
      }
      for (const signal of noSignals) {
        if (allText.includes(signal)) noCount++;
      }

      if (yesCount > noCount) {
        outcome = "Yes";
        confidence = Math.min(75, 40 + yesCount * 10);
        resolved = true;
      } else if (noCount > yesCount) {
        outcome = "No";
        confidence = Math.min(75, 40 + noCount * 10);
        resolved = true;
      } else if (allText.length > 50) {
        // Inconclusive but we have data
        outcome = "Unresolved";
        confidence = 30;
        resolved = false;
      }

      if (ddgResult.abstractURL) {
        sources.push({
          name: ddgResult.abstractSource || "DuckDuckGo",
          url: ddgResult.abstractURL,
          agrees: outcome === "Yes",
        });
      }

      for (const topic of ddgResult.relatedTopics.slice(0, 3)) {
        if (topic.firstURL) {
          sources.push({
            name: "Related Source",
            url: topic.firstURL,
            agrees: outcome === "Yes",
          });
        }
      }
    }
  }

  // Add verify search results
  if (ddgVerify && ddgVerify.abstractURL && ddgVerify.abstractURL !== ddgResult?.abstractURL) {
    sources.push({
      name: ddgVerify.abstractSource || "DuckDuckGo Verify",
      url: ddgVerify.abstractURL,
      agrees: outcome === "Yes",
    });
  }

  // If we still have no resolution, mark as unresolved with low confidence
  if (!resolved) {
    outcome = "Unresolved";
    confidence = Math.max(confidence, 10);
  }

  return {
    question,
    resolved,
    outcome,
    confidence,
    sources,
    timestamp: new Date().toISOString(),
    type: type as ResolveResult["type"],
  };
}

// ─── Verify Logic ──────────────────────────────────────────────────────────

interface VerifyResult {
  claim: string;
  verdict: "true" | "false" | "unverifiable";
  confidence: number;
  evidence: string[];
}

async function verifyClaim(claim: string): Promise<VerifyResult> {
  const evidence: string[] = [];
  let verdict: VerifyResult["verdict"] = "unverifiable";
  let confidence = 0;

  // Check if it's a price claim
  const priceQ = parsePriceQuestion(claim);
  if (priceQ) {
    const priceData = await getCryptoPrice(priceQ.asset);
    if (priceData) {
      const crossed = priceQ.direction === "above"
        ? priceData.price >= priceQ.threshold
        : priceData.price <= priceQ.threshold;

      verdict = crossed ? "true" : "false";
      confidence = 95;
      evidence.push(`${priceQ.asset} current price: $${priceData.price.toLocaleString()} (via CoinGecko)`);
      evidence.push(`Threshold $${priceQ.threshold.toLocaleString()} ${priceQ.direction}: ${crossed ? "crossed" : "not crossed"}`);

      return { claim, verdict, confidence, evidence };
    }
  }

  // Search DDG for the claim
  const ddgResult = await searchDDG(claim);

  if (ddgResult) {
    if (ddgResult.answer) {
      evidence.push(`Direct answer: ${ddgResult.answer}`);
      confidence += 30;
    }

    if (ddgResult.abstract) {
      evidence.push(`${ddgResult.abstractSource}: ${ddgResult.abstract.slice(0, 200)}`);
      confidence += 25;
    }

    for (const topic of ddgResult.relatedTopics.slice(0, 3)) {
      evidence.push(topic.text.slice(0, 150));
      confidence += 5;
    }

    const allText = [ddgResult.abstract, ddgResult.answer, ...ddgResult.relatedTopics.map(t => t.text)]
      .join(" ").toLowerCase();

    const yesSignals = ["yes", "true", "confirmed", "correct", "indeed", "verified", "accurate"];
    const noSignals = ["no", "false", "incorrect", "wrong", "denied", "debunked", "inaccurate", "myth"];

    let yesCount = 0;
    let noCount = 0;
    for (const s of yesSignals) { if (allText.includes(s)) yesCount++; }
    for (const s of noSignals) { if (allText.includes(s)) noCount++; }

    if (yesCount > noCount && confidence >= 20) {
      verdict = "true";
      confidence = Math.min(80, confidence + yesCount * 5);
    } else if (noCount > yesCount && confidence >= 20) {
      verdict = "false";
      confidence = Math.min(80, confidence + noCount * 5);
    } else if (confidence >= 20) {
      verdict = "unverifiable";
      confidence = Math.min(50, confidence);
    }
  }

  if (evidence.length === 0) {
    evidence.push("No sufficient data found to verify this claim");
  }

  return { claim, verdict, confidence: Math.min(100, confidence), evidence };
}

// ─── Price Check Logic ─────────────────────────────────────────────────────

interface PriceCheckResult {
  asset: string;
  currentPrice: number;
  threshold: number;
  direction: "above" | "below";
  crossed: boolean;
  crossedAt?: string;
  timestamp: string;
}

async function checkPriceThreshold(
  asset: string,
  threshold: number,
  direction: "above" | "below"
): Promise<PriceCheckResult> {
  const coinId = normalizeCoinId(asset);
  const priceData = await getCryptoPrice(coinId);

  if (!priceData) {
    throw new Error(`Could not fetch price for asset: ${asset} (tried CoinGecko ID: ${coinId})`);
  }

  const crossed = direction === "above"
    ? priceData.price >= threshold
    : priceData.price <= threshold;

  return {
    asset: coinId,
    currentPrice: priceData.price,
    threshold,
    direction,
    crossed,
    ...(crossed ? { crossedAt: new Date().toISOString() } : {}),
    timestamp: new Date().toISOString(),
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export function registerRoutes(app: Hono) {
  // POST /api/resolve -- Resolve a prediction market event
  app.post("/api/resolve", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.question) {
      return c.json({ error: "Missing required field: question" }, 400);
    }

    const question: string = body.question.trim();
    const type: string = body.type || "binary";

    if (question.length < 5 || question.length > 500) {
      return c.json({ error: "Question must be between 5 and 500 characters" }, 400);
    }

    if (!["binary", "numeric", "categorical"].includes(type)) {
      return c.json({ error: "Type must be one of: binary, numeric, categorical" }, 400);
    }

    try {
      const result = await resolveEvent(question, type);
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: `Resolution failed: ${e.message}` }, 500);
    }
  });

  // POST /api/verify -- Quick verify a factual claim
  app.post("/api/verify", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.claim) {
      return c.json({ error: "Missing required field: claim" }, 400);
    }

    const claim: string = body.claim.trim();

    if (claim.length < 5 || claim.length > 500) {
      return c.json({ error: "Claim must be between 5 and 500 characters" }, 400);
    }

    try {
      const result = await verifyClaim(claim);
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: `Verification failed: ${e.message}` }, 500);
    }
  });

  // POST /api/price-check -- Check if price crossed threshold
  app.post("/api/price-check", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.asset || body?.threshold === undefined || !body?.direction) {
      return c.json({ error: "Missing required fields: asset, threshold, direction" }, 400);
    }

    const asset: string = body.asset.trim();
    const threshold: number = Number(body.threshold);
    const direction: string = body.direction;

    if (isNaN(threshold) || threshold <= 0) {
      return c.json({ error: "Threshold must be a positive number" }, 400);
    }

    if (!["above", "below"].includes(direction)) {
      return c.json({ error: "Direction must be 'above' or 'below'" }, 400);
    }

    try {
      const result = await checkPriceThreshold(asset, threshold, direction as "above" | "below");
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: `Price check failed: ${e.message}` }, 500);
    }
  });
}
