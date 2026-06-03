# Asset Identity Policy (T-001)

Status: **Frozen** (Phase 0 — Contract Freeze).
Source of truth for how assets are named, stored, mapped to providers, and displayed.

This document describes the **implemented** behavior, not aspirational values. Where the
`HARDENING_IMPLEMENTATION_GUIDE.md` examples differ, this policy wins and the differences
are called out explicitly.

## Canonical identifier

- Every asset has a canonical ID of the form `{market}:{SYMBOL}`.
- `market` ∈ `crypto` | `fiat` | `gold`.
- The canonical ID is the only value used for backend logic, evaluation, and delivery.
- Worker source of truth: `deploy/cloudflare-worker/src/asset-catalog.js`
  (`canonicalAssetId(market, symbol)` → `` `${market}:${symbol}` ``).
- Backend source of truth: `AlertRule.asset_id` stores the canonical identifier; see
  `docs/ALERT_HARDENING_CONTRACTS.md` ("Asset identity").

> Note: the guide example used IDs like `btc`, `gold_18k`. The frozen scheme is the
> market-prefixed form already in code (`crypto:BTC`, `gold:GOLD_18K`).

## Supported assets (frozen catalog)

| Canonical ID        | Market | Symbol        | Display name (fa)        | Unit  |
|---------------------|--------|---------------|--------------------------|-------|
| `crypto:BTC`        | crypto | BTC           | بیت‌کوین (BTC)            | USDT  |
| `crypto:ETH`        | crypto | ETH           | اتریوم (ETH)             | USDT  |
| `crypto:SOL`        | crypto | SOL           | سولانا (SOL)             | USDT  |
| `crypto:BNB`        | crypto | BNB           | بایننس کوین (BNB)        | USDT  |
| `fiat:USD`          | fiat   | USD           | دلار (USD)               | تومان |
| `fiat:EUR`          | fiat   | EUR           | یورو (EUR)               | تومان |
| `gold:GOLD_18K`     | gold   | GOLD_18K      | طلای ۱۸ عیار             | تومان |
| `gold:SEKKEH_EMAMI` | gold   | SEKKEH_EMAMI  | سکه امامی                | تومان |

The catalog above mirrors `ASSETS` in `asset-catalog.js`. Adding an asset means adding an
entry there (and the corresponding backend `Asset`/provider mapping) — never hardcoding a
raw provider symbol elsewhere.

## Display name

- Standard format: `{Display Name} ({SYMBOL})` for crypto/fiat (e.g. `بیت‌کوین (BTC)`).
- Gold assets use a Persian display name without a Latin symbol (`طلای ۱۸ عیار`, `سکه امامی`).
- Display names are **snapshots, not identifiers**. Alert creation stores
  `display_asset_name_at_creation` so later catalog edits never rewrite an existing alert's
  audit trail (see `ALERT_HARDENING_CONTRACTS.md`).

## Aliases

Aliases are accepted for search/typed input only; they never replace the canonical ID.
Current aliases (from `asset-catalog.js`):

- `crypto:BTC`: `bitcoin`, `btc`, `بیت کوین`
- `crypto:ETH`: `ethereum`, `eth`, `اتر`
- `crypto:SOL`: `solana`, `sol`
- `crypto:BNB`: `binance coin`, `bnb`
- `fiat:USD`: `usd`, `dollar`, `دلار`
- `fiat:EUR`: `eur`, `euro`, `یورو`
- `gold:GOLD_18K`: `gold_18k`, `geram18`, `طلای ۱۸`
- `gold:SEKKEH_EMAMI`: `sekee`, `سکه`, `امامی`

## Provider mapping

| Canonical ID        | Provider | Provider key / symbol         |
|---------------------|----------|-------------------------------|
| `crypto:BTC`        | Binance  | `BTCUSDT`                     |
| `crypto:ETH`        | Binance  | `ETHUSDT`                     |
| `crypto:SOL`        | Binance  | `SOLUSDT`                     |
| `crypto:BNB`        | Binance  | `BNBUSDT`                     |
| `fiat:USD`          | TGJU     | `price_dollar_rl`             |
| `fiat:EUR`          | TGJU     | `price_eur`                   |
| `gold:GOLD_18K`     | TGJU     | `geram18`                     |
| `gold:SEKKEH_EMAMI` | TGJU     | `sekee`                       |

Provider details and fallbacks: `docs/PROVIDERS.md` and
`deploy/cloudflare-worker/src/prices.js`. Binance prices are in USDT; TGJU values are
comma-separated rial strings (÷10 → تومان).

## Acceptance criteria (T-001)

- [x] A single definition exists for asset naming (`{market}:{SYMBOL}`).
- [x] Canonical IDs are decoupled from provider symbols via an explicit mapping.
- [x] Display names are snapshotted at alert creation and never used as identifiers.
- [x] Allowed aliases are documented and non-authoritative.
