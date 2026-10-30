"""Bitcoin Lab · Strategy 2, "Crowded leverage reversal" (rules fixed before testing).

  crowding     daily average of four percentiles, each ranked against the past 365 days only:
               funding rate (7-day mean), futures premium (7-day mean), 30-day change of open interest in BTC,
               top traders' long/short position ratio (7-day mean)
  setup        score >= 0.85: longs crowded -> look for a drop; score <= 0.15: shorts crowded -> look for a squeeze up;
               a crowded day arms the setup for the next 5 days
  trigger      longs crowded: an hourly close below the lowest low of the previous 48 hours -> short / sell
               shorts crowded: an hourly close above the highest high of the previous 48 hours -> buy
  exits        stop beyond the 48-hour extreme on the other side, take profit at 2R, time stop after 10 days
  size, costs  as in engine.py: 2% risk per trade, 0.10% fee + 0.05% slippage per side, 24h cooldown after a trade

Data: Binance futures funding (2020-01), premium index (2020-01), metrics (open interest, long/short; 2020-09),
so with a year for ranking, the test starts in late 2021.

Run:  python3 tools/bitcoin/crowded.py      writes BitcoinLab/data/strategies/crowded.json
"""
import itertools
import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data as D                                   # noqa: E402
import features as F                               # noqa: E402
from strategies import prepare, stats, block_bootstrap_p, OUT   # noqa: E402
from engine import run, trade_stats, placebo       # noqa: E402

BASE = {"hi": 0.85, "lo": 0.15, "rank_len": 365, "arm_days": 5, "window": 48, "r_target": 2.0,
        "max_hours": 240, "risk": 0.02, "fee": 0.0010, "slip": 0.0005, "cooldown": 24}


def crowding(h, d, p):
    """Daily crowding score in [0, 1] from past-only percentiles."""
    fund = F.estimate_funding(h)
    daily = pd.DataFrame({
        "funding": (fund * (h.index.hour % 8 == 0)).resample("1D").sum(min_count=1).rolling(7).mean(),
        "premium": h["premium"].resample("1D").mean().rolling(7).mean(),
        "oi": np.log((h["oi_usd"] / h["close"]).resample("1D").last()).diff(30),
        "top_ls": h["top_ls_pos"].resample("1D").mean().rolling(7).mean(),
    }).reindex(d.index)
    rank = lambda x: (x <= x[-1]).mean() if np.isfinite(x[-1]) and np.isfinite(x).sum() >= p["rank_len"] * 0.8 else np.nan
    pct = daily.apply(lambda s: s.rolling(p["rank_len"], min_periods=int(p["rank_len"] * 0.8)).apply(rank, raw=True))
    return pct.mean(axis=1, skipna=False), pct


def signals(h, d, score, p):
    hidx = h.index
    hh, ll, cc = h["high"].values, h["low"].values, h["close"].values
    W = p["window"]
    prev_hi = pd.Series(hh).shift(1).rolling(W).max().values
    prev_lo = pd.Series(ll).shift(1).rolling(W).min().values
    hi_now = pd.Series(hh).rolling(W).max().values
    lo_now = pd.Series(ll).rolling(W).min().values
    day_of = d.index.searchsorted(hidx.normalize())
    sc = score.values
    n = len(h)
    longs_crowded = np.zeros(n, bool); shorts_crowded = np.zeros(n, bool)
    # an hour on day D is armed if any of the previous arm_days daily closes (D-1 ... D-arm_days) was crowded
    hi_days = np.nan_to_num(sc >= p["hi"]).astype(bool)
    lo_days = np.nan_to_num(sc <= p["lo"], nan=0).astype(bool) & np.isfinite(sc)
    arm_hi = pd.Series(hi_days.astype(float)).shift(1).rolling(p["arm_days"], min_periods=1).max().fillna(0).values > 0
    arm_lo = pd.Series(lo_days.astype(float)).shift(1).rolling(p["arm_days"], min_periods=1).max().fillna(0).values > 0
    ok = (day_of < len(d))
    longs_crowded[ok] = arm_hi[day_of[ok]]
    shorts_crowded[ok] = arm_lo[day_of[ok]]
    short_sig = longs_crowded & (cc < prev_lo)          # crowded longs + breakdown -> short / sell
    long_sig = shorts_crowded & (cc > prev_hi)          # crowded shorts + breakout -> buy
    return long_sig, lo_now, short_sig, hi_now


def main():
    h = D.hourly()
    d, r, h = prepare(h)
    score, parts = crowding(h, d, BASE)
    first_day = score.first_valid_index()
    t_first = h.index.searchsorted(first_day + pd.Timedelta(days=1))
    print(f"crowding score available from {first_day.date()}; crowded-long days {int((score >= BASE['hi']).sum())}, crowded-short days {int((score <= BASE['lo']).sum())}")
    ls, lstop, ss, sstop = signals(h, d, score, BASE)
    out = {"name": "Crowded leverage reversal", "params": BASE, "from": int(first_day.timestamp()), "modes": {}}
    for mode in ["long", "longshort", "hold_sell"]:
        eq, trades, _ = run(h, ls, lstop, ss, sstop, BASE, mode, t_first)
        bh = d["close"][d.index >= eq.index[0]]; bh = bh / bh.iloc[0]
        s, b = stats(eq), stats(bh)
        ts = trade_stats(trades)
        ra = eq.pct_change().dropna(); rb = bh.reindex(eq.index).pct_change().dropna()
        pb = block_bootstrap_p(ra.values, rb.reindex(ra.index).fillna(0).values)
        res = {"strategy": s, "buyhold": b, "p_sharpe": pb, "trades": ts, "trade_list": trades,
               "eq": [round(float(x), 4) for x in eq.values], "bh": [round(float(x), 4) for x in bh.reindex(eq.index).values],
               "t0": int(eq.index[0].timestamp())}
        if trades:
            pm = placebo(h, trades, BASE, t_lo=t_first)
            res["placebo"] = {"mean": round(float(pm.mean()), 3), "p95": round(float(np.quantile(pm, 0.95)), 3),
                              "p": round(float((pm >= ts["meanR"]).mean()), 4)}
        out["modes"][mode] = res
        print(f"\n== {mode}")
        print(f"  strategy  total {s['total']:7.2f} CAGR {s['cagr']:6.1%} Sharpe {s['sharpe']:5.2f} maxDD {s['mdd']:6.1%}")
        print(f"  buy&hold  total {b['total']:7.2f} CAGR {b['cagr']:6.1%} Sharpe {b['sharpe']:5.2f} maxDD {b['mdd']:6.1%}   bootstrap p {pb:.3f}")
        print("  trades", ts)
        if "placebo" in res:
            print("  placebo:", res["placebo"])

    grid = []
    for hi, W, R in itertools.product([0.80, 0.85, 0.90], [24, 48, 96], [1.5, 2.0, 3.0]):
        p = {**BASE, "hi": hi, "lo": 1 - hi, "window": W, "r_target": R}
        # the crowding score itself does not depend on these settings, only the thresholds do
        a, b_, c, e_ = signals(h, d, score, p)
        for mode in ["longshort", "hold_sell"]:
            eq, tr, _ = run(h, a, b_, c, e_, p, mode, t_first)
            ts = trade_stats(tr)
            grid.append({"mode": mode, "hi": hi, "window": W, "R": R, "n": ts["n"], "meanR": ts.get("meanR"),
                         "total": stats(eq)["total"], "sharpe": stats(eq)["sharpe"]})
    out["grid"] = grid
    bh_s = out["modes"]["hold_sell"]["buyhold"]
    for mode in ["longshort", "hold_sell"]:
        g = [x for x in grid if x["mode"] == mode]
        posR = sum(1 for x in g if (x["meanR"] or 0) > 0)
        beat = sum(1 for x in g if x["sharpe"] > bh_s["sharpe"])
        print(f"\nrobustness {mode}: {posR}/{len(g)} positive mean R ({min(x['meanR'] or 0 for x in g):+.2f} to {max(x['meanR'] or 0 for x in g):+.2f}); "
              f"{beat}/{len(g)} beat buy&hold Sharpe; n trades {min(x['n'] for x in g)}-{max(x['n'] for x in g)}")

    out["state"] = {"score": round(float(score.iloc[-1]), 3) if np.isfinite(score.iloc[-1]) else None,
                    "parts": {k: (round(float(v), 3) if np.isfinite(v) else None) for k, v in parts.iloc[-1].items()},
                    "recent": [round(float(x), 3) if np.isfinite(x) else None for x in score.iloc[-10:].values]}
    print("\ntoday:", out["state"])
    os.makedirs(os.path.join(OUT, "strategies"), exist_ok=True)
    json.dump(out, open(os.path.join(OUT, "strategies", "crowded.json"), "w"), separators=(",", ":"), default=float)


if __name__ == "__main__":
    main()
