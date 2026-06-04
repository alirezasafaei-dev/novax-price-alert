# Providers

## Why Provider Normalization Exists

Price data can come from different sources with different:

- field names
- timestamp formats
- currencies
- symbol conventions
- payload structures
- reliability characteristics

The application should not allow these differences to leak into domain logic.  
Normalization creates a stable contract for the rest of the system.

## Provider Abstraction Model

Each provider integration should implement a simple base contract:

- identify itself
- fetch price data
- return normalized records
- expose raw payload when useful for auditing/debugging

The application should consume normalized provider output, not provider-specific schemas.

## Normalized Output Contract

Recommended output shape:

```python
[
  {
    "asset_code": "USDT",
    "price_value": Decimal("652000"),
    "currency_code": "IRT",
    "fetched_at": datetime,
    "raw_payload": {...}
  }
]

Core rules:

- `asset_code` must map to a known internal asset
- `price_value` must be normalized numeric data
- `currency_code` must be explicit
- `fetched_at` should represent source fetch time or normalization time
- `raw_payload` is optional but recommended

## Mock Provider Role in MVP

The mock provider is essential for:

- local development
- testing
- deterministic behavior
- decoupling domain work from real provider readiness

Mock provider should:
- return stable known assets
- return plausible values
- be easy to enable by config

## Provider Priority and Fallback

The `Provider` model includes priority to support future decisions such as:

- preferred source selection
- fallback ordering
- multi-source resilience

For MVP:
- a single active provider is enough
- fallback behavior can remain simple or deferred

## Data Quality Concerns

Provider data may be:

- stale
- malformed
- inconsistent
- delayed
- duplicated

The normalization layer should therefore:

- validate records
- skip invalid values
- log provider-specific issues
- avoid corrupting latest price state with obviously invalid data

## Timestamp Semantics

Two timestamps matter:

### `fetched_at`
Represents the time associated with the observed price.

### database write time
Represents when the app persisted the value.

These should not be conflated if provider timestamps are meaningful.

## Currency Semantics

Each price must declare its currency explicitly.

For MVP, typical currency may be `IRT`, but the system should not assume all providers or assets share the same quote currency forever.

## Future Support for Multiple Real Providers

Post-MVP opportunities:

- source comparison
- best-provider selection
- provider health scoring
- quorum/consensus strategies
- fallback provider activation
- historical provider accuracy analysis

## Freshness Contract for Alerts

Alert evaluation must be freshness-aware. A provider response is usable for triggering only when the runtime can identify it as fresh for the current evaluation window. If a provider batch is unavailable, empty, malformed, or missing the requested asset price, the evaluator/Worker must skip the alert and log `stale_data_detected` with a reason such as:

- `crypto_prices_unavailable`
- `iran_market_prices_unavailable`
- `asset_price_missing`

Operators should verify that no notification is sent after `stale_data_detected` for the same `alert_id` and run. Existing latest prices should not be overwritten with empty/fabricated provider values, and stale values should not be used to satisfy alert conditions during rollout.
