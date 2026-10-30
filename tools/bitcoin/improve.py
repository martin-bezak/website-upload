"""Bitcoin Lab · improvements, judged by walk-forward selection (protocol fixed before the first run, 28 Oct 2026).

Cash interest: the part of the portfolio not in BTC earns the 3-month US T-bill rate of that day
(FRED DTB3, tools/bitcoin/tbill-dtb3.csv); a 'half rate' version checks the effect of lower stablecoin yields.

32 candidate rule sets = every combination of:
  trend form   binary (all averages agree -> 1) | graded (1/3 per average the close is above)
  buffer       none | 2% (an average only flips when the close is 2% beyond it)
  MA sets      one (50/100/200) | ensemble of three (20/50/100, 50/100/200, 100/150/200), averaged
  squeezes     off | on (breakdown -> 0, breakout -> full size, until stop / 2R / 20 days)
  size         full | volatility-targeted (min(1, 50% / EWMA vol))
Combo A and Combo B from combo.py are two of the 32 (binary, no buffer, one set, squeezes on, full / vol).

Judges (out of sample, 2020-01-01 to the latest data):
  walk-forward   each 1 January, pick the rule set with the best Sharpe on data up to that day only, trade it for the year
  ensemble       no picking at all: equal capital in all 32 rule sets
  fixed          Combo A / Combo B as pre-registered before any of this
If walk-forward picking does not beat the fixed rules, the improvements are treated as curve-fitting.

Run:  python3 tools/bitcoin/improve.py      writes BitcoinLab/data/strategies/improve.json
"""
import itertools
import json
import math
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo import run_combo, d, r, h, hidx, is_close, day_of, stats, block_bootstrap_p, bh_curve, log  # noqa: E402
from strategies import ewma_vol, OUT  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MA_SETS = [(20, 50, 100), (50, 100, 200), (100, 150, 200)]
OOS_FROM = pd.Timestamp("2020-01-01", tz="UTC")
COST = 0.0015


def tbill():
    t = pd.read_csv(os.path.join(HERE, "tbill-dtb3.csv"))
    t.columns = ["d", "r"]
    t["r"] = pd.to_numeric(t["r"], errors="coerce") / 100
    s = t.set_index(pd.to_datetime(t["d"], utc=True))["r"]
    return s.reindex(d.index, method="ffill").fillna(0).values      # weekends/holidays: last known rate


def above(m, band):
    close = d["close"].values
    ma = d["close"].rolling(m).mean().values
    st = np.zeros(len(d), bool)
    cur = False
    for i in range(len(d)):
        if not np.isfinite(ma[i]):
            cur = False
        elif close[i] > ma[i] * (1 + band):
            cur = True
        elif close[i] < ma[i] * (1 - band):
            cur = False
        st[i] = cur
    return st


_ab = {}
def trend_base(form, band, ens, sizing):
    sets = MA_SETS if ens else [(50, 100, 200)]
    parts = []
    for s in sets:
        inds = np.stack([_ab.setdefault((m, band), above(m, band)) for m in s]).astype(float)
        parts.append(inds.min(0) if form == "binary" else inds.mean(0))
    base = np.mean(parts, axis=0)
    if sizing == "vol":
        size = np.minimum(1.0, 0.50 / ewma_vol(r, 0.94).values)
        size[~np.isfinite(size)] = 0
        base = base * size
    return base


def daily_weights(W):
    out = np.full(len(d), np.nan)
    idx = np.nonzero(is_close)[0]
    di = day_of[idx]
    ok = di < len(d)
    out[di[ok]] = W[idx[ok]]
    return out


def main():
    rf = tbill()
    start = pd.Timestamp("2018-09-07", tz="UTC")       # same start as the combo test
    configs = list(itertools.product(["binary", "graded"], [0.0, 0.02], [False, True], [False, True], ["full", "vol"]))
    names = [f"{f}|buf{int(b * 100)}|{'ens' if e else 'one'}|{'sq' if s else 'nosq'}|{z}" for f, b, e, s, z in configs]
    rets, wts = {}, {}
    for (f, b, e, s, z), nm in zip(configs, names):
        base = trend_base(f, b, e, z)
        eq, tr, W, _ = run_combo(sizing="vol" if z == "vol" else "binary", use_down=s, use_up=s, start=start, base_override=base, cash=rf)
        rets[nm] = eq.pct_change().fillna(0)
        wts[nm] = pd.Series(daily_weights(W), index=d.index).reindex(eq.index)
    log("32 rule sets done")
    R = pd.DataFrame(rets)
    Wd = pd.DataFrame(wts).fillna(0)

    # extra reference strategies
    def curve(**kw):
        eq, *_ = run_combo(start=start, **kw)
        return eq.pct_change().fillna(0)
    ref = {
        "Combo A (no interest)": curve(sizing="binary"),
        "Combo B (no interest)": curve(sizing="vol"),
        "Combo A + interest": R["binary|buf0|one|sq|full"],
        "Combo B + interest": R["binary|buf0|one|sq|vol"],
        "Combo B + half interest": curve(sizing="vol", cash=rf * 0.5),
        "Growth: squeeze sell + interest": curve(use_trend=False, use_up=False, cash=rf),
        "Growth: squeeze sell (no interest)": curve(use_trend=False, use_up=False),
    }

    # walk-forward selection
    years = sorted(set(R.index[R.index >= OOS_FROM].year))
    wf, picks, prev = [], {}, None
    for y in years:
        y0 = pd.Timestamp(f"{y}-01-01", tz="UTC")
        hist = R[R.index < y0]
        sh = hist.mean() / hist.std() * math.sqrt(365)
        pick = sh.idxmax()
        picks[str(y)] = {"pick": pick, "sharpe_in_sample": round(float(sh.max()), 3)}
        part = R.loc[(R.index >= y0) & (R.index < pd.Timestamp(f"{y + 1}-01-01", tz="UTC")), pick].copy()
        if prev is not None and prev != pick and len(part):
            part.iloc[0] -= abs(Wd.loc[part.index[0], pick] - Wd.loc[part.index[0], prev]) * COST   # cost of switching rule sets
        wf.append(part); prev = pick
    WF = pd.concat(wf)
    ENS = R.mean(axis=1)

    oos = R.index >= OOS_FROM
    BH = bh_curve(R.index).pct_change().fillna(0)
    table = {"Buy & hold": BH[oos], "Walk-forward picked": WF, "Ensemble of all 32": ENS[oos]}
    table.update({k: v[oos] for k, v in ref.items()})
    res = {}
    for k, v in table.items():
        eq = (1 + v).cumprod()
        s = stats(eq / eq.iloc[0] if eq.iloc[0] else eq)
        yrs = {str(y): round(float((1 + v[v.index.year == y]).prod() - 1), 4) for y in years}
        res[k] = {**s, "multiple": round(float(eq.iloc[-1]), 2), "worst_year": min(yrs.values()), "years": yrs,
                  "p_vs_bh": None if k == "Buy & hold" else block_bootstrap_p(v.values, BH[oos].reindex(v.index).fillna(0).values)}
    # out-of-sample spread of the 32 rule sets (what a random pick would have given)
    oos_sh = (R[oos].mean() / R[oos].std() * math.sqrt(365)).sort_values()
    oos_mult = (1 + R[oos]).prod().sort_values()

    # what each component does, on average across the other settings (full period, Sharpe)
    full_sh = R.mean() / R.std() * math.sqrt(365)
    comp = {}
    for i, label in enumerate(["graded vs binary", "2% buffer vs none", "3 MA sets vs one", "squeezes on vs off", "vol-sized vs full"]):
        on = [nm for nm, c in zip(names, configs) if c[i] in ("graded", 0.02, True, "vol")]
        off = [nm for nm in names if nm not in on]
        pairs = [(a, b) for a in on for b in off if sum(x != y for x, y in zip(a.split("|"), b.split("|"))) == 1]
        dsh = [full_sh[a] - full_sh[b] for a, b in pairs]
        dmult = [math.log((1 + R[a]).prod() / (1 + R[b]).prod()) for a, b in pairs]
        comp[label] = {"sharpe_diff": round(float(np.mean(dsh)), 3), "better_in": f"{sum(x > 0 for x in dsh)}/{len(dsh)}",
                       "return_ratio": round(float(math.exp(np.mean(dmult))), 3)}

    out = {"oos_from": str(OOS_FROM.date()), "results": res, "picks": picks, "components": comp,
           "oos_sharpe_range": [round(float(oos_sh.iloc[0]), 3), round(float(oos_sh.median()), 3), round(float(oos_sh.iloc[-1]), 3)],
           "oos_multiple_range": [round(float(oos_mult.iloc[0]), 2), round(float(oos_mult.median()), 2), round(float(oos_mult.iloc[-1]), 2)]}
    json.dump(out, open(os.path.join(OUT, "strategies", "improve.json"), "w"), separators=(",", ":"), default=float)

    print(f"\nOUT OF SAMPLE {OOS_FROM.date()} -> {R.index[-1].date()}")
    print(f"{'':36s} {'$1 ->':>7s} {'CAGR':>6s} {'Sharpe':>6s} {'maxDD':>6s} {'worstY':>7s} {'p vs B&H':>8s}")
    for k, x in res.items():
        print(f"{k:36s} {x['multiple']:7.2f} {x['cagr']:6.1%} {x['sharpe']:6.2f} {x['mdd']:6.1%} {x['worst_year']:7.1%} {('%.3f' % x['p_vs_bh']) if x['p_vs_bh'] is not None else '':>8s}")
    print("\nyears:")
    for k, x in res.items():
        print(f"  {k:36s}", {y: f"{v:+.0%}" for y, v in x["years"].items()})
    print("\nwalk-forward picks:", {y: v["pick"] for y, v in picks.items()})
    print(f"32 rule sets out of sample: Sharpe min/median/max {out['oos_sharpe_range']}, $1 -> {out['oos_multiple_range']}")
    print("\ncomponents (full period, paired with everything else equal):")
    for k, v in comp.items():
        print(f"  {k:22s} Sharpe {v['sharpe_diff']:+.3f}  better in {v['better_in']}  return x{v['return_ratio']}")


if __name__ == "__main__":
    main()
