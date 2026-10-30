"""Bitcoin Lab · nightly run: download, walk-forward backtest every model on every horizon, score them,
make today's forecast, append it to the live log, and write the JSON the pages read.

Walk-forward: models are refit at the start of every month on rows whose outcome was already known
(row t is used only if t + horizon is before the refit), then forecast every row of that month.

Run:  python3 tools/bitcoin/run.py             (download + everything)
      python3 tools/bitcoin/run.py --offline   (use the cache only)
Output: BitcoinLab/data/
"""
import argparse
import datetime as dt
import json
import math
import os
import sys
import time

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data as D          # noqa: E402
import features as F      # noqa: E402
import models as M        # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.environ.get("BTCLAB_OUT", os.path.join(ROOT, "BitcoinLab", "data"))

MODELS = ["climatology", "momentum", "price", "full", "volatility", "ensemble"]   # "rhymes" (similar charts) moved to the archive: it lost to the base rate
MODEL_INFO = {
    "climatology": ("Base rate", "How often Bitcoin rose over this horizon in all the past data, and how big the moves were."),
    "momentum": ("Momentum", "Logistic regression on one number: the return over the same length of time just before."),
    "price": ("Price model", "Ridge logistic regression on 16–17 price features: returns, volatility, volume, distance from the high and averages, halving cycle."),
    "full": ("Price + derivatives", "The price model plus funding rates, futures premium, open interest and long/short ratios (data since 2020)."),
    "volatility": ("Volatility (HAR)", "Forecasts how big the move will be, not its direction: Corsi's HAR model of realised variance."),
    "ensemble": ("Ensemble", "The average of the models above. Usually the safest forecast."),
}
PRICE_FEATS = {"hourly": F.PRICE_H, "daily": F.PRICE_D}
FULL_FEATS = {"hourly": F.DERIV_H, "daily": F.DERIV_D}
LAM_PER_STEP = 5.0           # ridge penalty grows with the horizon: overlapping outcomes carry less information
FEE = 0.001                  # 0.1% per trade in the strategy summary
EVAL_FROM = {"hourly": pd.Timestamp("2019-01-01", tz="UTC"), "daily": pd.Timestamp("2019-01-01", tz="UTC")}


def month_starts(index, start):
    ms = pd.date_range(start.normalize().replace(day=1), index[-1], freq="MS", tz="UTC")
    return [m for m in ms if m >= start]


class Track:
    def __init__(self, name, X, Y, step_rv, V, lp, unit):
        self.name, self.X, self.Y, self.step_rv, self.V, self.lp, self.unit = name, X, Y, step_rv, V, lp, unit
        self.n = len(X)
        self.min_train = 24 * 365 if name == "hourly" else 365

    def fit_predict(self, key, h, last_train, rows):
        """Fit every model on rows 0..last_train (inclusive, outcomes known) and predict `rows`."""
        X, y = self.X, self.Y[key].values
        out = {m: (np.full(len(rows), np.nan), np.full((len(rows), 5), np.nan)) for m in MODELS}
        tr = np.arange(0, last_train + 1)
        tr = tr[np.isfinite(y[tr])]
        if len(tr) < self.min_train:
            return out
        # volatility: HAR on log realised variance per step over the next h steps
        fwd = self.step_rv[::-1].rolling(h, min_periods=h).sum()[::-1].shift(-1).values / h
        V = self.V.values
        har = M.HARVol().fit(V[tr], np.log(fwd[tr] + 1e-12))
        sig_tr = np.sqrt(h) * har.sigma(V[tr])
        sig = np.sqrt(h) * har.sigma(V[rows])
        zq, zup = M.standardized_quantiles(y[tr], sig_tr)
        zc = zq - zq[2]
        out["volatility"] = (np.full(len(rows), zup), sig[:, None] * zq[None, :])
        # base rate
        out["climatology"] = (np.full(len(rows), np.mean(y[tr] > 0)), np.tile(np.quantile(y[tr], M.QS), (len(rows), 1)))
        # momentum
        mom = X[{"hourly": {1: "r1h", 4: "r4h", 24: "r24h"}, "daily": {7: "r7", 30: "r30", 90: "r90", 365: "r365"}}[self.name][h]].values
        ok = tr[np.isfinite(mom[tr])]
        sc = M.Scaler().fit(mom[ok, None])
        w = M.ridge_logit(sc(mom[ok, None]), (y[ok] > 0).astype(float), lam=1.0)
        p = M.logit_predict(w, sc(mom[rows, None]))
        out["momentum"] = (p, M.dist_from_p(p, sig, zc))
        # price-only and full feature models
        self.coefs = getattr(self, "coefs", {})
        for m, cols in [("price", PRICE_FEATS[self.name]), ("full", FULL_FEATS[self.name])]:
            A = X[cols].values
            okr = tr[np.isfinite(A[tr]).all(axis=1)]
            pred_ok = np.isfinite(A[rows]).all(axis=1)
            # at least min_train rows AND a history 4x the horizon (overlapping outcomes: few independent ones)
            if len(okr) < self.min_train or okr[-1] - okr[0] < 4 * h or not pred_ok.any():
                continue
            sc = M.Scaler().fit(A[okr])
            w = M.ridge_logit(sc(A[okr]), (y[okr] > 0).astype(float), lam=LAM_PER_STEP * h)
            p = np.full(len(rows), np.nan)
            p[pred_ok] = M.logit_predict(w, sc(A[rows][pred_ok]))
            q = np.full((len(rows), 5), np.nan)
            q[pred_ok] = M.dist_from_p(p[pred_ok], sig[pred_ok], zc)
            out[m] = (p, q)
            self.coefs[(key, m)] = (w, sc, cols)
        # ensemble
        ps = np.stack([out[m][0] for m in ["climatology", "momentum", "price", "full"]])
        qs = np.stack([out[m][1] for m in ["volatility", "momentum", "price", "full"]])
        with np.errstate(all="ignore"):
            out["ensemble"] = (np.nanmean(ps, axis=0), np.nanmean(qs, axis=0))
        return out

    def walk_forward(self, key, h):
        idx = self.X.index
        P = {m: np.full(self.n, np.nan) for m in MODELS}
        Q = {m: np.full((self.n, 5), np.nan) for m in MODELS}
        starts = month_starts(idx, EVAL_FROM[self.name])
        for i, R in enumerate(starts):
            a = idx.searchsorted(R)
            b = idx.searchsorted(starts[i + 1]) if i + 1 < len(starts) else self.n
            if a >= b:
                continue
            rows = np.arange(a, b)
            res = self.fit_predict(key, h, a - 1 - h, rows)
            for m in MODELS:
                P[m][rows], Q[m][rows] = res[m]
        return P, Q

    def today(self, key, h):
        last = self.n - 1
        res = self.fit_predict(key, h, last - h, np.array([last]))
        return {m: (float(res[m][0][0]), res[m][1][0]) for m in MODELS}


# ---------------------------------------------------------------- scoring

def nw_var(d, lag):
    d = d - d.mean()
    n = len(d)
    v = d @ d / n
    for l in range(1, min(lag, n - 1) + 1):
        v += 2 * (1 - l / (lag + 1)) * (d[l:] @ d[:-l]) / n
    return v


def score(P, Q, y, rnext, ok, h, regimes, per_year, idx_ts):
    up = (y > 0).astype(float)
    res = {}
    base_ok = ok
    for m in P:
        ok = base_ok & np.isfinite(P[m]) & np.isfinite(Q[m]).all(axis=1)
        if ok.sum() < 30:
            continue
        clim_brier = (P["climatology"][ok] - up[ok]) ** 2       # the base rate on the same rows
        p, q = P[m][ok], Q[m][ok]
        yy, uu = y[ok], up[ok]
        b = (p - uu) ** 2
        ll = -(uu * np.log(np.clip(p, 1e-6, 1)) + (1 - uu) * np.log(np.clip(1 - p, 1e-6, 1)))
        pin = np.mean([np.mean(np.maximum(t * (yy - q[:, i]), (t - 1) * (yy - q[:, i]))) for i, t in enumerate(M.QS)])
        d = b - clim_brier
        se = math.sqrt(max(nw_var(d, h - 1), 1e-18) / len(d))
        tstat = d.mean() / se
        pval = float(2 * (1 - M.norm_cdf(abs(tstat))))
        bins = []
        for lo in np.arange(0, 1, 0.1):
            s = (p >= lo) & (p < lo + 0.1 + (1e-9 if lo >= 0.9 else 0))
            if s.sum() >= 5:
                bins.append([round(float(p[s].mean()), 3), round(float(uu[s].mean()), 3), int(s.sum())])
        # strategy: hold Bitcoin for the next step when p > 0.5, cash otherwise, 0.1% per switch
        pos = (P[m] > 0.5).astype(float)
        pos[~np.isfinite(P[m])] = np.nan
        sel = ok & np.isfinite(rnext)
        ret = pos[sel] * rnext[sel] - FEE * np.abs(np.diff(np.r_[0, pos[sel]]))
        eq = np.cumsum(ret)
        res[m] = {
            "from": int(idx_ts[ok][0]), "to": int(idx_ts[ok][-1]), "neff": round(ok.sum() / h, 1),
            "n": int(ok.sum()), "hit": round(float(np.mean((p > 0.5) == (uu > 0.5))), 4),
            "brier": round(float(b.mean()), 5), "logloss": round(float(ll.mean()), 5),
            "bss": round(float(1 - b.mean() / clim_brier.mean()), 4),
            "pinball": round(float(pin), 6),
            "cov90": round(float(np.mean((yy >= q[:, 0]) & (yy <= q[:, 4]))), 4),
            "cov50": round(float(np.mean((yy >= q[:, 1]) & (yy <= q[:, 3]))), 4),
            # the Diebold-Mariano test needs many independent outcomes; below 30 it is not reported
            "dm_t": round(float(tstat), 2) if ok.sum() / h >= 30 else None,
            "dm_p": round(pval, 4) if ok.sum() / h >= 30 else None,
            "calib": bins,
            "strat": {"ret": round(float(np.expm1(eq[-1])), 4), "sharpe": round(float(ret.mean() / (ret.std() or 1) * math.sqrt(per_year)), 2),
                      "mdd": round(float(np.min(np.exp(eq - np.maximum.accumulate(np.r_[0, eq])[1:])) - 1), 4),
                      "inmkt": round(float(np.nanmean(pos[sel])), 3)},
            "regimes": {name: {"n": int((ok & mask).sum()),
                               "hit": round(float(np.mean((P[m][ok & mask] > 0.5) == (up[ok & mask] > 0.5))), 4) if (ok & mask).sum() else None,
                               "up": round(float(up[ok & mask].mean()), 4) if (ok & mask).sum() else None}
                        for name, mask in regimes.items()},
        }
    bh = rnext[base_ok & np.isfinite(rnext)]
    res["_buyhold"] = {"ret": round(float(np.expm1(bh.sum())), 4)}
    return res


def verdict(sc):
    """One plain finding per horizon: is any model better than the base rate, and does it survive fees?"""
    neff = sc["climatology"]["neff"]
    if neff < 30:
        return {"kind": "unknown", "text": f"Only about {neff:.0f} independent outcomes so far: too few to tell whether any model works."}
    real = [(m, v) for m, v in sc.items() if not m.startswith("_") and m not in ("climatology", "volatility")
            and v.get("dm_p") is not None and v["dm_p"] < 0.05 and v["bss"] > 0]
    if not real:
        return {"kind": "none", "text": "No model beats the base rate by more than chance would explain."}
    m, v = max(real, key=lambda x: x[1]["bss"])
    pays = v["strat"]["ret"] > sc["_buyhold"]["ret"]
    return {"kind": "edge" if pays else "edge-nopay", "model": m,
            "text": f"{MODEL_INFO[m][0]} gives more accurate probabilities than the base rate (skill {v['bss'] * 100:+.2f}%, p = {v['dm_p']:.3f}; "
                    f"right on direction {v['hit'] * 100:.1f}% of the time vs {sc['climatology']['hit'] * 100:.1f}%). " + ("It also beat buy-and-hold after fees." if pays else "But trading on it loses to buy-and-hold once fees are paid.")}


# ---------------------------------------------------------------- output helpers

def candles(h, rule, since=None):
    c = pd.DataFrame({"o": h["open"].resample(rule).first(), "h": h["high"].resample(rule).max(),
                      "l": h["low"].resample(rule).min(), "c": h["close"].resample(rule).last(),
                      "v": h["qvol"].resample(rule).sum()}).dropna()
    if since is not None:
        c = c[c.index >= since]
    t = (c.index.astype("int64") // 10 ** 9).tolist()
    return {"t0": t[0], "t": t, "o": [round(x, 2) for x in c["o"]], "h": [round(x, 2) for x in c["h"]],
            "l": [round(x, 2) for x in c["l"]], "c": [round(x, 2) for x in c["c"]], "v": [round(x) for x in c["v"]]}


def jdump(obj, name):
    os.makedirs(os.path.dirname(os.path.join(OUT, name)), exist_ok=True)
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, separators=(",", ":"), allow_nan=False)


def clean(x, nd=4):
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--only", help="comma-separated horizons, for quick tests")
    a = ap.parse_args()
    t0 = time.time()
    if not a.offline:
        D.download()
    h = D.hourly()
    last_hour = h.index[-1]
    print(f"hourly table: {len(h):,} rows, {h.index[0]} -> {last_hour}", flush=True)

    Xh, Yh, rh = F.hourly_features(h)
    rv_h = rh ** 2
    Vh = pd.DataFrame({"a": np.log(rv_h.rolling(24).mean()), "b": np.log(rv_h.rolling(168).mean()), "c": np.log(rv_h.rolling(720).mean())}).replace(-np.inf, np.nan)
    d = F.daily_frame(h)
    if last_hour.hour != 23:
        d = d.iloc[:-1]                      # complete UTC days only
    Xd, Yd = F.daily_features(d)
    Vd = pd.DataFrame({"a": np.log(d["rv"]), "b": np.log(d["rv"].rolling(7).mean()), "c": np.log(d["rv"].rolling(30).mean())}).replace(-np.inf, np.nan)

    tracks = {
        "hourly": Track("hourly", Xh, Yh, rv_h, Vh, np.log(h["close"].values), "h"),
        "daily": Track("daily", Xd, Yd, d["rv"], Vd, np.log(d["close"].values), "d"),
    }
    horizons = [("hourly", k, v) for k, v in F.HOURLY_H.items()] + [("daily", k, v) for k, v in F.DAILY_H.items()]
    if a.only:
        horizons = [x for x in horizons if x[1] in a.only.split(",")]

    meta = {"built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "last": int(last_hour.timestamp()) + 3600, "models": {m: {"name": n, "about": t} for m, (n, t) in MODEL_INFO.items()},
            "horizons": [], "fee": FEE}
    today = {"price": round(float(h["close"].iloc[-1]), 2), "time": int(last_hour.timestamp()) + 3600, "h": {}}

    for track_name, key, steps in horizons:
        tr = tracks[track_name]
        t1 = time.time()
        P, Q = tr.walk_forward(key, steps)
        y = tr.Y[key].values
        lc = tr.lp
        rnext = np.r_[np.diff(lc), np.nan]
        idx = tr.X.index
        models_here = list(MODELS)
        # each model is scored on every row where it has a forecast and the outcome is known,
        # always against the base rate on the same rows
        ok = np.isfinite(y) & (idx >= EVAL_FROM[track_name]) & np.isfinite(P["climatology"])
        regimes = {
            "Bull (above 200-day average)": (tr.X["ma200"].values > 0),
            "Bear (below 200-day average)": (tr.X["ma200"].values <= 0),
        }
        if track_name == "daily":
            cyc = tr.X["cycle_day"].values
            for yr in range(4):
                regimes[f"Halving cycle, year {yr + 1}"] = (cyc >= 365 * yr) & ((cyc < 365 * (yr + 1)) | (yr == 3))
        sc = score({m: P[m] for m in models_here}, {m: Q[m] for m in models_here}, y, rnext, ok, steps, regimes,
                   24 * 365 if track_name == "hourly" else 365, (idx.astype("int64") // 10 ** 9).values)
        span = [int(idx[ok][0].timestamp()), int(idx[ok][-1].timestamp())] if ok.any() else None
        meta["horizons"].append({"key": key, "track": track_name, "steps": steps, "unit": tr.unit, "models": models_here,
                                 "eval": span, "score": sc, "verdict": verdict(sc)})
        print(f"{key:4s} walk-forward {time.time() - t1:5.0f}s  n={ok.sum():,}  ensemble hit={sc['ensemble']['hit']} bss={sc['ensemble']['bss']} "
              f"clim hit={sc['climatology']['hit']}", flush=True)

        # series for the interactive backtest page (hourly: last 2 years only, to keep files small)
        keep = ok.copy()
        if track_name == "hourly":
            keep &= idx >= idx[-1] - pd.Timedelta(days=730)
        sel = np.where(keep)[0]
        series = {"t0": int(idx[sel[0]].timestamp()) if len(sel) else 0, "dt": 3600 if track_name == "hourly" else 86400,
                  "i": (sel - sel[0]).tolist() if len(sel) else [],
                  "y": [round(float(v), 4) for v in y[sel]], "r": [round(float(v), 5) for v in rnext[sel]],
                  "c": [round(float(math.exp(v)), 2) for v in lc[sel]]}
        for m in models_here:
            series["p_" + m] = [int(round(float(v) * 1000)) if np.isfinite(v) else -1 for v in P[m][sel]]   # -1 = no forecast
        ens_q = Q["ensemble"][sel]
        series["q"] = [[round(float(v), 4) for v in row] if np.isfinite(row).all() else None for row in ens_q] if track_name == "daily" else []
        jdump(series, f"bt/{key}.json")

        # today
        res = tr.today(key, steps)
        price = today["price"]
        hrow = {"steps": steps, "track": track_name, "models": {}}
        for m in models_here:
            p, q = res[m]
            hrow["models"][m] = {"p": clean(p), "q": [clean(price * math.exp(v), 2) if np.isfinite(v) else None for v in q]}
        # what pushed today's forecast: contributions of the richest available logistic model, in log-odds
        for m in ["full", "price"]:
            if (key, m) in tr.coefs and hrow["models"][m]["p"] is not None:
                w, scl, cols = tr.coefs[(key, m)]
                z = scl(tr.X[cols].values[-1:])[0]
                contrib = w[1:] * z
                hist = tr.X[cols]
                hrow["drivers"] = {"model": m, "items": sorted([
                    {"f": c, "label": F.LABELS.get(c, c), "value": clean(tr.X[c].values[-1], 5),
                     "pct": clean(float((hist[c].dropna() < tr.X[c].values[-1]).mean()), 3), "c": clean(float(contrib[i]), 4)}
                    for i, c in enumerate(cols)], key=lambda x: -abs(x["c"] or 0))}
                break
        today["h"][key] = hrow

    # live log: one entry per run day, never rewritten
    calls_path = os.path.join(OUT, "calls.json")
    calls = json.load(open(calls_path)) if os.path.exists(calls_path) else {"days": {}}
    day = str(today["time"])
    if day not in calls["days"] and not a.only:
        calls["days"][day] = {"price": today["price"], "h": {k: {"p": v["models"]["ensemble"]["p"], "q": v["models"]["ensemble"]["q"],
                                                                 "pm": {m: x["p"] for m, x in v["models"].items()}} for k, v in today["h"].items()}}
        jdump(calls, "calls.json")

    # candles for the chart (from the hourly table)
    jdump(candles(h, "1h", h.index[-1] - pd.Timedelta(days=60)), "candles/1h.json")
    jdump(candles(h, "4h", h.index[-1] - pd.Timedelta(days=365)), "candles/4h.json")
    jdump(candles(h, "1D"), "candles/1d.json")
    jdump(candles(h, "W-MON"), "candles/1w.json")
    jdump(meta, "meta.json")
    jdump(today, "today.json")
    print(f"done in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
