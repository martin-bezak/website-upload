"""Bitcoin Lab · strategy audit: every strategy through the same checks, judged against the two goals
(beat buy-and-hold, or be clearly less risky than it).

Pre-registered main hypotheses (fixed before this script was first run, 28 Oct 2026), Holm-corrected together:
  H0  Rhymes as a trade (long/short) beats random entries with the same exits
  H1  Trend + vol target beats buy-and-hold on Sharpe (block bootstrap)
  H2  Crowded leverage, hold-and-sell, beats random entries
  H3a Squeeze breakdown, hold-and-sell, beats random entries
  H3b Squeeze breakout, long only, beats random entries
Everything else (other modes, daily triggers, crowding components) is exploratory and labelled so.

Checks for every strategy: full period vs buy-and-hold, first and second half, each year, costs x1/x2/x3
(+0.5% worse stop fills at x2 and x3), trade placebo (random entry times, same exits), timing placebo
(the same hour-by-hour positions shifted to random dates), block bootstrap of Sharpe vs buy-and-hold.

Run:  python3 tools/bitcoin/audit.py      writes BitcoinLab/data/strategies/audit.json
"""
import json
import math
import os
import sys
import time

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data as D                                                    # noqa: E402
from strategies import prepare, stats, block_bootstrap_p, run_trend, BASE as TREND, OUT   # noqa: E402
from squeeze import squeeze_days, BASE as SQ                        # noqa: E402
from crowded import crowding, signals as crowd_signals, BASE as CR  # noqa: E402
from engine import run, trade_stats, placebo                        # noqa: E402

T0 = time.time()
H = D.hourly()
d, r, h = prepare(H)
hidx = h.index
n = len(h)
cc = h["close"].values
day_of = d.index.searchsorted(hidx.normalize())
is_close = (hidx.hour == 23)
hret = np.r_[0, cc[1:] / cc[:-1] - 1]
COMMON = {"risk": 0.02, "fee": 0.0010, "slip": 0.0005}
COSTS = {"x1": (1, 0.0), "x2": (2, 0.005), "x3": (3, 0.005)}


def log(*a):
    print(f"[{time.time() - T0:5.0f}s]", *a, flush=True)


# ---------------------------------------------------------------- signal builders (all decided at an hour's close)

def sig_squeeze(daily_trigger=False):
    sq, rhi, rlo, _ = squeeze_days(d, SQ)
    idx = np.where(sq, np.arange(len(d)), -1)
    last = np.maximum.accumulate(idx)                       # most recent squeeze day up to each day
    k = np.full(n, -1)
    ok = day_of >= 1
    k[ok] = last[day_of[ok] - 1]                            # squeeze days up to yesterday
    armed = (k >= 0) & (day_of <= k + SQ["arm_days"])
    hi = np.where(k >= 0, rhi[np.maximum(k, 0)], np.nan)
    lo = np.where(k >= 0, rlo[np.maximum(k, 0)], np.nan)
    trig = is_close if daily_trigger else np.ones(n, bool)
    p = {**COMMON, "r_target": SQ["r_target"], "max_hours": SQ["max_days"] * 24, "cooldown": 0}
    start = hidx.searchsorted(d.index[SQ["rank_len"] + SQ["rv_len"] + 1])
    return dict(long_sig=armed & (cc > hi) & trig, long_stop=lo, short_sig=armed & (cc < lo) & trig, short_stop=hi,
                setup=k, t_first=start, p=p)


_crowd = {}
def sig_crowded(component=None):
    if "score" not in _crowd:
        _crowd["score"], _crowd["parts"] = crowding(h, d, CR)
    score = _crowd["score"] if component is None else _crowd["parts"][component]
    ls, lstop, ss, sstop = crowd_signals(h, d, score, CR)
    first = _crowd["score"].first_valid_index()
    p = {**COMMON, "r_target": CR["r_target"], "max_hours": CR["max_hours"], "cooldown": CR["cooldown"]}
    return dict(long_sig=ls, long_stop=lstop, short_sig=ss, short_stop=sstop, setup=None,
                t_first=hidx.searchsorted(first + pd.Timedelta(days=1)), p=p)


def sig_rhymes(window=90, k=40, horizon=10, up=0.60, down=0.40, atr_mult=2.0, min_cand=365):
    """Each daily close: the 40 most similar past 90-day shapes whose next 10 days were already known."""
    lp = np.log(d["close"].values)
    nd = len(lp)
    idx = np.arange(window - 1, nd)
    Z = np.stack([lp[i - window + 1:i + 1] for i in idx])
    Z = (Z - Z.mean(1, keepdims=True)) / Z.std(1, keepdims=True)
    fwd = np.full(nd, np.nan)
    fwd[:-horizon] = lp[horizon:] - lp[:-horizon]
    pup = np.full(nd, np.nan)
    for i in range(window - 1, nd):
        cand = idx[idx <= i - horizon]
        if len(cand) < min_cand:
            continue
        s = Z[cand - (window - 1)] @ Z[i - (window - 1)] / window
        picked = []
        for j in np.argsort(-s):
            if all(abs(cand[j] - cand[m]) >= window // 3 for m in picked):
                picked.append(j)
                if len(picked) == k:
                    break
        pup[i] = np.mean(fwd[cand[picked]] > 0)
    atr = d["atr14"].values
    closes = d["close"].values
    L = np.zeros(n, bool); S = np.zeros(n, bool); Ls = np.full(n, np.nan); Ss = np.full(n, np.nan)
    hrs = np.nonzero(is_close)[0]
    di = day_of[hrs]
    ok = di < nd
    hrs, di = hrs[ok], di[ok]
    L[hrs] = pup[di] >= up
    S[hrs] = pup[di] <= down
    Ls[hrs] = closes[di] - atr_mult * atr[di]
    Ss[hrs] = closes[di] + atr_mult * atr[di]
    first = np.nonzero(np.isfinite(pup))[0][0]
    p = {**COMMON, "r_target": 2.0, "max_hours": horizon * 24, "cooldown": 24}
    return dict(long_sig=L, long_stop=Ls, short_sig=S, short_stop=Ss, setup=None,
                t_first=hidx.searchsorted(d.index[first] + pd.Timedelta(hours=23)), p=p), pup


# ---------------------------------------------------------------- checks

def bh_curve(index):
    c = d["close"].reindex(index)
    return c / c.iloc[0]


def halves_and_years(eq):
    bh = bh_curve(eq.index)
    mid = eq.index[len(eq) // 2]
    out = {"split": str(mid.date()), "halves": []}
    for a, b in [(eq.index[0], mid), (mid, eq.index[-1])]:
        e, x = eq[(eq.index >= a) & (eq.index <= b)], bh[(bh.index >= a) & (bh.index <= b)]
        out["halves"].append({"strategy": stats(e / e.iloc[0]), "buyhold": stats(x / x.iloc[0])})
    yrs = {}
    for y in sorted(set(eq.index.year)):
        e, x = eq[eq.index.year == y], bh[bh.index.year == y]
        pe, px = eq[eq.index < e.index[0]], bh[bh.index < x.index[0]]
        yrs[str(y)] = [round(float(e.iloc[-1] / (pe.iloc[-1] if len(pe) else e.iloc[0]) - 1), 4),
                       round(float(x.iloc[-1] / (px.iloc[-1] if len(px) else x.iloc[0]) - 1), 4)]
    out["years"] = yrs
    return out


def timing_placebo_hourly(W, t_first, cost, sets=1000, seed=3):
    """Shift the hour-by-hour weights to random dates (whole days, circular within the test period)."""
    w = np.nan_to_num(W[t_first:])
    rr = hret[t_first:]
    days = len(w) // 24
    w, rr = w[:days * 24], rr[:days * 24]

    def sharpe(ws):
        x = np.r_[0, ws[:-1]] * rr - np.abs(np.diff(np.r_[0, ws])) * cost
        dd = x.reshape(days, 24).sum(1)
        return dd.mean() / (dd.std() or 1) * math.sqrt(365)
    actual = sharpe(w)
    rng = np.random.default_rng(seed)
    sims = np.array([sharpe(np.roll(w, int(rng.integers(30, days - 30)) * 24)) for _ in range(sets)])
    return {"sharpe": round(float(actual), 3), "placebo_mean": round(float(sims.mean()), 3),
            "p": round(float((sims >= actual).mean()), 4)}


def evaluate_signal(name, sig, mode, exploratory, do_placebo=True):
    out = {"name": name, "mode": mode, "exploratory": exploratory}
    for ck, (mult, stop_slip) in COSTS.items():
        p = {**sig["p"], "fee": sig["p"]["fee"] * mult, "slip": sig["p"]["slip"] * mult, "stop_slip": stop_slip}
        eq, trades, W = run(h, sig["long_sig"], sig["long_stop"], sig["short_sig"], sig["short_stop"], p, mode,
                            sig["t_first"], sig["setup"])
        if ck == "x1":
            bh = bh_curve(eq.index)
            out.update({"from": str(eq.index[0].date()), "to": str(eq.index[-1].date()),
                        "strategy": stats(eq), "buyhold": stats(bh), "trades": trade_stats(trades)})
            ra, rb = eq.pct_change().dropna(), bh.pct_change().dropna()
            out["p_sharpe_vs_bh"] = block_bootstrap_p(ra.values, rb.reindex(ra.index).fillna(0).values)
            out.update(halves_and_years(eq))
            if do_placebo and trades:
                pm = placebo(h, trades, p, sets=500, t_lo=sig["t_first"])
                out["placebo_R"] = {"mean": round(float(pm.mean()), 3), "p": round(float((pm >= out["trades"]["meanR"]).mean()), 4)}
                out["placebo_timing"] = timing_placebo_hourly(W, sig["t_first"], p["fee"] + p["slip"])
            out["eq"] = [round(float(x), 4) for x in eq.values[::7]]
        else:
            out.setdefault("costs", {})[ck] = stats(eq)
    out["costs"]["x1"] = out["strategy"]
    return out


def evaluate_trend():
    out = {"name": "Trend + vol target", "mode": "spot weights", "exploratory": False}
    for ck, (mult, stop_slip) in COSTS.items():
        p = {**TREND, "fee": TREND["fee"] * mult, "slip": TREND["slip"] * mult, "stop_slip": stop_slip}
        eq, w, trades, state = run_trend(d, r, h, p)
        if ck == "x1":
            bh = bh_curve(eq.index)
            out.update({"from": str(eq.index[0].date()), "to": str(eq.index[-1].date()), "strategy": stats(eq), "buyhold": stats(bh)})
            ra, rb = eq.pct_change().dropna(), bh.pct_change().dropna()
            out["p_sharpe_vs_bh"] = block_bootstrap_p(ra.values, rb.reindex(ra.index).fillna(0).values)
            out.update(halves_and_years(eq))
            # timing placebo on daily weights
            ww = w.values; rd = bh.pct_change().fillna(0).values; cost = p["fee"] + p["slip"]
            sh = lambda x: (lambda y: y.mean() / (y.std() or 1) * math.sqrt(365))(np.r_[0, x[:-1]] * rd - np.abs(np.diff(np.r_[0, x])) * cost)
            act = sh(ww); rng = np.random.default_rng(5)
            sims = np.array([sh(np.roll(ww, int(rng.integers(30, len(ww) - 30)))) for _ in range(1000)])
            out["placebo_timing"] = {"sharpe": round(float(act), 3), "placebo_mean": round(float(sims.mean()), 3), "p": round(float((sims >= act).mean()), 4)}
            closed = [t for t in trades if t["why"] != "open"]
            out["trades"] = {"n": len(closed), "winrate": round(np.mean([t["ret"] > 0 for t in closed]), 3)}
            out["eq"] = [round(float(x), 4) for x in eq.values[::7]]
        else:
            out.setdefault("costs", {})[ck] = stats(eq)
    out["costs"]["x1"] = out["strategy"]
    return out


def holm(ps):
    order = sorted(range(len(ps)), key=lambda i: ps[i])
    adj = [None] * len(ps); m = len(ps); run_max = 0
    for rank, i in enumerate(order):
        run_max = max(run_max, min(1.0, (m - rank) * ps[i]))
        adj[i] = round(run_max, 4)
    return adj


def goals(x):
    s, b = x["strategy"], x["buyhold"]
    h1, h2 = x["halves"]
    return {
        "beats_return": s["total"] > b["total"],
        "beats_sharpe": s["sharpe"] > b["sharpe"],
        "less_risky": s["mdd"] > b["mdd"] * 0.7,                     # worst drop at least 30% smaller
        "both_halves_sharpe": h1["strategy"]["sharpe"] > h1["buyhold"]["sharpe"] and h2["strategy"]["sharpe"] > h2["buyhold"]["sharpe"],
        "survives_x3": x["costs"]["x3"]["sharpe"] > b["sharpe"],
    }


def main():
    res = []
    log("data ready", len(h), "hours")
    sq_h, sq_d = sig_squeeze(False), sig_squeeze(True)
    log("squeeze signals")
    rh, pup = sig_rhymes()
    log("rhymes signals")
    cr = sig_crowded()
    log("crowding signals")

    res.append(evaluate_trend()); log("trend done")
    for mode in ["long", "longshort", "hold_sell"]:
        res.append(evaluate_signal("Squeeze, hourly trigger", sq_h, mode, mode == "longshort")); log("squeeze hourly", mode)
        res.append(evaluate_signal("Squeeze, daily-close trigger", sq_d, mode, True)); log("squeeze daily", mode)
        res.append(evaluate_signal("Rhymes as a trade", rh, mode, mode != "longshort")); log("rhymes", mode)
        res.append(evaluate_signal("Crowded leverage", cr, mode, mode != "hold_sell")); log("crowded", mode)
    for comp in ["funding", "premium", "oi", "top_ls"]:
        for mode in ["longshort", "hold_sell"]:
            res.append(evaluate_signal(f"Crowding: {comp} only", sig_crowded(comp), mode, True, do_placebo=True)); log("component", comp, mode)

    # pre-registered family
    def find(name, mode):
        return next(x for x in res if x["name"] == name and x["mode"] == mode)
    fam = [("H0 Rhymes long/short vs random entries", find("Rhymes as a trade", "longshort")["placebo_R"]["p"]),
           ("H1 Trend Sharpe vs buy-and-hold", find("Trend + vol target", "spot weights")["p_sharpe_vs_bh"]),
           ("H2 Crowded hold-and-sell vs random entries", find("Crowded leverage", "hold_sell")["placebo_R"]["p"]),
           ("H3a Squeeze hold-and-sell vs random entries", find("Squeeze, hourly trigger", "hold_sell")["placebo_R"]["p"]),
           ("H3b Squeeze long vs random entries", find("Squeeze, hourly trigger", "long")["placebo_R"]["p"])]
    adj = holm([p for _, p in fam])
    family = [{"h": hname, "p": p, "holm": a} for (hname, p), a in zip(fam, adj)]
    for x in res:
        x["goals"] = goals(x)
    out = {"built": time.strftime("%Y-%m-%d"), "results": res, "family": family}
    os.makedirs(os.path.join(OUT, "strategies"), exist_ok=True)
    json.dump(out, open(os.path.join(OUT, "strategies", "audit.json"), "w"), separators=(",", ":"), default=float)

    # report
    print("\n================ PRE-REGISTERED HYPOTHESES (Holm-corrected) ================")
    for f in family:
        print(f"  {f['h']:48s} p = {f['p']:.4f}   Holm p = {f['holm']:.4f}   {'SIGNIFICANT' if f['holm'] < 0.05 else 'not significant'}")
    print("\n================ ALL STRATEGIES ================")
    for x in res:
        s, b, g = x["strategy"], x["buyhold"], x["goals"]
        h1, h2 = x["halves"]
        t = x.get("trades", {})
        print(f"\n{x['name']} [{x['mode']}]{' (exploratory)' if x['exploratory'] else ''}  {x['from']} -> {x['to']}")
        print(f"  strategy  total {s['total']:8.2f}  CAGR {s['cagr']:6.1%}  Sharpe {s['sharpe']:5.2f}  maxDD {s['mdd']:6.1%}  Calmar {s['calmar'] or 0:5.2f}")
        print(f"  buy&hold  total {b['total']:8.2f}  CAGR {b['cagr']:6.1%}  Sharpe {b['sharpe']:5.2f}  maxDD {b['mdd']:6.1%}   boot p {x['p_sharpe_vs_bh']:.3f}")
        print(f"  halves (split {x['split']}): Sharpe {h1['strategy']['sharpe']:.2f} vs {h1['buyhold']['sharpe']:.2f} | {h2['strategy']['sharpe']:.2f} vs {h2['buyhold']['sharpe']:.2f}"
              f"   total {h1['strategy']['total']:.2f} vs {h1['buyhold']['total']:.2f} | {h2['strategy']['total']:.2f} vs {h2['buyhold']['total']:.2f}")
        print(f"  costs x2 Sharpe {x['costs']['x2']['sharpe']:.2f} total {x['costs']['x2']['total']:.2f} | x3 Sharpe {x['costs']['x3']['sharpe']:.2f} total {x['costs']['x3']['total']:.2f}")
        if "placebo_R" in x:
            print(f"  trades {t.get('n')}  win {t.get('winrate')}  meanR {t.get('meanR')}   placebo R p {x['placebo_R']['p']}   timing placebo p {x['placebo_timing']['p']}")
        elif "placebo_timing" in x:
            print(f"  trades {t.get('n')}  win {t.get('winrate')}   timing placebo p {x['placebo_timing']['p']}")
        print("  goals:", {k: v for k, v in g.items()})
        print("  years:", {y: f"{a:+.0%}/{b_:+.0%}" for y, (a, b_) in x["years"].items()})
    log("audit done")


if __name__ == "__main__":
    main()
