"""Bitcoin Lab · the three strategy profiles shown on the Strategy page, plus comparison assets.

  Growth     hold BTC; sell everything on a squeeze breakdown until that trade ends (stop / 2R / 20 days)
  Balanced   Combo A: BTC when the close is above its 50-, 100- and 200-day averages, else cash;
             squeeze breakdowns sell and squeeze breakouts buy, overriding the trend until the trade ends
  Defensive  Combo B: Balanced, but the BTC part is sized for 50% annual volatility
All three earn the 3-month T-bill rate on cash. Rules as tested in combo.py / improve.py (28 Oct 2026).

Comparisons (daily, from the same start):
  BTC        buy and hold, Binance spot close (Binance Vision, CC BY-NC-SA 4.0)
  Cash       3-month US T-bill rate, compounded daily (FRED DTB3)
  Bonds      10-year US Treasury, total return approximated from FRED DGS10 yields:
             daily return = yesterday's yield / 365 - 8.0 x change in yield + 0.5 x 80 x change^2
  S&P 500    SPY ETF incl. dividends (Yahoo Finance; check Yahoo's terms before publishing)

Run:  python3 tools/bitcoin/profiles.py      writes BitcoinLab/data/profiles.json
"""
import json
import math
import os
import sys
import time
import urllib.request

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo as C                                      # noqa: E402
import data as D                                       # noqa: E402
from combo import run_combo, d, is_close, day_of, stats  # noqa: E402
from improve import tbill                              # noqa: E402
from squeeze import BASE as SQ                         # noqa: E402
from strategies import ewma_vol, wilson, OUT           # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
START = pd.Timestamp("2018-09-07", tz="UTC")
PROFILES = {
    "growth": {"name": "Growth", "kw": dict(use_trend=False, use_up=False)},
    "balanced": {"name": "Balanced", "kw": dict(sizing="binary")},
    "defensive": {"name": "Defensive", "kw": dict(sizing="vol")},
}


def fred(series):
    path = os.path.join(HERE, {"DGS10": "fred-dgs10.csv", "DTB3": "tbill-dtb3.csv"}[series])
    try:
        blob = urllib.request.urlopen(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}", timeout=30).read()
        if blob.startswith(b"observation_date"):
            open(path, "wb").write(blob)
    except Exception as e:
        print("FRED download failed, using the saved file:", e)
    t = pd.read_csv(path)
    t.columns = ["d", "v"]
    s = pd.Series(pd.to_numeric(t["v"], errors="coerce").values, index=pd.to_datetime(t["d"], utc=True)) / 100
    return s.reindex(d.index, method="ffill")


def spy():
    path = os.path.join(D.CACHE, "spy.json")              # next to the Binance cache (the Actions cache in CI)
    try:
        url = (f"https://query1.finance.yahoo.com/v8/finance/chart/SPY?period1={int(START.timestamp()) - 86400 * 10}"
               f"&period2={int(time.time())}&interval=1d&events=div%2Csplit&includeAdjustedClose=true")
        blob = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
        json.loads(blob)["chart"]["result"][0]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "wb").write(blob)
    except Exception as e:
        print("SPY download failed, using the saved file:", e)
    if not os.path.exists(path):
        return None                                        # no S&P data at all yet: the page simply hides that line
    r = json.load(open(path))["chart"]["result"][0]
    s = pd.Series(r["indicators"]["adjclose"][0]["adjclose"], index=pd.to_datetime(r["timestamp"], unit="s", utc=True).normalize())
    s = s[~s.index.duplicated(keep="last")].dropna()
    return s.reindex(d.index, method="ffill")


def daily_weights(W):
    out = np.full(len(d), np.nan)
    idx = np.nonzero(is_close)[0]
    di = day_of[idx]
    ok = di < len(d)
    out[di[ok]] = W[idx[ok]]
    return pd.Series(out, index=d.index)


def spells(close, w):
    """Holding periods (in BTC) and cash periods; a holding period is right if BTC rose during it,
    a cash period is right if BTC fell (or was flat) during it."""
    inb = (w > 0.01).values
    out = {"in": [], "cash": []}
    i0 = 0
    for i in range(1, len(inb) + 1):
        if i == len(inb) or inb[i] != inb[i0]:
            a, b = close.iloc[i0], close.iloc[min(i, len(inb) - 1)]
            out["in" if inb[i0] else "cash"].append({"from": int(close.index[i0].timestamp()), "to": int(close.index[min(i, len(inb) - 1)].timestamp()),
                                                     "btc": round(float(b / a - 1), 4), "open": i == len(inb)})
            i0 = i
    res = {}
    for k, xs in out.items():
        done = [x for x in xs if not x["open"]]
        wins = sum((x["btc"] > 0) if k == "in" else (x["btc"] <= 0) for x in done)
        lo, hi = wilson(wins, len(done)) if done else (None, None)
        res[k] = {"n": len(done), "right": wins, "ci": [lo, hi],
                  "median_btc": round(float(np.median([x["btc"] for x in done])), 4) if done else None,
                  "list": xs[-12:]}
    return res


LATE_H = 4               # "traded late" score: every trade this many hours after the 00:00 UTC close (about when the page updates)
INCLUDE_SP500 = True     # SPY comes from Yahoo Finance: set to False to drop the S&P 500 line if its terms don't allow it


def main():
    fred("DTB3")             # refresh the saved T-bill file (tbill() reads it)
    rf = tbill()
    y10 = fred("DGS10").ffill()
    sp = spy() if INCLUDE_SP500 else None
    sel = d.index >= START
    days = d.index[sel]
    close = d["close"][sel]

    cash_idx = np.cumprod(1 + np.r_[0, rf[sel][1:] / 365])
    dy = y10.diff().fillna(0)
    bond_ret = (y10.shift(1) / 365 - 8.0 * dy + 0.5 * 80 * dy ** 2).fillna(0)[sel]
    bond_ret.iloc[0] = 0
    bonds_idx = np.cumprod(1 + bond_ret.values)
    sp_sel = sp[sel].ffill().bfill() if sp is not None else None

    ma = {m: float(d["close"].rolling(m).mean().iloc[-1]) for m in (50, 100, 200)}
    last_close = float(d["close"].iloc[-1])
    vol_now = float(ewma_vol(C.r, 0.94).iloc[-1])
    last_sq, rhi, rlo = C.squeeze_state()
    di = len(d) - 1
    k = int(last_sq[di])
    armed = k >= 0 and di < k + SQ["arm_days"]
    squeeze = {"armed": bool(armed), "lo": round(float(rlo[k]), 2) if armed else None, "hi": round(float(rhi[k]), 2) if armed else None,
               "until": int((d.index[k] + pd.Timedelta(days=SQ["arm_days"])).timestamp()) if armed else None}

    out = {"built": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "t0": int(days[0].timestamp()), "n": len(days),
           "last": int(days[-1].timestamp()), "price": round(last_close, 2), "rf_now": round(float(rf[-1]), 4),
           "series": {"btc": [round(float(x), 2) for x in close.values],
                      "cash": [round(float(x), 5) for x in cash_idx],
                      "bonds": [round(float(x), 5) for x in bonds_idx],
                      **({"sp500": [round(float(x), 3) for x in sp_sel.values]} if sp_sel is not None else {})},
           "levels": {"close": round(last_close, 2), "ma50": round(ma[50], 2), "ma100": round(ma[100], 2), "ma200": round(ma[200], 2),
                      "vol": round(vol_now, 3), "size": round(min(1.0, 0.5 / vol_now), 3), "squeeze": squeeze},
           "profiles": {}}

    late = {}
    for key, prof in PROFILES.items():
        eq_late, _, _, _ = run_combo(**prof["kw"], start=START, cash=rf, delay=LATE_H)
        late[key] = eq_late.reindex(days).ffill()
        eq, trades, W, _ = run_combo(**prof["kw"], start=START, cash=rf)
        st = dict(C.LAST_STATE)
        w = daily_weights(W).reindex(days).ffill().fillna(0)
        eqd = eq.reindex(days).ffill()
        w_now, w_prev = float(w.iloc[-1]), float(w.iloc[-2])
        # today's action
        ov, pend = st["ov"], st["pending"]
        if pend is not None:
            action = "SELL" if pend[0] < 0 else "BUY"
            target = 0.0 if pend[0] < 0 else (out["levels"]["size"] if key == "defensive" else 1.0)
            why = "squeeze breakdown" if pend[0] < 0 else "squeeze breakout"
            if abs(target - w_now) <= 0.05:      # already there (e.g. a breakdown while in cash): nothing to trade
                action = "HOLD"
        elif abs(w_now - w_prev) > 0.05:
            action = "BUY" if w_now > w_prev else "SELL"
            target, why = w_now, ("trend turned up" if w_now > w_prev else "trend turned down")
        else:
            action = "HOLD"
            target, why = w_now, None
        active = None
        if ov is not None:
            active = {"dir": ov["dir"], "entry": round(ov["entry"], 2), "stop": round(ov["stop"], 2), "target": round(ov["target"], 2),
                      "since": int(C.hidx[ov["t"]].timestamp()), "until": int(C.hidx[ov["t"]].timestamp()) + SQ["max_days"] * 86400}
        yrs = {}
        for y in sorted(set(days.year)):
            e = eqd[days.year == y]
            prev = eqd[days < e.index[0]]
            yrs[str(y)] = round(float(e.iloc[-1] / (prev.iloc[-1] if len(prev) else e.iloc[0]) - 1), 4)
        out["profiles"][key] = {
            "name": prof["name"], "eq": [round(float(x), 5) for x in eqd.values], "w": [round(float(x), 3) for x in w.values],
            "stats": stats(eqd), "years": yrs, "record": spells(close, w),
            "trades": [{k2: t[k2] for k2 in ("in", "out", "dir", "entry", "exit", "stop", "target", "why")} for t in trades][-20:],
            "state": {"action": action, "why": why, "target": round(float(target), 3), "w_now": round(w_now, 3), "w_prev": round(w_prev, 3),
                      "active": active, "pending": bool(pend)},
        }
        s = out["profiles"][key]["stats"]
        print(f"{prof['name']:10s} $1 -> {1 + s['total']:6.2f}  Sharpe {s['sharpe']:.2f}  maxDD {s['mdd']:.0%}   today: {action} -> {target:.0%} BTC"
              f"{' (' + why + ')' if why else ''}   record in {out['profiles'][key]['record']['in']['right']}/{out['profiles'][key]['record']['in']['n']}"
              f", cash {out['profiles'][key]['record']['cash']['right']}/{out['profiles'][key]['record']['cash']['n']}")
    b = lambda a: a[-1] / a[0]
    print(f"BTC $1 -> {b(out['series']['btc']):.2f}  cash {b(out['series']['cash']):.3f}  bonds {b(out['series']['bonds']):.3f}"
          + (f"  S&P {b(out['series']['sp500']):.2f}" if "sp500" in out["series"] else "  (no S&P data)"))
    print("levels:", out["levels"])
    # live record: each night's action per strategy, appended and never rewritten
    os.makedirs(OUT, exist_ok=True)      # BitcoinLab/data/ is not in the repo until the first run creates it
    log_path = os.path.join(OUT, "actions.json")
    live = json.load(open(log_path)) if os.path.exists(log_path) else {"days": {}}
    day = str(out["last"])
    if day not in live["days"]:
        live["days"][day] = {"price": out["price"], **{k: {"action": v["state"]["action"], "target": v["state"]["target"]}
                                                      for k, v in out["profiles"].items()}}
        json.dump(live, open(log_path, "w"), separators=(",", ":"))
    out["live"] = live
    # the same strategies traded LATE_H hours late: whole backtest, and since the live record started
    i0 = int(days.get_indexer([pd.Timestamp(int(min(live["days"], key=int)), unit="s", tz="UTC")])[0])
    out["late"] = {"hours": LATE_H, "i0": i0,
                   "mult": {k: round(float(v.iloc[-1] / v.iloc[0]), 2) for k, v in late.items()},
                   "mdd": {k: round(float((v / v.cummax() - 1).min()), 4) for k, v in late.items()},
                   "live": {k: [round(float(x), 5) for x in (v.iloc[i0:] / v.iloc[i0]).values] for k, v in late.items()}}
    json.dump(out, open(os.path.join(OUT, "profiles.json"), "w"), separators=(",", ":"), allow_nan=False)


if __name__ == "__main__":
    main()
