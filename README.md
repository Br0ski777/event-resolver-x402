# Event Resolver API

[![MCP Server](https://img.shields.io/badge/MCP-server-blue)](https://event-resolver.api.klymax402.com/mcp)
[![x402](https://img.shields.io/badge/payments-x402-6E56CF)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Resolve prediction market events with confidence scores. Aggregates news, price feeds, and web data to determine if real-world events occurred. Settlement oracle for binary, numeric, and categorical outcomes. Pay-per-call via [x402](https://x402.org) (USDC on Base L2) -- no API key, no signup, no rate-limit wall.

Part of the [klymax402](https://klymax402.com) marketplace -- 100 x402 micropayment APIs for AI agents, one wallet, USDC on Base.

## Quickstart -- MCP

Add to your MCP client config (Claude Desktop, Cursor, ElizaOS, etc.):

```json
{
  "mcpServers": {
    "event-resolver": {
      "url": "https://event-resolver.api.klymax402.com/mcp"
    }
  }
}
```

## Quickstart -- HTTP (x402)

```bash
curl -X POST "https://event-resolver.api.klymax402.com/api/resolve" \
  -H "Content-Type: application/json" \
  -d '{"question":"..."}'
# -> 402 Payment Required, with an x402 payment challenge in the response body
```

Any x402-aware client ([`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch), [`x402-agent-tools`](https://www.npmjs.com/package/x402-agent-tools), ATXP) handles the 402 -> sign -> retry cycle automatically.

## Tools

| Tool | Method | Path | Price | Description |
|---|---|---|---|---|
| `event_resolve_outcome` | POST | `/api/resolve` | $0.012 | Resolve a prediction market event/question. Aggregates multiple data sources to determine outcome with confidence score. |
| `event_verify_claim` | POST | `/api/verify` | $0.008 | Quick-verify a factual claim. Returns verdict (true/false/unverifiable) with confidence and evidence. |
| `event_check_price_threshold` | POST | `/api/price-check` | $0.005 | Check if a crypto/stock price crossed a threshold. Common prediction market resolution pattern. |

### `event_resolve_outcome`

Use this when you need to determine the outcome of a real-world event for prediction market settlement. Takes a natural language question (e.g. "Did BTC reach $100K?", "Did France win the 2026 World Cup?") and returns a structured resolution with confidence score.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `question` | string | yes | The event question to resolve, e.g. 'Did BTC reach $100K by April 2026?' or 'Did the Lakers win the NBA Finals 2026?' |
| `type` | string | no | Type of resolution expected. binary = Yes/No, numeric = a number, categorical = one of several options. Default: binary. |

**Returns**

- `question` -- the original question being resolved
- `resolved` -- whether the event can be conclusively determined (true/false)
- `outcome` -- the determined result -- "Yes"/"No" for binary, a number for numeric, or a category string
- `confidence` -- 0-100 score indicating certainty of the resolution
- `sources` -- array of data sources consulted, each with name, url, and whether it agrees with the outcome
- `timestamp` -- ISO timestamp of when the resolution was performed

Example response:

```json
{ "question": "Did BTC reach $100K?", "resolved": true, "outcome": "Yes", "confidence": 95, "sources": [{ "name": "CoinGecko", "url": "https://coingecko.com", "agrees": true }], "timestamp": "2026-04-13T12:00:00Z" }
```

**Not for**: prediction market odds (use `prediction_list_markets`), crypto prices only (use `token_get_price`), full fact checking with sources (use `research_check_fact`), trust/security scoring (use `trust_score_evaluate`).

### `event_verify_claim`

Use this when you need to quickly verify whether a factual claim is true or false. Simpler and cheaper than full event resolution -- designed for fast claim checking without structured market settlement.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `claim` | string | yes | The factual claim to verify, e.g. 'Bitcoin is above $90,000' or 'The US unemployment rate is below 4%' |

**Returns**

- `claim` -- the original claim being verified
- `verdict` -- "true", "false", or "unverifiable" if insufficient data
- `confidence` -- 0-100 score indicating certainty of the verdict
- `evidence` -- array of strings summarizing supporting or contradicting evidence found

Example response:

```json
{ "claim": "Tesla stock is above $300", "verdict": "true", "confidence": 90, "evidence": ["CoinGecko/financial APIs confirm current price above threshold", "Multiple news sources corroborate"] }
```

**Not for**: prediction market odds (use `prediction_list_markets`), full fact checking with sources (use `research_check_fact`), stock prices (use `stock_get_quote`), crypto prices only (use `token_get_price`).

### `event_check_price_threshold`

Use this when you need to check if a cryptocurrency or stock price has crossed a specific threshold -- the most common resolution type in prediction markets. Returns current price, whether threshold was crossed, and direction.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `asset` | string | yes | Asset name or CoinGecko ID (e.g. 'bitcoin', 'ethereum', 'solana', 'dogecoin') |
| `threshold` | number | yes | Price threshold in USD to check against |
| `direction` | string | yes | Whether to check if price is above or below the threshold |

**Returns**

- `asset` -- the asset being checked (e.g. "bitcoin", "ethereum", "solana")
- `currentPrice` -- the current price in USD from CoinGecko
- `threshold` -- the target price threshold
- `direction` -- "above" or "below" -- which direction constitutes crossing
- `crossed` -- boolean indicating whether the price has crossed the threshold in the specified direction

Example response:

```json
{ "asset": "bitcoin", "currentPrice": 102450.23, "threshold": 100000, "direction": "above", "crossed": true }
```

**Not for**: crypto prices only (use `token_get_price`), prediction market odds (use `prediction_list_markets`), stock prices (use `stock_get_quote`), trust/security scoring (use `trust_score_evaluate`).

## Example agent prompts

- "Determine the outcome of a real-world event for prediction market settlement"
- "Quickly verify whether a factual claim is true or false"
- "Check if a cryptocurrency or stock price has crossed a specific threshold -- the most common resolution type in prediction markets"

## Payment

- Protocol: [x402](https://x402.org) -- HTTP-native pay-per-call, no signup, no API key
- Network: Base L2 (`eip155:8453`)
- Asset: USDC
- Facilitator: Coinbase CDP (primary), PayAI (fallback)
- Also reachable via [ATXP](https://atxp.ai) (OAuth-wrapped x402, RFC 9728 protected-resource metadata)

## Part of klymax402

100 x402 micropayment APIs for AI agents -- one wallet, USDC on Base, zero signup.

- Catalog: https://klymax402.com/llms.txt
- Full API reference: https://klymax402.com/llms-full.txt
- Live stats: https://klymax402.com/stats

## License

MIT
