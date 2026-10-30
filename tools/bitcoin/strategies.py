"""Bitcoin Lab · strategies: rule-based trading strategies, backtested path by path.

Strategy 1, "Trend + volatility target" (rules fixed before testing, textbook values, no fitting):
  in the market   when the daily close is above its 50-, 100- and 200-day averages; otherwise cash (spot only)
  size            target 50% annual volatility: weight = min(1, 0.50 / RiskMetrics EWMA vol (lambda 0.94))
  trailing stop   3 x ATR(14) below the highest close since entry, checked against every hourly low
  after a stop    re-enter only on a new 20-day closing high (while the trend filter still agrees)
  costs           0.10% fee + 0.05% slippage per side; weight changes under 10 points are not traded
Trades happen at the daily close (00:00 UTC) that triggers them; stops fill at the stop price, or at the
hour's open if the price gapped through it.

Run:  python3 tools/bitcoin/strategies.py      writes BitcoinLab/data/strategies/trend.json
"""
import itertools
import json
import math
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data as D          # noqa: E402
import features as F      # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.environ.get("BTCLAB_OUT", os.path.join(ROOT, "BitcoinLab", "data"))

BASE = {"mas": (50, 100, 200), "stop_atr": 3.0, "vol_target": 0.50, "lam": 0.94, "reentry": 20,
        "fee": 0.0010, "slip": 0.0005, "band": 0.10}


def prepare(h):
    d = F.daily_frame(h)
    if h.index[-1].hour != 23:
        d = d.iloc[:-1]
    r = np.log(d["close"]).diff()
    tr = pd.concat([d["high"] - d["low"], (d["high"] - d["close"].shift()).abs(), (d["low"] - d["close"].shift()).abs()], axis=1).max(axis=1)
    d["atr14"] = tr.rolling(14).mean()
    # RiskMetrics EWMA variance of daily log returns
    return d, r, h


def ewma_vol(r, lam):
    v = np.full(len(r), np.nan)
    s2 = np.nanvar(r.values[1:31])
    for i in range(1, len(r)):
        x = r.values[i]
        if np.isfinite(x):
            s2 = lam * s2 + (1 - lam) * x * x
        v[i] = math.sqrt(s2 * 365)
    return pd.Series(v, index=r.index)


def run_trend(d, r, h, p=BASE, start=None):
    close = d["close"].values
    n = len(d)
    agree = np.ones(n, bool)
    for m in p["mas"]:
        ma = d["close"].rolling(m).mean().values
        agree &= close > ma
    agree &= np.isfinite(d["close"].rolling(max(p["mas"])).mean().values)
    vol = ewma_vol(r, p["lam"]).values
    target = np.where(agree, np.minimum(1.0, p["vol_target"] / vol) if p["vol_target"] else 1.0, 0.0)
    target[~np.isfinite(target)] = 0
    hi20 = d["close"].rolling(p["reentry"]).max().values
    atr = d["atr14"].values
    cost = p["fee"] + p["slip"]

    # hourly lows and opens grouped by day, for path-dependent stops
    hl = h["low"].values; ho = h["open"].values
    day_of_hour = h.index.normalize()
    pos_in_day = pd.Series(np.arange(len(h)), index=h.index).groupby(day_of_hour).agg(["first", "last"])

    first = max(p["mas"]) + 30 if start is None else d.index.searchsorted(start)
    eq = np.ones(n); w = 0.0; stop = np.nan; peak = np.nan; stopped = False
    weights = np.zeros(n); trades = []; open_trade = None
    for i in range(first, n):
        # 1) trade at the previous close (= this day's open) toward the target decided then
        want = target[i - 1]
        if stopped:
            # after a stop-out: wait for a new 20-day high while the trend still agrees
            if agree[i - 1] and close[i - 1] >= hi20[i - 1]:
                stopped = False
            else:
                want = 0.0
        fee = 0.0
        if (w == 0 and want > 0) or (w > 0 and want == 0) or abs(want - w) > p["band"]:
            fee = abs(want - w) * cost
            if w == 0 and want > 0:
                open_trade = {"in": int(d.index[i - 1].timestamp()) + 86400, "pin": close[i - 1], "w": round(want, 3)}
                peak = close[i - 1]
                stop = peak - p["stop_atr"] * atr[i - 1] if p["stop_atr"] else -np.inf
            if w > 0 and want == 0 and open_trade:
                open_trade.update({"out": int(d.index[i - 1].timestamp()) + 86400, "pout": close[i - 1], "why": "trend"})
                trades.append(open_trade); open_trade = None
            w = want
        # 2) during the day: did an hourly low hit the stop?
        ret = w * (close[i] / close[i - 1] - 1) if w else 0.0
        if w > 0 and p["stop_atr"]:
            day = d.index[i]
            if day in pos_in_day.index:
                a, b = pos_in_day.loc[day]
                hit = np.nonzero(hl[a:b + 1] <= stop)[0]
                if len(hit):
                    k = a + hit[0]
                    px = min(stop, ho[k]) * (1 - p["slip"] - p.get("stop_slip", 0.0))
                    ret = w * (px / close[i - 1] - 1)
                    fee += w * p["fee"]
                    if open_trade:
                        open_trade.update({"out": int(h.index[k].timestamp()), "pout": px, "why": "stop"})
                        trades.append(open_trade); open_trade = None
                    w = 0.0; stopped = True
        eq[i] = eq[i - 1] * (1 + ret - fee)
        weights[i] = w
        # 3) at the close: trail the stop
        if w > 0:
            peak = max(peak, close[i])
            if p["stop_atr"]:
                stop = max(stop, peak - p["stop_atr"] * atr[i])
    if open_trade:
        open_trade.update({"out": None, "pout": close[-1], "why": "open"})
        trades.append(open_trade)
    for t in trades:
        t["ret"] = round(t["pout"] / t["pin"] - 1, 4)
    state = {"agree": bool(agree[-1]), "target": round(float(target[-1]), 3), "weight": round(w, 3),
             "stop": round(float(stop), 2) if w > 0 and np.isfinite(stop) else None, "stopped": stopped,
             "vol": round(float(vol[-1]), 3), "close": round(float(close[-1]), 2),
             "mas": {str(m): round(float(d["close"].rolling(m).mean().iloc[-1]), 2) for m in p["mas"]}}
    return pd.Series(eq[first - 1:], index=d.index[first - 1:]), pd.Series(weights[first - 1:], index=d.index[first - 1:]), trades, state


def stats(eq):
    r = eq.pct_change().dropna()
    yrs = (eq.index[-1] - eq.index[0]).days / 365.25
    cagr = eq.iloc[-1] ** (1 / yrs) - 1
    vol = r.std() * math.sqrt(365)
    down = r[r < 0].std() * math.sqrt(365)
    dd = eq / eq.cummax() - 1
    return {"total": round(float(eq.iloc[-1] - 1), 4), "cagr": round(float(cagr), 4), "vol": round(float(vol), 4),
            "sharpe": round(float(r.mean() / r.std() * math.sqrt(365)), 3), "sortino": round(float(r.mean() * 365 / down), 3),
            "mdd": round(float(dd.min()), 4), "calmar": round(float(cagr / -dd.min()), 3) if dd.min() < 0 else None}


def block_bootstrap_p(a, b, block=20, reps=2000, seed=1):
    """Share of resampled histories where strategy a's Sharpe is NOT above b's (paired, circular blocks)."""
    rng = np.random.default_rng(seed)
    a, b = np.asarray(a), np.asarray(b)
    n = len(a)
    nb = int(np.ceil(n / block))
    worse = 0
    for _ in range(reps):
        starts = rng.integers(0, n, nb)
        idx = (starts[:, None] + np.arange(block)[None, :]).ravel()[:n] % n
        sa, sb = a[idx], b[idx]
        if sa.mean() / sa.std() <= sb.mean() / sb.std():
            worse += 1
    return worse / reps


def wilson(k, n, z=1.96):
    if n == 0:
        return None, None
    ph = k / n
    den = 1 + z * z / n
    c = (ph + z * z / (2 * n)) / den
    e = z * math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / den
    return round(c - e, 3), round(c + e, 3)


def main():
    h = D.hourly()
    d, r, h = prepare(h)
    eq, w, trades, state = run_trend(d, r, h)
    start = eq.index[0]
    bh = d["close"][d.index >= start] / d["close"][d.index >= start].iloc[0]
    s, b = stats(eq), stats(bh)
    ra, rb = eq.pct_change().dropna().values, bh.pct_change().dropna().values
    p_boot = block_bootstrap_p(ra, rb)
    closed = [t for t in trades if t["why"] != "open"]
    wins = sum(1 for t in closed if t["ret"] > 0)
    gains = [t["ret"] for t in closed if t["ret"] > 0]; losses = [t["ret"] for t in closed if t["ret"] <= 0]
    trade_stats = {"n": len(closed), "wins": wins, "winrate": round(wins / len(closed), 3) if closed else None,
                   "wilson": wilson(wins, len(closed)), "avg_win": round(float(np.mean(gains)), 4) if gains else None,
                   "avg_loss": round(float(np.mean(losses)), 4) if losses else None,
                   "profit_factor": round(sum(gains) / -sum(losses), 2) if losses else None,
                   "by_stop": sum(1 for t in closed if t["why"] == "stop"), "in_market": round(float((w > 0).mean()), 3),
                   "avg_weight": round(float(w[w > 0].mean()), 3) if (w > 0).any() else None}
    years = {}
    for y in sorted(set(eq.index.year)):
        e, bb = eq[eq.index.year == y], bh[bh.index.year == y]
        prev_e = eq[eq.index < e.index[0]]; prev_b = bh[bh.index < bb.index[0]]
        e0 = prev_e.iloc[-1] if len(prev_e) else e.iloc[0]; b0 = prev_b.iloc[-1] if len(prev_b) else bb.iloc[0]
        years[str(y)] = {"strategy": round(float(e.iloc[-1] / e0 - 1), 4), "buyhold": round(float(bb.iloc[-1] / b0 - 1), 4)}

    # robustness: the same rules with nearby settings, every result kept
    grid = []
    for mas, sa, vt in itertools.product([(20, 50, 100), (50, 100, 200), (100, 150, 200)], [2.0, 3.0, 4.0, None], [0.30, 0.50, 0.80, None]):
        p = {**BASE, "mas": mas, "stop_atr": sa, "vol_target": vt}
        e2, *_ = run_trend(d, r, h, p, start=start)
        st = stats(e2)
        grid.append({"mas": "/".join(map(str, mas)), "stop": sa, "vt": vt, "sharpe": st["sharpe"], "cagr": st["cagr"], "mdd": st["mdd"]})
    beat = sum(1 for g in grid if g["sharpe"] > b["sharpe"])

    out = {
        "name": "Trend + volatility target", "params": {k: (list(v) if isinstance(v, tuple) else v) for k, v in BASE.items()},
        "from": int(start.timestamp()), "to": int(eq.index[-1].timestamp()),
        "strategy": s, "buyhold": b, "p_sharpe": p_boot, "trades": trade_stats, "years": years,
        "grid": grid, "grid_beat": beat, "state": state,
        "eq": [round(float(x), 4) for x in eq.values], "bh": [round(float(x), 4) for x in bh.values],
        "w": [round(float(x), 3) for x in w.values], "t0": int(start.timestamp()),
        "trade_list": trades,
    }
    os.makedirs(os.path.join(OUT, "strategies"), exist_ok=True)
    json.dump(out, open(os.path.join(OUT, "strategies", "trend.json"), "w"), separators=(",", ":"))

    print(f"period {start.date()} -> {eq.index[-1].date()}")
    print(f"{'':12s} {'total':>9s} {'CAGR':>7s} {'vol':>6s} {'Sharpe':>7s} {'Sortino':>8s} {'maxDD':>7s} {'Calmar':>7s}")
    for name, x in [("strategy", s), ("buy & hold", b)]:
        print(f"{name:12s} {x['total']:9.2f} {x['cagr']:7.1%} {x['vol']:6.1%} {x['sharpe']:7.2f} {x['sortino']:8.2f} {x['mdd']:7.1%} {x['calmar']:7.2f}")
    print(f"bootstrap p (strategy Sharpe not higher): {p_boot:.3f}")
    print("trades:", trade_stats)
    print("years:", {y: (v['strategy'], v['buyhold']) for y, v in years.items()})
    print(f"robustness: {beat}/{len(grid)} settings beat buy & hold on Sharpe")
    print("sharpe range:", min(g['sharpe'] for g in grid), max(g['sharpe'] for g in grid))
    print("today:", state)


if __name__ == "__main__":
    main()
