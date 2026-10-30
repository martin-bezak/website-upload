"""Bitcoin Lab · shared hour-by-hour trade engine (used by every signal strategy and, later, the combination).

Input: per-hour entry signals, each decided at that hour's close and filled at the next hour's open,
with a stop price. Exits: stop, take-profit at r_target x risk, or a time limit; checked against each hour's
high and low; if stop and target are touched in the same hour, the stop counts first.

Modes:
  long        long trades only, cash otherwise
  longshort   long and short trades (shorts need futures; research only)
  hold_sell   a spot holder keeps 100% BTC and goes to cash on a short signal until that trade exits
Sizing: risk `risk` of the portfolio per trade, weight = min(1, risk / distance to the stop) (hold_sell: all of it).
"""
import numpy as np
import pandas as pd

from strategies import wilson


def run(h, long_sig, long_stop, short_sig, short_stop, p, mode="long", t_first=0, setup=None):
    """setup: optional per-hour setup id; at most one trade per setup (e.g. per squeeze). Returns daily equity,
    trades and the hour-by-hour BTC weight (for the timing placebo)."""
    o, hh, ll, cc = h["open"].values, h["high"].values, h["low"].values, h["close"].values
    hidx = h.index
    n = len(h)
    cost = p["fee"] + p["slip"]
    base_w = 1.0 if mode == "hold_sell" else 0.0
    w, E = base_w, 1.0
    pos, pending, cool = None, None, -1
    last_setup = None
    ss = p.get("stop_slip", 0.0)          # extra slippage on stop fills (gaps, thin books in a crash)
    W = np.full(n, np.nan)
    trades, daily_t, daily_e = [], [], []
    for t in range(max(t_first, 1), n):
        fills = []
        if pending is not None:
            entry = o[t] * (1 + p["slip"] * pending["dir"])
            stop = pending["stop"]
            risk = abs(entry - stop) / entry
            if (entry - stop) * pending["dir"] > 0 and risk > 0.002:
                f = 1.0 if mode == "hold_sell" else min(1.0, p["risk"] / risk)
                pos = {"t": t, "dir": pending["dir"], "entry": entry, "stop": stop, "risk": risk, "f": f,
                       "target": entry + pending["dir"] * p["r_target"] * abs(entry - stop)}
                fills.append((o[t], 0.0 if mode == "hold_sell" else pending["dir"] * f))
                last_setup = pending.get("setup")
            pending = None
        if pos is not None:
            px, why = None, None
            first = pos["t"] == t
            up = hh[t] >= (pos["target"] if pos["dir"] > 0 else pos["stop"])
            dn = ll[t] <= (pos["stop"] if pos["dir"] > 0 else pos["target"])
            if pos["dir"] > 0 and dn:
                px, why = (pos["stop"] if first else min(pos["stop"], o[t])) * (1 - ss), "stop"
            elif pos["dir"] < 0 and up:
                px, why = (pos["stop"] if first else max(pos["stop"], o[t])) * (1 + ss), "stop"
            elif pos["dir"] > 0 and up:
                px, why = (pos["target"] if first else max(pos["target"], o[t])), "target"
            elif pos["dir"] < 0 and dn:
                px, why = (pos["target"] if first else min(pos["target"], o[t])), "target"
            elif t - pos["t"] >= p["max_hours"]:
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
                cool = t + p.get("cooldown", 24)
        prev = cc[t - 1]
        ret, fee, wc = 0.0, 0.0, w
        for px, nw in fills:
            ret += wc * (px / prev - 1)
            fee += abs(nw - wc) * cost
            wc, prev = nw, px
        ret += wc * (cc[t] / prev - 1)
        w = wc
        W[t] = w
        E *= 1 + ret - fee
        if pos is None and pending is None and t >= cool and t + 1 < n and (setup is None or setup[t] != last_setup):
            sid = None if setup is None else setup[t]
            if long_sig[t] and mode in ("long", "longshort"):
                pending = {"dir": 1, "stop": long_stop[t], "setup": sid}
            elif short_sig[t] and mode in ("longshort", "hold_sell"):
                pending = {"dir": -1, "stop": short_stop[t], "setup": sid}
        if hidx[t].hour == 23:
            daily_t.append(hidx[t].normalize()); daily_e.append(E)
    eq = pd.Series(daily_e, index=pd.DatetimeIndex(daily_t))
    return eq / eq.iloc[0], trades, W


def trade_stats(trades):
    if not trades:
        return {"n": 0}
    R = np.array([t["R"] for t in trades]); ret = np.array([t["ret"] for t in trades])
    wins = int((ret > 0).sum())
    return {"n": len(trades), "wins": wins, "winrate": round(wins / len(trades), 3), "wilson": wilson(wins, len(trades)),
            "meanR": round(float(R.mean()), 3), "medianR": round(float(np.median(R)), 3),
            "pf": round(float(ret[ret > 0].sum() / -ret[ret <= 0].sum()), 2) if (ret <= 0).any() and (ret > 0).any() else None,
            "targets": sum(t["why"] == "target" for t in trades), "stops": sum(t["why"] == "stop" for t in trades),
            "times": sum(t["why"] == "time" for t in trades), "avg_f": round(float(np.mean([t["f"] for t in trades])), 3),
            "longs": sum(t["dir"] > 0 for t in trades), "shorts": sum(t["dir"] < 0 for t in trades)}


def placebo(h, trades, p, sets=1000, seed=7, t_lo=0):
    """Random entry hours, each with the same direction, stop distance, target and time limit as a real trade."""
    rng = np.random.default_rng(seed)
    o, hh, ll, cc = h["open"].values, h["high"].values, h["low"].values, h["close"].values
    n, horizon = len(h), p["max_hours"]
    cost = p["fee"] + p["slip"]
    means = np.empty(sets)
    for s in range(sets):
        Rs = []
        for tr in trades:
            t = int(rng.integers(t_lo, n - horizon - 2))
            e = o[t] * (1 + p["slip"] * tr["dir"]); risk = tr["risk"]
            if tr["dir"] > 0:
                stop, tgt = e * (1 - risk), e * (1 + p["r_target"] * risk)
                hs = np.nonzero(ll[t:t + horizon] <= stop)[0]; ht = np.nonzero(hh[t:t + horizon] >= tgt)[0]
            else:
                stop, tgt = e * (1 + risk), e * (1 - p["r_target"] * risk)
                hs = np.nonzero(hh[t:t + horizon] >= stop)[0]; ht = np.nonzero(ll[t:t + horizon] <= tgt)[0]
            fs = hs[0] if len(hs) else horizon; ft = ht[0] if len(ht) else horizon
            px = cc[t + horizon - 1] if fs == horizon and ft == horizon else (stop if fs <= ft else tgt)
            Rs.append((tr["dir"] * (px / e - 1) - 2 * cost) / risk)
        means[s] = np.mean(Rs)
    return means
