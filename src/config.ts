import type { ApiConfig } from "./shared.ts";

export const API_CONFIG: ApiConfig = {
  name: "Event Resolver API",
  slug: "event-resolver",
  description: "Resolve prediction market events with confidence scores. Aggregates news, price feeds, and web data to determine if real-world events occurred. Settlement oracle for binary, numeric, and categorical outcomes.",
  version: "1.0.0",
  routes: [
    {
      method: "POST",
      path: "/api/resolve",
      price: "$0.005",
      description: "Resolve a prediction market event/question. Aggregates multiple data sources to determine outcome with confidence score.",
      toolName: "event_resolve_outcome",
      toolDescription:
        `Use this when you need to determine the outcome of a real-world event for prediction market settlement. Takes a natural language question (e.g. "Did BTC reach $100K?", "Did France win the 2026 World Cup?") and returns a structured resolution with confidence score.

1. question: the original question being resolved
2. resolved: whether the event can be conclusively determined (true/false)
3. outcome: the determined result -- "Yes"/"No" for binary, a number for numeric, or a category string
4. confidence: 0-100 score indicating certainty of the resolution
5. sources: array of data sources consulted, each with name, url, and whether it agrees with the outcome
6. timestamp: ISO timestamp of when the resolution was performed

Example output: { "question": "Did BTC reach $100K?", "resolved": true, "outcome": "Yes", "confidence": 95, "sources": [{ "name": "CoinGecko", "url": "https://coingecko.com", "agrees": true }], "timestamp": "2026-04-13T12:00:00Z" }

Use this when settling prediction market contracts, verifying event outcomes for on-chain resolution, or building automated settlement oracles. Handles price-based questions via CoinGecko and general questions via web search aggregation.

Do NOT use for prediction market odds -- use prediction_list_markets instead. Do NOT use for crypto prices only -- use token_get_price instead. Do NOT use for full fact checking with sources -- use research_check_fact instead. Do NOT use for trust/security scoring -- use trust_score_evaluate instead.`,
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The event question to resolve, e.g. 'Did BTC reach $100K by April 2026?' or 'Did the Lakers win the NBA Finals 2026?'",
          },
          type: {
            type: "string",
            enum: ["binary", "numeric", "categorical"],
            description: "Type of resolution expected. binary = Yes/No, numeric = a number, categorical = one of several options. Default: binary.",
          },
        },
        required: ["question"],
      },
    },
    {
      method: "POST",
      path: "/api/verify",
      price: "$0.003",
      description: "Quick-verify a factual claim. Returns verdict (true/false/unverifiable) with confidence and evidence.",
      toolName: "event_verify_claim",
      toolDescription:
        `Use this when you need to quickly verify whether a factual claim is true or false. Simpler and cheaper than full event resolution -- designed for fast claim checking without structured market settlement.

1. claim: the original claim being verified
2. verdict: "true", "false", or "unverifiable" if insufficient data
3. confidence: 0-100 score indicating certainty of the verdict
4. evidence: array of strings summarizing supporting or contradicting evidence found

Example output: { "claim": "Tesla stock is above $300", "verdict": "true", "confidence": 90, "evidence": ["CoinGecko/financial APIs confirm current price above threshold", "Multiple news sources corroborate"] }

Use this for quick fact-checking before making decisions, verifying claims in conversation, or pre-screening questions before full resolution. Faster and cheaper than event_resolve_outcome for simple true/false checks.

Do NOT use for prediction market odds -- use prediction_list_markets instead. Do NOT use for full fact checking with sources -- use research_check_fact instead. Do NOT use for stock prices -- use stock_get_quote instead. Do NOT use for crypto prices only -- use token_get_price instead.`,
      inputSchema: {
        type: "object",
        properties: {
          claim: {
            type: "string",
            description: "The factual claim to verify, e.g. 'Bitcoin is above $90,000' or 'The US unemployment rate is below 4%'",
          },
        },
        required: ["claim"],
      },
    },
    {
      method: "POST",
      path: "/api/price-check",
      price: "$0.002",
      description: "Check if a crypto/stock price crossed a threshold. Common prediction market resolution pattern.",
      toolName: "event_check_price_threshold",
      toolDescription:
        `Use this when you need to check if a cryptocurrency or stock price has crossed a specific threshold -- the most common resolution type in prediction markets. Returns current price, whether threshold was crossed, and direction.

1. asset: the asset being checked (e.g. "bitcoin", "ethereum", "solana")
2. currentPrice: the current price in USD from CoinGecko
3. threshold: the target price threshold
4. direction: "above" or "below" -- which direction constitutes crossing
5. crossed: boolean indicating whether the price has crossed the threshold in the specified direction

Example output: { "asset": "bitcoin", "currentPrice": 102450.23, "threshold": 100000, "direction": "above", "crossed": true }

Use this for settling price-based prediction market contracts, monitoring price milestones, or triggering alerts when assets cross key levels. Uses CoinGecko free API for crypto prices (no auth required).

Do NOT use for crypto prices only -- use token_get_price instead. Do NOT use for prediction market odds -- use prediction_list_markets instead. Do NOT use for stock prices -- use stock_get_quote instead. Do NOT use for trust/security scoring -- use trust_score_evaluate instead.`,
      inputSchema: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            description: "Asset name or CoinGecko ID (e.g. 'bitcoin', 'ethereum', 'solana', 'dogecoin')",
          },
          threshold: {
            type: "number",
            description: "Price threshold in USD to check against",
          },
          direction: {
            type: "string",
            enum: ["above", "below"],
            description: "Whether to check if price is above or below the threshold",
          },
        },
        required: ["asset", "threshold", "direction"],
      },
    },
  ],
};
