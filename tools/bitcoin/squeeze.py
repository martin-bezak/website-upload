"""Bitcoin Lab · Strategy 3, "Volatility squeeze breakout" (rules fixed before testing).

  squeeze      20-day realised volatility in the lowest 20% of the past 365 days (ranked on past data only);
               a squeeze day arms the strategy for the next 10 days
  range        highest high / lowest low of the last 20 days (updated every squeeze day)
  entry        an hourly close above the range -> buy at the next hour's open;
               an hourly close below the range -> sell signal (short, or "sell your BTC")
  exits        stop at the other side of the range, take profit at 2R (2 x the risk), time stop after 20 days;
               checked hour by hour; if stop and target are both touched in one hour, the stop counts first
  size         risk 2% of the portfolio per trade: weight = min(1, 2% / distance to the stop)
  costs        0.10% fee + 0.05% slippage per side

Three ways to use it:
  long         long trades only, cash otherwise
  longshort    long and short trades (shorts need futures; research only)
  hold_sell    a spot holder keeps 100% BTC and sells everything on a downside breakout until that trade exits

Placebo test: the same exits from 1,000 sets of random entry times. If breakouts don't beat random entries,
the setup itself adds nothing.

Run:  python3 tools/bitcoin/squeeze.py      writes BitcoinLab/data/strategies/squeeze.json
"""
import itertools
import json
import math
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data as D                                   # noqa: E402
from strategies import prepare, stats, block_bootstrap_p, wilson, OUT   # noqa: E402

BASE = {"pct": 0.20, "rv_len": 20, "rank_len": 365, "arm_days": 10, "range_len": 20,
        "r_target": 2.0, "max_days": 20, "risk": 0.02, "fee": 0.0010, "slip": 0.0005}


def squeeze_days(d, p):
    r = np.log(d["close"]).diff()
    rv = r.rolling(p["rv_len"]).std()
    # percentile of today's volatility among the past rank_len days (today included, nothing later)
    pct = rv.rolling(p["rank_len"]).apply(lambda x: (x <= x[-1]).mean(), raw=True)
    hi = d["high"].rolling(p["range_len"]).max()
    lo = d["low"].rolling(p["range_len"]).min()
    return (pct <= p["pct"]).values, hi.values, lo.values, pct


def run(d, h, p=BASE, mode="long", start=None):
    """Hour-by-hour backtest. The portfolio holds a BTC weight w (negative = short); every fill happens at a real
    price inside an hour, and that hour's return is split at the fill: w_before up to the fill, w_after after it."""
    sq, rhi, rlo, _ = squeeze_days(d, p)
    o, hh, ll, cc = h["open"].values, h["high"].values, h["low"].values, h["close"].values
    hidx = h.index
    day_of = d.index.searchsorted(hidx.normalize())
    n = len(h)
    cost = p["fee"] + p["slip"]
    t_first = hidx.searchsorted(start) if start is not None else hidx.searchsorted(d.index[p["rank_len"] + p["rv_len"]])
    base_w = 1.0 if mode == "hold_sell" else 0.0
    w, E = base_w, 1.0
    pos, pending = None, None
    armed_until, a_hi, a_lo = -1, np.nan, np.nan
    trades, daily_t, daily_e = [], [], []
    for t in range(t_first, n):
        di = day_of[t]
        if hidx[t].hour == 0 and di >= 1 and sq[di - 1]:
            armed_until, a_hi, a_lo = di - 1 + p["arm_days"], rhi[di - 1], rlo[di - 1]
        fills = []                                    # (price, new weight) in time order within the hour
        if pending is not None:                       # signal at the last close -> fill at this hour's open
            entry = o[t] * (1 + p["slip"] * pending["dir"])
            stop = pending["stop"]
            risk = abs(entry - stop) / entry
            if (entry - stop) * pending["dir"] > 0 and risk > 0.002:
                f = 1.0 if mode == "hold_sell" else min(1.0, p["risk"] / risk)
                pos = {"t": t, "dir": pending["dir"], "entry": entry, "stop": stop, "risk": risk, "f": f,
                       "target": entry + pending["dir"] * p["r_target"] * abs(entry - stop)}
                fills.append((o[t], 0.0 if mode == "hold_sell" else pending["dir"] * f))
            pending = None
        if pos is not None:
            px, why = None, None
            up_hit = hh[t] >= (pos["target"] if pos["dir"] > 0 else pos["stop"])
            dn_hit = ll[t] <= (pos["stop"] if pos["dir"] > 0 else pos["target"])
            if pos["dir"] > 0 and dn_hit:
                px, why = min(pos["stop"], o[t]) if pos["t"] != t else pos["stop"], "stop"
            elif pos["dir"] < 0 and up_hit:
                px, why = max(pos["stop"], o[t]) if pos["t"] != t else pos["stop"], "stop"
            elif pos["dir"] > 0 and up_hit:
                px, why = max(pos["target"], o[t]) if pos["t"] != t else pos["target"], "target"
            elif pos["dir"] < 0 and dn_hit:
                px, why = min(pos["target"], o[t]) if pos["t"] != t else pos["target"], "target"
            elif t - pos["t"] >= p["max_days"] * 24:
                px, why = cc[t], "time"
            if px is not None:
                gross = pos["dir"] * (px / pos["entry"] - 1)
                trades.append({"in": int(hidx[pos["t"]].timestamp()), "out": int(hidx[t].timestamp()), "dir": pos["dir"],
                               "entry": round(pos["entry"], 2), "exit": round(px, 2), "stop": round(pos["stop"], 2),
                               "target": round(pos["target"], 2), "f": round(pos["f"], 3), "why": why,
                               "ret": round(pos["f"] * gross - 2 * pos["f"] * cost, 5),
                               "R": round((gross - 2 * cost) / pos["risk"], 3), "risk": round(pos["risk"], 4)})
                fills.append((px, base_w))
                pos = None
                armed_until = -1                      # one trade per squeeze
        # this hour's return, split at the fills
        prev = cc[t - 1]
        ret, fee, wc = 0.0, 0.0, w
        for px, nw in fills:
            ret += wc * (px / prev - 1)
            fee += abs(nw - wc) * cost
            wc, prev = nw, px
        ret += wc * (cc[t] / prev - 1)
        w = wc
        E *= 1 + ret - fee
        # new signal at this hour's close (only when flat relative to the base position)
        if pos is None and pending is None and di <= armed_until and np.isfinite(a_hi) and t + 1 < n:
            up, down = cc[t] > a_hi, cc[t] < a_lo
            if up and mode in ("long", "longshort"):
                pending = {"dir": 1, "stop": a_lo}
            elif down and mode in ("longshort", "hold_sell"):
                pending = {"dir": -1, "stop": a_hi}
        if hidx[t].hour == 23:
            daily_t.append(hidx[t].normalize()); daily_e.append(E)
    eq = pd.Series(daily_e, index=pd.DatetimeIndex(daily_t))
    return eq / eq.iloc[0], trades


def trade_stats(trades):
    if not trades:
        return {"n": 0}
    R = np.array([t["R"] for t in trades]); ret = np.array([t["ret"] for t in trades])
    wins = int((ret > 0).sum())
    return {"n": len(trades), "wins": wins, "winrate": round(wins / len(trades), 3), "wilson": wilson(wins, len(trades)),
            "meanR": round(float(R.mean()), 3), "medianR": round(float(np.median(R)), 3),
            "pf": round(float(ret[ret > 0].sum() / -ret[ret <= 0].sum()), 2) if (ret <= 0).any() else None,
            "targets": sum(t["why"] == "target" for t in trades), "stops": sum(t["why"] == "stop" for t in trades),
            "times": sum(t["why"] == "time" for t in trades), "avg_f": round(float(np.mean([t["f"] for t in trades])), 3),
            "longs": sum(t["dir"] > 0 for t in trades), "shorts": sum(t["dir"] < 0 for t in trades)}


def placebo(h, trades, p, sets=1000, seed=7, t_lo=None):
    """Random entry times, each with the same direction, stop distance, 2R target and time limit as a real trade."""
    rng = np.random.default_rng(seed)
    o, hh, ll, cc = h["open"].values, h["high"].values, h["low"].values, h["close"].values
    n, horizon = len(h), p["max_days"] * 24
    cost = p["fee"] + p["slip"]
    lo = t_lo or 0
    means = np.empty(sets)
    for s in range(sets):
        Rs = []
        for tr in trades:
            t = int(rng.integers(lo, n - horizon - 2))
            e = o[t] * (1 + p["slip"] * tr["dir"]); risk = tr["risk"]
            if tr["dir"] > 0:
                stop, tgt = e * (1 - risk), e * (1 + p["r_target"] * risk)
                hs = np.nonzero(ll[t:t + horizon] <= stop)[0]; ht = np.nonzero(hh[t:t + horizon] >= tgt)[0]
            else:
                stop, tgt = e * (1 + risk), e * (1 - p["r_target"] * risk)
                hs = np.nonzero(hh[t:t + horizon] >= stop)[0]; ht = np.nonzero(ll[t:t + horizon] <= tgt)[0]
            fs = hs[0] if len(hs) else horizon; ft = ht[0] if len(ht) else horizon
            if fs == horizon and ft == horizon:
                px = cc[t + horizon - 1]
            elif fs <= ft:
                px = stop
            else:
                px = tgt
            gross = tr["dir"] * (px / e - 1)
            Rs.append((gross - 2 * cost) / risk)
        means[s] = np.mean(Rs)
    return means


def main():
    h = D.hourly()
    d, r, h = prepare(h)
    start = d.index[BASE["rank_len"] + BASE["rv_len"] + 1]
    out = {"name": "Volatility squeeze breakout", "params": BASE, "modes": {}}
    print(f"period from {start.date()}")
    for mode in ["long", "longshort", "hold_sell"]:
        eq, trades = run(d, h, BASE, mode, start)
        bh = d["close"][d.index >= eq.index[0]]
        bh = bh / bh.iloc[0]
        s, b = stats(eq), stats(bh)
        ts = trade_stats(trades)
        ra = eq.pct_change().dropna(); rb = bh.reindex(eq.index).pct_change().dropna()
        pb = block_bootstrap_p(ra.values, rb.reindex(ra.index).fillna(0).values)
        res = {"strategy": s, "buyhold": b, "p_sharpe": pb, "trades": ts, "trade_list": trades,
               "eq": [round(float(x), 4) for x in eq.values], "bh": [round(float(x), 4) for x in bh.reindex(eq.index).values],
               "t0": int(eq.index[0].timestamp())}
        if mode != "hold_sell" and trades:
            pm = placebo(h, trades, BASE, t_lo=h.index.searchsorted(start))
            res["placebo"] = {"mean": round(float(pm.mean()), 3), "p95": round(float(np.quantile(pm, 0.95)), 3),
                              "p": round(float((pm >= ts["meanR"]).mean()), 4)}
        out["modes"][mode] = res
        print(f"\n== {mode}")
        print(f"  strategy  total {s['total']:7.2f} CAGR {s['cagr']:6.1%} vol {s['vol']:5.1%} Sharpe {s['sharpe']:5.2f} maxDD {s['mdd']:6.1%}")
        print(f"  buy&hold  total {b['total']:7.2f} CAGR {b['cagr']:6.1%} vol {b['vol']:5.1%} Sharpe {b['sharpe']:5.2f} maxDD {b['mdd']:6.1%}   bootstrap p {pb:.3f}")
        print("  trades", {k: v for k, v in ts.items()})
        if "placebo" in res:
            print("  placebo (random entries, same exits): mean R", res["placebo"])

    # robustness grid for the long and long/short versions
    grid = []
    for pct, L, R in itertools.product([0.10, 0.20, 0.30], [10, 20, 40], [1.5, 2.0, 3.0]):
        p = {**BASE, "pct": pct, "range_len": L, "r_target": R}
        for mode in ["long", "longshort"]:
            eq, trades = run(d, h, p, mode, start)
            ts = trade_stats(trades)
            grid.append({"mode": mode, "pct": pct, "range": L, "R": R, "n": ts["n"], "meanR": ts.get("meanR"),
                         "sharpe": stats(eq)["sharpe"], "cagr": stats(eq)["cagr"]})
    out["grid"] = grid
    for mode in ["long", "longshort"]:
        g = [x for x in grid if x["mode"] == mode]
        pos = sum(1 for x in g if (x["meanR"] or 0) > 0)
        print(f"\nrobustness {mode}: {pos}/{len(g)} settings with positive mean R; mean R range {min(x['meanR'] or 0 for x in g):.2f} to {max(x['meanR'] or 0 for x in g):.2f}; Sharpe {min(x['sharpe'] for x in g):.2f} to {max(x['sharpe'] for x in g):.2f}")

    # today's state
    sq, rhi, rlo, pct = squeeze_days(d, BASE)
    recent = [i for i in range(len(d) - BASE["arm_days"], len(d)) if sq[i]]
    out["state"] = {"pct": round(float(pct.iloc[-1]), 3), "squeeze": bool(sq[-1]), "armed": bool(recent),
                    "range": [round(float(rlo[recent[-1]]), 2), round(float(rhi[recent[-1]]), 2)] if recent else None,
                    "close": round(float(d["close"].iloc[-1]), 2)}
    print("\ntoday:", out["state"])
    os.makedirs(os.path.join(OUT, "strategies"), exist_ok=True)
    json.dump(out, open(os.path.join(OUT, "strategies", "squeeze.json"), "w"), separators=(",", ":"), default=float)


if __name__ == "__main__":
    main()
