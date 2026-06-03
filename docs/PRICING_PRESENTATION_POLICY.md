# Pricing Presentation Policy (T-002)

Status: **Frozen** (Phase 0 — Contract Freeze).
Source of truth for how prices are parsed, normalized, stored, and displayed.

This document reflects the **implemented** behavior. Where it differs from the example in
`HARDENING_IMPLEMENTATION_GUIDE.md` (which assumed "Toman everywhere"), this policy wins.

## Display unit is per-market (not always Toman)

The primary user-facing unit depends on the asset's market:

| Market | Display unit | Rationale                                   |
|--------|--------------|---------------------------------------------|
| crypto | **USDT**     | Quoted from Binance in USDT                 |
| fiat   | **تومان**    | Iranian market convention (TGJU rial ÷ 10)  |
| gold   | **تومان**    | Iranian market convention (TGJU rial ÷ 10)  |

- Worker source of truth: `unitForMarket(market)` in
  `deploy/cloudflare-worker/src/prices.js` → `crypto ? "USDT" : "تومان"`.
- The unit shown at alert creation is **snapshotted** on the alert as
  `target_price_display_unit` so later changes never rewrite history
  (see `ALERT_HARDENING_CONTRACTS.md`).

> Toman remains the primary unit for Iranian (fiat/gold) markets per the improvement
> report; crypto is the deliberate exception because users compare it in USDT.

## Number formatting (display)

- Worker formatting: `formatPrice(value, decimals=0)` uses
  `Intl.NumberFormat("fa-IR", …)`, i.e. **Persian digits** with the locale's thousand
  separators. See `prices.js`.
- Decimal places:
  - Toman (fiat/gold): **0 decimals**.
  - Crypto (USDT): **0 decimals**, except small targets `< 100` which use **2 decimals**
    (`formatNormalizedTarget` in `alert-flow.js`: `decimals = market === "crypto" && target < 100 ? 2 : 0`).
- Combined display = `{formatted number} {unit}` (e.g. `۱٬۷۴۴٬۲۰۰ تومان`, `۶۵٬۶۲۸ USDT`).

## Input parsing (target price)

User-entered target prices are normalized by `normalizeTargetPrice` (`alert-flow.js`):

1. Persian (`۰-۹`) and Arabic-Indic (`٠-٩`) digits are mapped to ASCII.
2. Commas (`,`/`،`) and whitespace are stripped.
3. The result must be a finite number `> 0`; otherwise the input is **rejected** (returns
   `null` → actionable error message).
4. Accepted values are rounded to 8 decimal places (`Math.round(n * 1e8) / 1e8`).

Backend parsing mirrors this in `domain/pricing.py`:

- `normalize_price` strips commas, requires a positive value, and quantizes to
  `0.00000001` (`PRICE_QUANT`, 8 decimal places) as a `Decimal`.
- `format_price(value, unit)` renders with `,` grouping and the supplied unit; the backend
  default unit constant is `DEFAULT_PRICE_UNIT = "IRT"` (canonical/storage unit), distinct
  from the user-facing `تومان`/`USDT` labels above.

## Canonical storage representation

- Canonical numeric representation is `Decimal` quantized to **8 decimal places**.
- Storage/evaluation never depends on the formatted string; formatting is presentation-only.

## Edge cases

- Values `≤ 0` or non-numeric input → rejected at parse time (never stored).
- Small crypto targets (`< 100`) → 2 decimals so sub-unit targets remain legible.
- Large Toman values → grouped with locale separators; no alternate-unit compression is
  applied today (the guide's ">1B alternative units" idea is **not** implemented and is out
  of scope for Phase 0).

## Acceptance criteria (T-002)

- [x] A single definition exists for price display, per market.
- [x] Rounding/decimal rules are specified and match `formatPrice`/`formatNormalizedTarget`.
- [x] Thousand separator behavior is specified (locale `fa-IR`).
- [x] Input parsing (Persian/Arabic digits, separators, positivity) is specified.
- [x] Canonical 8-decimal `Decimal` storage representation is specified.
