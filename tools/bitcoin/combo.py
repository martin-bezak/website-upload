"""Bitcoin Lab · the first combination: trend as the base position, squeezes as overrides.
Rules fixed before the first run (28 Oct 2026). Spot only, decisions at the daily close (00:00 UTC).

Combo A  base weight 1 when the close is above its 50-, 100- and 200-day averages, else 0.
         A squeeze breakdown (daily close below the squeeze range) overrides to 0 until that trade exits;
         a squeeze breakout (daily close above the range) overrides to 1 until that trade exits.
         Override exits: stop at the other side of the range, target 2R, 20 days; checked every hour.
Combo B  the same, but the base and the breakout weight are min(1, 50% / EWMA volatility) (Strategy 1's sizing);
         weight changes under 10 points are not traded.
Compared with buy-and-hold, trend alone (Combo A without squeezes) and squeeze-sell alone (always 100% BTC
except during breakdown trades). Costs: 0.10% fee + 0.05% slippage per side.

Run:  python3 tools/bitcoin/combo.py      writes BitcoinLab/data/strategies/combo.json
"""
import itertools
import json
import math
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit as A                                   # loads the data once
from audit import h, d, r, hidx, n, cc, day_of, is_close, stats, block_bootstrap_p, halves_and_years, timing_placebo_hourly, bh_curve, COSTS, log
from strategies import ewma_vol, OUT
from squeeze import squeeze_days, BASE as SQ
from engine import trade_stats

o, hh, ll = h["open"].values, h["high"].values, h["low"].values
LAST_STATE = {}


def base_weights(mas, sizing):
    close = d["close"].values
    up = np.ones(len(d), bool)
    for m in mas:
        up &= close > d["close"].rolling(m).mean().values
    up &= np.isfinite(d["close"].rolling(max(mas)).mean().values)
    size = np.minimum(1.0, 0.50 / ewma_vol(r, 0.94).values) if sizing == "vol" else np.ones(len(d))
    size[~np.isfinite(size)] = 0
    return up, size


def squeeze_state(pct=SQ["pct"], range_len=SQ["range_len"]):
    p = {**SQ, "pct": pct, "range_len": range_len}
    sq, rhi, rlo, _ = squeeze_days(d, p)
    idx = np.where(sq, np.arange(len(d)), -1)
    last = np.maximum.accumulate(idx)
    return last, rhi, rlo


def run_combo(mas=(50, 100, 200), sizing="binary", use_trend=True, use_down=True, use_up=True,
              pct=SQ["pct"], range_len=SQ["range_len"], r_target=2.0, max_days=20,
              fee=0.0010, slip=0.0005, stop_slip=0.0, band=0.10, start=None, base_override=None, cash=None, delay=0):
    """base_override: daily target weights (replaces the trend rule); cash: daily cash interest rate (annual, 0.04 = 4%)
    earned on the part of the portfolio not in BTC.
    delay: hours between the daily close and the trade. 0 (the published backtest) trades at the close itself;
    e.g. 4 trades at the 04:00 UTC price, roughly when someone following the nightly website could act.
    Stops and targets are exchange orders placed with the trade, so they are not delayed."""
    up_d, size_d = base_weights(mas, sizing)
    last, rhi, rlo = squeeze_state(pct, range_len)
    cost = fee + slip
    t_first = hidx.searchsorted(start if start is not None else d.index[max(max(mas), SQ["rank_len"] + SQ["rv_len"]) + 1])
    W = np.full(n, np.nan)
    E, w = 1.0, 0.0
    ov, pending, used_setup = None, None, -2
    pend_at, base_at = 0, None          # hours at which a delayed squeeze entry / trend change is executed
    trades, daily_t, daily_e = [], [], []
    base = 0.0
    for t in range(t_first, n):
        fills = []
        if base_at is not None and t >= base_at:
            base_at = None
            if ov is None and pending is None and (abs(base - w) > band or (base == 0) != (w == 0)):
                fills.append((o[t], base))
        if pending is not None and t >= pend_at:
            dirn, stop, sid = pending
            entry = o[t] * (1 + slip * dirn)
            risk = abs(entry - stop) / entry
            if (entry - stop) * dirn > 0 and risk > 0.002:
                target_w = 0.0 if dirn < 0 else (size_d[day_of[t] - 1] if sizing == "vol" else 1.0)
                ov = {"t": t, "dir": dirn, "entry": entry, "stop": stop, "risk": risk, "w": target_w,
                      "target": entry + dirn * r_target * abs(entry - stop)}
                fills.append((o[t], target_w))
                used_setup = sid
            pending = None
        if ov is not None:
            px, why = None, None
            first = ov["t"] == t
            if ov["dir"] > 0:
                if ll[t] <= ov["stop"]:
                    px, why = (ov["stop"] if first else min(ov["stop"], o[t])) * (1 - stop_slip), "stop"
                elif hh[t] >= ov["target"]:
                    px, why = (ov["target"] if first else max(ov["target"], o[t])), "target"
            else:
                if hh[t] >= ov["stop"]:
                    px, why = (ov["stop"] if first else max(ov["stop"], o[t])) * (1 + stop_slip), "stop"
                elif ll[t] <= ov["target"]:
                    px, why = (ov["target"] if first else min(ov["target"], o[t])), "target"
            if px is None and t - ov["t"] >= max_days * 24:
                px, why = cc[t], "time"
            if px is not None:
                gross = ov["dir"] * (px / ov["entry"] - 1)
                trades.append({"in": int(hidx[ov["t"]].timestamp()), "out": int(hidx[t].timestamp()), "dir": ov["dir"],
                               "entry": round(ov["entry"], 2), "exit": round(px, 2), "stop": round(ov["stop"], 2),
                               "target": round(ov["target"], 2), "f": round(ov["w"], 3), "why": why,
                               "ret": round(gross, 5), "R": round((gross - 2 * cost) / ov["risk"], 3), "risk": round(ov["risk"], 4)})
                ov = None
                fills.append((px, base))          # back to the base position
        # this hour's return, split at the fills
        prev = cc[t - 1]
        ret, fee_t, wc = 0.0, 0.0, w
        for px, nw in fills:
            ret += wc * (px / prev - 1); fee_t += abs(nw - wc) * cost; wc, prev = nw, px
        ret += wc * (cc[t] / prev - 1)
        w = wc
        E *= 1 + ret - fee_t
        W[t] = w
        if is_close[t]:
            di = day_of[t]
            if di < len(d):
                # update the base position from today's close
                if base_override is not None:
                    new_base = float(base_override[di])
                else:
                    new_base = (size_d[di] if up_d[di] else 0.0) if use_trend else 1.0
                base = new_base
                if delay:
                    base_at = t + 1 + delay
                elif ov is None and pending is None and (abs(base - w) > band or (base == 0) != (w == 0)):
                    E *= 1 - abs(base - w) * cost
                    w = base
                # squeeze signals at the daily close
                k = last[di]
                armed = k >= 0 and di <= k + SQ["arm_days"] and k != used_setup and di >= 1
                if ov is None and pending is None and armed:
                    if use_down and cc[t] < rlo[k]:
                        pending, pend_at = (-1, rhi[k], k), t + 1 + delay
                    elif use_up and cc[t] > rhi[k]:
                        pending, pend_at = (1, rlo[k], k), t + 1 + delay
            if cash is not None and di < len(d):
                E *= 1 + max(0.0, 1.0 - w) * cash[di] / 365      # interest on the cash part, one day
            daily_t.append(hidx[t].normalize()); daily_e.append(E)
    eq = pd.Series(daily_e, index=pd.DatetimeIndex(daily_t))
    # where the rules stand after the last close (read by profiles.py for today's action)
    LAST_STATE.clear()
    LAST_STATE.update({"w": w, "base": base, "ov": ov, "pending": pending, "used_setup": used_setup})
    return eq / eq.iloc[0], trades, W, t_first


def evaluate(name, kw, start):
    out = {"name": name}
    for ck, (mult, stop_slip) in COSTS.items():
        eq, trades, W, t_first = run_combo(**kw, fee=0.0010 * mult, slip=0.0005 * mult, stop_slip=stop_slip, start=start)
        if ck == "x1":
            bh = bh_curve(eq.index)
            s = stats(eq)
            ra, rb = eq.pct_change().dropna(), bh.pct_change().dropna()
            yearly = halves_and_years(eq)
            worst_year = min(v[0] for v in yearly["years"].values())
            inbtc = float(np.nanmean(W[t_first:] > 0.5))
            out.update({"strategy": s, "buyhold": stats(bh), "p_sharpe_vs_bh": block_bootstrap_p(ra.values, rb.reindex(ra.index).fillna(0).values),
                        "trades": trade_stats(trades), "timing": timing_placebo_hourly(W, t_first, 0.0015), "worst_year": worst_year,
                        "in_btc": round(inbtc, 3), "eq": [round(float(x), 4) for x in eq.values], "t0": int(eq.index[0].timestamp()),
                        "trade_list": trades, **yearly})
        else:
            out.setdefault("costs", {})[ck] = stats(eq)
    out["costs"]["x1"] = out["strategy"]
    return out


def main():
    start = d.index[max(200, SQ["rank_len"] + SQ["rv_len"]) + 1]     # same start for everything compared
    log("combo: start", start.date())
    variants = [
        ("Combo A: trend + squeezes", dict(sizing="binary")),
        ("Combo B: trend + squeezes, vol-sized", dict(sizing="vol")),
        ("Trend only (50/100/200)", dict(sizing="binary", use_down=False, use_up=False)),
        ("Squeeze sell only (hold otherwise)", dict(use_trend=False, use_up=False)),
        ("Combo A without breakout buys", dict(sizing="binary", use_up=False)),
    ]
    res = []
    for name, kw in variants:
        res.append(evaluate(name, kw, start)); log("done", name)

    grid = []
    for mas, pct, L in itertools.product([(20, 50, 100), (50, 100, 200), (100, 150, 200)], [0.10, 0.20, 0.30], [10, 20, 40]):
        eq, tr, W, _ = run_combo(mas=mas, sizing="binary", pct=pct, range_len=L, start=start)
        s = stats(eq)
        grid.append({"mas": "/".join(map(str, mas)), "pct": pct, "range": L, "total": s["total"], "sharpe": s["sharpe"], "mdd": s["mdd"], "calmar": s["calmar"]})
    log("grid done")
    bh = res[0]["buyhold"]
    out = {"start": str(start.date()), "results": res, "grid": grid}
    json.dump(out, open(os.path.join(OUT, "strategies", "combo.json"), "w"), separators=(",", ":"), default=float)

    print(f"\nperiod {start.date()} -> {d.index[-1].date()}   buy & hold: total {bh['total']:.2f}  CAGR {bh['cagr']:.1%}  Sharpe {bh['sharpe']:.2f}  maxDD {bh['mdd']:.1%}  Calmar {bh['calmar']:.2f}")
    print(f"{'':40s} {'total':>7s} {'CAGR':>6s} {'Sharpe':>6s} {'maxDD':>6s} {'Calmar':>6s} {'worstY':>7s} {'inBTC':>5s} {'boot p':>6s} {'timing p':>8s} {'x3 total':>8s} {'x3 Sh':>5s}")
    for x in res:
        s = x["strategy"]
        print(f"{x['name']:40s} {s['total']:7.2f} {s['cagr']:6.1%} {s['sharpe']:6.2f} {s['mdd']:6.1%} {s['calmar']:6.2f} {x['worst_year']:7.1%} {x['in_btc']:5.0%} {x['p_sharpe_vs_bh']:6.3f} {x['timing']['p']:8.3f} {x['costs']['x3']['total']:8.2f} {x['costs']['x3']['sharpe']:5.2f}")
    print()
    for x in res:
        h1, h2 = x["halves"]
        print(f"{x['name']:40s} halves Sharpe {h1['strategy']['sharpe']:.2f}/{h1['buyhold']['sharpe']:.2f} | {h2['strategy']['sharpe']:.2f}/{h2['buyhold']['sharpe']:.2f}"
              f"   total {h1['strategy']['total']:.2f}/{h1['buyhold']['total']:.2f} | {h2['strategy']['total']:.2f}/{h2['buyhold']['total']:.2f}   trades {x['trades'].get('n')} meanR {x['trades'].get('meanR')}")
    print()
    for x in res:
        print(f"{x['name']:40s}", {y: f"{a:+.0%}" for y, (a, b) in x["years"].items()})
    print(f"{'buy & hold':40s}", {y: f"{b:+.0%}" for y, (a, b) in res[0]["years"].items()})
    beat_t = sum(g["total"] > bh["total"] for g in grid); beat_s = sum(g["sharpe"] > bh["sharpe"] for g in grid); less = sum(g["mdd"] > bh["mdd"] * 0.7 for g in grid)
    print(f"\nrobustness, Combo A over 27 settings: {beat_t}/27 beat B&H total, {beat_s}/27 beat Sharpe, {less}/27 worst drop 30%+ smaller")
    print(f"  total {min(g['total'] for g in grid):.1f}..{max(g['total'] for g in grid):.1f}  Sharpe {min(g['sharpe'] for g in grid):.2f}..{max(g['sharpe'] for g in grid):.2f}  maxDD {min(g['mdd'] for g in grid):.0%}..{max(g['mdd'] for g in grid):.0%}")


if __name__ == "__main__":
    main()
