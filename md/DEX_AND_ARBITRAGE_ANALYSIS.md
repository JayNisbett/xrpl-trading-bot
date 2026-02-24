# XRPL DEX Usage & Arbitrage Best Practices – Analysis

## Current Implementation Summary

### How We Trade Today

| Aspect | What We Use | What We Don't Use |
|--------|-------------|-------------------|
| **Execution** | **Payment** transactions only | **OfferCreate** (order book / limit orders) |
| **Venue** | AMM-only (we require `amm_info` and build Payment for that pool) | DEX order book, path finding |
| **Path finding** | None – we build Payment with Amount/SendMax and no `Paths` | `path_find`, `ripple_path_find`, `book_offers` |

**Flow today:**

1. **Sniper / Copy / Profit take / Arbitrage**  
   All go through `src/xrpl/amm.ts`:
   - `executeAMMBuy` / `executeAMMSell` use **Payment** with:
     - `Account` = `Destination` = self
     - `SendMax` = XRP (buy) or `Amount` = XRP (sell)
     - `Amount` = token (buy) or `SendMax` = token (sell)
   - We **require** an AMM pool via `amm_info` before building the Payment.
   - We **do not** set a `Paths` field; we do not call `path_find` or `ripple_path_find`.

2. **Liquidity provision**  
   Uses **AMMDeposit** / **AMMWithdraw** in `src/amm/liquidityProvider.ts` (correct for LP).

3. **Arbitrage**  
   In `src/amm/arbitrageExecutor.ts` we only do **AMM ↔ AMM** (buy in one pool, sell in another). We do not:
   - Compare AMM vs order book.
   - Use the DEX order book (OfferCreate / taking offers).
   - Use path finding to choose best route.

So in practice we are **AMM-only** and **do not use the XRPL DEX order book (OfferCreate)** or path/order-book APIs for execution or arbitrage.

---

## XRPL Behavior (Relevant to Best Practices)

- **Payment**  
  For cross-currency (e.g. XRP → token), the ledger can route through:
  - AMM pools
  - Order book (offers)
  - Or both (best execution)
  - If you omit `Paths`, the node may still path-find when processing the Payment.

- **Our current code**  
  We only proceed when `amm_info` returns a pool and we build the Payment from that pool’s implied rate. We never:
  - Call `path_find` / `ripple_path_find` to discover routes.
  - Call `book_offers` to consider order book liquidity.
  - Create or take **OfferCreate** orders.

So we are **not** explicitly “using the DEX” (order book); we are using **AMM-only** execution and **AMM-only arbitrage**.

---

## Are We Using Best Practices for Profit & Arbitrage?

### What We Do Well

- **AMM for execution**  
  AMM gives 24/7 liquidity, no MEV/front‑running (consensus-based), low fees, and fast settlement. Good for sniping and copy trading.

- **Payment (not manual path building)**  
  Using Payment with Amount/SendMax and letting the node handle routing (when we don’t force AMM) is the right high-level approach.

- **Slippage**  
  We use `DeliverMin` / minimum amounts and slippage for AMM trades.

- **Arbitrage**  
  We detect AMM–AMM price differences and execute buy in one pool / sell in the other.

### Gaps vs Best Practices

1. **No use of order book (OfferCreate)**  
   - **Best practice:** For some pairs, the **best price** may be on the order book, not the AMM. We never check `book_offers` or take/place offers.
   - **Impact:** We may get worse execution than “best available on the DEX” when order book has better depth or price.

2. **No path finding**  
   - **Best practice:** Use `ripple_path_find` (or `path_find`) to get the **best path** (AMM, order book, or combination) and optional `Paths` in the Payment.
   - **Impact:** We don’t explicitly compare AMM vs book; we assume AMM and only execute there.

3. **Arbitrage is AMM–AMM only**  
   - **Best practice:** Maximize arbitrage by considering:
     - AMM vs order book (e.g. buy on book, sell on AMM, or vice versa).
     - Multi-hop paths (XRP → Token A → Token B → XRP) when profitable.
   - **Impact:** We miss arbitrage between AMM and order book and more complex routes.

4. **No limit orders**  
   - **Best practice:** For non-urgent trades, **OfferCreate** can improve average price (place limit and wait for fill).
   - **Impact:** We only do immediate execution via Payment; we don’t use limit orders to improve execution when speed isn’t critical.

5. **Single-path execution**  
   - We build one Payment per trade and don’t compare multiple paths (e.g. AMM vs book) and pick the best.
   - **Best practice:** Call `ripple_path_find` (or `path_find`), then build Payment with the best path (or let the node choose if we omit Paths after path_find).

---

## Recommendations (Prioritized)

### 1. Use path finding for execution (high impact)

- Before each buy/sell, call **`ripple_path_find`** (or `path_find`) with:
  - `source_account` / `destination_account` (can be self for swap)
  - `destination_amount` (what you want to receive)
  - `send_max` (what you’re willing to spend)
- Use the **best alternative** (e.g. by destination amount or cost) and, if the API returns path(s), attach the chosen **Paths** to the Payment.
- This lets the ledger use **AMM and/or order book** automatically and can improve execution and arbitrage.

### 2. Compare AMM vs order book for arbitrage (high impact)

- For each arbitrage candidate:
  - Get AMM price (current logic).
  - Get **book_offers** (buy and sell sides) for the same pair.
- Compute “effective” price from the book for the size we’d trade.
- Prefer the venue (AMM or book) that gives better execution, or split size across both if beneficial.
- Optionally: **AMM ↔ book** arbitrage (e.g. buy on book, sell on AMM) in addition to AMM ↔ AMM.

### 3. Optional: OfferCreate for limit orders (medium impact)

- For non–time-critical trades (e.g. profit targets, copy trades with delay), consider **OfferCreate** to place a limit order instead of an immediate Payment.
- Use **book_offers** to see current book and set a competitive price; optionally use **OfferCancel** and replace if market moves.

### 4. Optional: Multi-hop arbitrage (medium impact)

- Use path finding to detect profitable multi-hop routes (e.g. XRP → A → B → XRP or through multiple pools/books).
- Execute via a single Payment with the **Paths** returned by path finding.

### 5. Keep current AMM-only as fallback

- When there is no order book liquidity or path find fails, keep using the current AMM-only Payment flow so execution still works.

---

## Summary Table

| Question | Answer |
|----------|--------|
| Do we use the XRPL DEX (order book)? | **No.** We only use **Payment** and only in combination with AMM; we do not use **OfferCreate** or **book_offers** for execution. |
| Do we use OfferCreate? | **No.** |
| Do we use best practices to maximize profit and arbitrage? | **Partially.** We use AMM and Payment, which is good, but we do **not** use path finding, order book, or AMM–book arbitrage, so we are not fully using best practices for best execution and maximum arbitrage. |

---

## Implemented (Current Codebase)

The following are now implemented:

1. **Path finding** – `src/xrpl/pathFinding.ts` uses `ripple_path_find` to get path alternatives; best path is used in Payment when it beats AMM.
2. **AMM vs order book comparison** – `src/xrpl/orderBook.ts` uses `book_offers`; `src/xrpl/bestExecution.ts` compares path find, AMM, and book quotes and picks the best venue for each buy/sell.
3. **Best execution** – All buys/sells go through `executeBuy` / `executeSell` in `src/xrpl/amm.ts`, which use path finding + AMM + book when `config.trading.useBestExecution` is true (default). Set `USE_BEST_EXECUTION=false` to force AMM-only.
4. **OfferCreate / OfferCancel** – `src/xrpl/offers.ts` provides `placeBuyOrder`, `placeSellOrder`, `cancelOfferBySequence`, `getAccountOffers`. API: `POST /api/offers`, `DELETE /api/offers/:sequence`, `GET /api/offers`.
