"""Bitcoin Lab · features and targets.

Every feature at time t uses only data up to the close of t. Two tracks:
  hourly track  (forecasts 1h, 4h, 24h ahead), one row per hour
  daily track   (forecasts 7, 30, 90, 365 days ahead), one row per UTC day
Derivatives features (funding, premium, open interest, long/short ratios) exist from 2020; before that they
are missing, and only the price-only models use those years.
"""
import numpy as np
import pandas as pd

HALVINGS = pd.to_datetime(["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20", "2028-04-15"], utc=True)  # last one estimated
CYCLE_DAYS = 1460

HOURLY_H = {"1h": 1, "4h": 4, "1d": 24}              # in hours
DAILY_H = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}  # in days

PRICE_H = ["r1h", "r4h", "r24h", "r7d", "r30d", "vol24", "vol168", "volratio", "hour_s", "hour_c", "dow_s", "dow_c",
           "taker4", "taker24", "volz24", "dd_ath", "ma200"]
DERIV_H = PRICE_H + ["funding", "prem4", "prem24", "oi4", "oi24", "ls", "top_ls", "taker_ls"]
PRICE_D = ["r1", "r7", "r30", "r90", "r180", "r365", "lrv1", "lrv7", "lrv30", "dd_ath", "ma50", "ma200",
           "cyc_s", "cyc_c", "volz30", "taker7"]
DERIV_D = PRICE_D + ["funding7", "funding30", "prem7", "oi7", "oi30", "ls7", "top_ls7", "taker_ls7"]

LABELS = {
    "r1h": "Last hour's return", "r4h": "Last 4 hours' return", "r24h": "Last 24 hours' return", "r7d": "Last 7 days' return",
    "r30d": "Last 30 days' return", "vol24": "Volatility, last 24h", "vol168": "Volatility, last 7 days", "volratio": "Volatility, 24h vs 7d",
    "hour_s": "Hour of day", "hour_c": "Hour of day", "dow_s": "Day of week", "dow_c": "Day of week",
    "taker4": "Buyer aggression, 4h", "taker24": "Buyer aggression, 24h", "volz24": "Volume vs normal, 24h",
    "dd_ath": "Distance from all-time high", "ma200": "Distance from 200-day average",
    "funding": "Funding rate", "prem4": "Futures premium, 4h", "prem24": "Futures premium, 24h", "oi4": "Open interest change, 4h",
    "oi24": "Open interest change, 24h", "ls": "Accounts long vs short", "top_ls": "Top traders long vs short", "taker_ls": "Taker buy vs sell",
    "r1": "Yesterday's return", "r7": "Last 7 days' return", "r30": "Last 30 days' return", "r90": "Last 90 days' return",
    "r180": "Last 180 days' return", "r365": "Last year's return", "lrv1": "Volatility, yesterday", "lrv7": "Volatility, last week",
    "lrv30": "Volatility, last month", "ma50": "Distance from 50-day average", "cyc_s": "Halving cycle position", "cyc_c": "Halving cycle position",
    "volz30": "Volume vs normal, 30 days", "taker7": "Buyer aggression, 7 days", "funding7": "Funding rate, 7 days",
    "funding30": "Funding rate, 30 days", "prem7": "Futures premium, 7 days", "oi7": "Open interest change, 7 days",
    "oi30": "Open interest change, 30 days", "ls7": "Accounts long vs short, 7 days", "top_ls7": "Top traders long vs short, 7 days",
    "taker_ls7": "Taker buy vs sell, 7 days",
}


def estimate_funding(h):
    """Funding files come monthly; for the current month, estimate it from the premium index the way Binance
    computes it: average premium over 8h + clamp(0.01% - premium, ±0.05%)."""
    prem8 = h["premium"].rolling(8, min_periods=4).mean()
    est = prem8 + (0.0001 - prem8).clip(-0.0005, 0.0005)
    last_real = h["funding"].last_valid_index()
    f = h["funding"].copy()
    if last_real is not None:
        f[f.index > last_real] = est[f.index > last_real]
    return f


def hourly_features(h):
    f = pd.DataFrame(index=h.index)
    lc = np.log(h["close"])
    r = lc.diff()
    f["r1h"], f["r4h"], f["r24h"], f["r7d"], f["r30d"] = r, lc.diff(4), lc.diff(24), lc.diff(168), lc.diff(720)
    f["vol24"] = np.log(r.rolling(24).std() * np.sqrt(24 * 365) + 1e-6)
    f["vol168"] = np.log(r.rolling(168).std() * np.sqrt(24 * 365) + 1e-6)
    f["volratio"] = f["vol24"] - f["vol168"]
    hr, dw = h.index.hour, h.index.dayofweek
    f["hour_s"], f["hour_c"] = np.sin(2 * np.pi * hr / 24), np.cos(2 * np.pi * hr / 24)
    f["dow_s"], f["dow_c"] = np.sin(2 * np.pi * dw / 7), np.cos(2 * np.pi * dw / 7)
    q = h["qvol"].replace(0, np.nan)
    f["taker4"] = h["taker_qvol"].rolling(4).sum() / q.rolling(4).sum() - 0.5
    f["taker24"] = h["taker_qvol"].rolling(24).sum() / q.rolling(24).sum() - 0.5
    lv = np.log(q.rolling(24).sum())
    f["volz24"] = (lv - lv.rolling(720).mean()) / lv.rolling(720).std()
    f["dd_ath"] = lc - lc.cummax()
    f["ma200"] = lc - np.log(h["close"].rolling(24 * 200).mean())
    fund = estimate_funding(h)
    f["funding"] = fund * 1000
    f["prem4"] = h["premium"].rolling(4).mean() * 1000
    f["prem24"] = h["premium"].rolling(24).mean() * 1000
    loi = np.log(h["oi_usd"])
    f["oi4"], f["oi24"] = loi.diff(4), loi.diff(24)
    f["ls"] = np.log(h["ls_count"])
    f["top_ls"] = np.log(h["top_ls_pos"])
    f["taker_ls"] = np.log(h["taker_ls"]).rolling(4).mean()
    y = pd.DataFrame({k: lc.shift(-v) - lc for k, v in HOURLY_H.items()}, index=h.index)
    return f.replace([np.inf, -np.inf], np.nan), y, r


def daily_frame(h):
    """UTC-day bars from the hourly table (the day's close = the 23:00 bar's close)."""
    d = pd.DataFrame({
        "open": h["open"].resample("1D").first(), "high": h["high"].resample("1D").max(),
        "low": h["low"].resample("1D").min(), "close": h["close"].resample("1D").last(),
        "qvol": h["qvol"].resample("1D").sum(), "taker_qvol": h["taker_qvol"].resample("1D").sum(),
    })
    r = np.log(h["close"]).diff()
    d["rv"] = (r ** 2).resample("1D").sum()
    d["funding"] = (estimate_funding(h) * (h.index.hour % 8 == 0)).resample("1D").sum(min_count=1)
    d["premium"] = h["premium"].resample("1D").mean()
    d["oi_usd"] = h["oi_usd"].resample("1D").last()
    for c in ["ls_count", "top_ls_pos", "taker_ls"]:
        d[c] = h[c].resample("1D").mean()
    return d


def daily_features(d):
    f = pd.DataFrame(index=d.index)
    lc = np.log(d["close"])
    for k in [1, 7, 30, 90, 180, 365]:
        f[f"r{k}"] = lc.diff(k)
    rv = d["rv"].replace(0, np.nan)
    f["lrv1"], f["lrv7"], f["lrv30"] = np.log(rv), np.log(rv.rolling(7).mean()), np.log(rv.rolling(30).mean())
    f["dd_ath"] = lc - lc.cummax()
    f["ma50"] = lc - np.log(d["close"].rolling(50).mean())
    f["ma200"] = lc - np.log(d["close"].rolling(200).mean())
    last_halving = pd.Series(HALVINGS, index=HALVINGS)
    since = np.array([(t - HALVINGS[HALVINGS <= t].max()).days for t in d.index], dtype=float)
    f["cyc_s"], f["cyc_c"] = np.sin(2 * np.pi * since / CYCLE_DAYS), np.cos(2 * np.pi * since / CYCLE_DAYS)
    f["cycle_day"] = since
    lv = np.log(d["qvol"].replace(0, np.nan))
    f["volz30"] = (lv.rolling(30).mean() - lv.rolling(180).mean()) / lv.rolling(180).std()
    f["taker7"] = d["taker_qvol"].rolling(7).sum() / d["qvol"].rolling(7).sum() - 0.5
    f["funding7"] = d["funding"].rolling(7).mean() * 1000
    f["funding30"] = d["funding"].rolling(30).mean() * 1000
    f["prem7"] = d["premium"].rolling(7).mean() * 1000
    loi = np.log(d["oi_usd"])
    f["oi7"], f["oi30"] = loi.diff(7), loi.diff(30)
    f["ls7"] = np.log(d["ls_count"]).rolling(7).mean()
    f["top_ls7"] = np.log(d["top_ls_pos"]).rolling(7).mean()
    f["taker_ls7"] = np.log(d["taker_ls"]).rolling(7).mean()
    y = pd.DataFrame({k: lc.shift(-v) - lc for k, v in DAILY_H.items()}, index=d.index)
    return f.replace([np.inf, -np.inf], np.nan), y
