# Event Resolver API

Resolve real-world events for prediction market settlement. Aggregates data from multiple sources to determine if an event occurred, with confidence scores and source attribution.

## What It Does / Endpoints

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/resolve` | POST | $0.005 | Full event resolution with confidence score and sources |
| `/api/verify` | POST | $0.003 | Quick-verify a factual claim (true/false/unverifiable) |
| `/api/price-check` | POST | $0.002 | Check if crypto price crossed a threshold |

## Example Request/Response

### POST /api/resolve

```bash
curl -X POST https://event-resolver-production.up.railway.app/api/resolve \
  -H "Content-Type: application/json" \
  -d '{"question": "Did BTC reach $100K?", "type": "binary"}'
```

Response:
```json
{
  "question": "Did BTC reach $100K?",
  "resolved": true,
  "outcome": "Yes",
  "confidence": 95,
  "sources": [
    {
      "name": "CoinGecko",
      "url": "https://www.coingecko.com/en/coins/bitcoin",
      "agrees": true
    }
  ],
  "timestamp": "2026-04-13T12:00:00.000Z",
  "type": "binary"
}
```

### POST /api/verify

```bash
curl -X POST https://event-resolver-production.up.railway.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{"claim": "Bitcoin is above $90,000"}'
```

Response:
```json
{
  "claim": "Bitcoin is above $90,000",
  "verdict": "true",
  "confidence": 95,
  "evidence": [
    "bitcoin current price: $102,450 (via CoinGecko)",
    "Threshold $90,000 above: crossed"
  ]
}
```

### POST /api/price-check

```bash
curl -X POST https://event-resolver-production.up.railway.app/api/price-check \
  -H "Content-Type: application/json" \
  -d '{"asset": "bitcoin", "threshold": 100000, "direction": "above"}'
```

Response:
```json
{
  "asset": "bitcoin",
  "currentPrice": 102450.23,
  "threshold": 100000,
  "direction": "above",
  "crossed": true,
  "crossedAt": "2026-04-13T12:00:00.000Z",
  "timestamp": "2026-04-13T12:00:00.000Z"
}
```

## Use Cases

- **Prediction market settlement** -- Automated oracle for resolving binary, numeric, and categorical outcomes on-chain
- **Fact checking** -- Quick verification of claims with confidence scores and source attribution
- **Price monitoring** -- Check if crypto assets crossed key price thresholds for contract settlement
- **Event tracking** -- Determine if real-world events (elections, sports, policy changes) occurred
- **On-chain resolution** -- Provide objective data for HIP-4, Polymarket, or custom smart contract settlement

## MCP Integration

Add to your Claude Desktop or Cursor config:

```json
{
  "mcpServers": {
    "event-resolver": {
      "url": "https://event-resolver-production.up.railway.app/sse"
    }
  }
}
```

## Payment

All endpoints use x402 protocol -- pay-per-call with USDC on Base L2. No API keys, no subscriptions. Your agent pays automatically.

## Related APIs

- [Token Price API](https://github.com/Br0ski777/token-price-x402) -- Get crypto token prices without resolution logic
- [Prediction Markets API](https://github.com/Br0ski777/prediction-markets-x402) -- List prediction market odds and contracts
- [Research Fact Check API](https://github.com/Br0ski777/research-fact-check-x402) -- Deep fact checking with full source citations
- [Trust Score API](https://github.com/Br0ski777/trust-score-x402) -- Evaluate trustworthiness of domains and wallets
- [Stock Quote API](https://github.com/Br0ski777/stock-quote-x402) -- Real-time stock price quotes
