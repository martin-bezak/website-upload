"""Bitcoin Lab · data: download and cache Binance Vision files, build one hourly table.

Datasets (all CC BY-NC-SA 4.0, data.binance.vision):
  spot klines 1h        BTCUSDT   2017-08 ->   price, volume, taker buy volume, trade count
  futures fundingRate   BTCUSDT   2020-01 ->   funding paid every 8h
  futures premiumIndex  BTCUSDT   2020-01 ->   perpetual premium over spot index (1h)
  futures metrics       BTCUSDT   2020-09 ->   open interest, long/short ratios, taker ratio (5-min)

Monthly files for complete months, daily files for the current (and, if not yet published, last) month.
Zips are kept in CACHE, so later runs only fetch what is new.
"""
import concurrent.futures as cf
import csv
import datetime as dt
import http.client
import io
import os
import re
import threading
import time
import urllib.request
import zipfile

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("BTCLAB_CACHE", os.path.join(HERE, "cache.nosync"))
S3 = "https://s3-ap-northeast-1.amazonaws.com/data.binance.vision"
UA = {"User-Agent": "martinbezak.com Bitcoin Lab (non-commercial, educational)"}
THREADS = int(os.environ.get("BTCLAB_THREADS", 24))

DATASETS = {
    # name: (monthly prefix, daily prefix, file stem)
    "spot": ("data/spot/monthly/klines/BTCUSDT/1h/", "data/spot/daily/klines/BTCUSDT/1h/", "BTCUSDT-1h-"),
    "premium": ("data/futures/um/monthly/premiumIndexKlines/BTCUSDT/1h/", "data/futures/um/daily/premiumIndexKlines/BTCUSDT/1h/", "BTCUSDT-1h-"),
    "funding": ("data/futures/um/monthly/fundingRate/BTCUSDT/", None, "BTCUSDT-fundingRate-"),
    "metrics": (None, "data/futures/um/daily/metrics/BTCUSDT/", "BTCUSDT-metrics-"),
}

_local = threading.local()


def _get_url(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read()
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError("failed: " + url)


def s3_keys(prefix):
    out, marker = [], ""
    while True:
        x = _get_url(f"{S3}?prefix={prefix}" + (f"&marker={marker}" if marker else "")).decode()
        out += re.findall(r"<Key>([^<]+\.zip)</Key>", x)
        if "<IsTruncated>true</IsTruncated>" not in x:
            return out
        marker = re.findall(r"<Key>([^<]+)</Key>", x)[-1]


def fetch(path):
    """GET one file over a kept-alive connection (one per thread). None if 404."""
    for i in range(4):
        try:
            conn = getattr(_local, "conn", None)
            if conn is None:
                conn = _local.conn = http.client.HTTPSConnection("data.binance.vision", timeout=40)
            conn.request("GET", "/" + path, headers=UA)
            r = conn.getresponse()
            body = r.read()
            if r.status == 404:
                return None
            if r.status == 200:
                return body
        except Exception:
            pass
        _local.conn = None
        time.sleep(2 ** i)
    raise RuntimeError("failed: " + path)


def download():
    """Fetch every file we don't have yet. Monthly where it exists, daily for the rest."""
    jobs = []
    for name, (mp, dp, stem) in DATASETS.items():
        folder = os.path.join(CACHE, name)
        os.makedirs(folder, exist_ok=True)
        have = set(os.listdir(folder))
        monthly = s3_keys(mp) if mp else []
        months = {k.split(stem)[1][:7] for k in monthly}
        for k in monthly:
            if os.path.basename(k) not in have:
                jobs.append((folder, k))
        if dp:
            for k in s3_keys(dp):
                day = k.split(stem)[1][:10]
                # daily files are only needed for months without a monthly file
                if (not mp or day[:7] not in months) and os.path.basename(k) not in have:
                    jobs.append((folder, k))
    print(f"bitcoin lab: {len(jobs)} new files", flush=True)

    def one(job):
        folder, key = job
        blob = fetch(key)
        if blob:
            tmp = os.path.join(folder, os.path.basename(key) + ".part")
            open(tmp, "wb").write(blob)
            os.replace(tmp, os.path.join(folder, os.path.basename(key)))
    with cf.ThreadPoolExecutor(THREADS) as ex:
        list(ex.map(one, jobs))
    # a daily file is redundant once its month's monthly file exists
    for name, (mp, dp, stem) in DATASETS.items():
        if not (mp and dp):
            continue
        folder = os.path.join(CACHE, name)
        months = {f.split(stem)[1][:7] for f in os.listdir(folder) if len(f.split(stem)[1]) == len("2024-01.zip")}
        for f in os.listdir(folder):
            rest = f.split(stem)[1]
            if len(rest) == len("2024-01-01.zip") and rest[:7] in months:
                os.remove(os.path.join(folder, f))


def _rows(folder):
    for f in sorted(os.listdir(folder)):
        if not f.endswith(".zip"):
            continue
        with zipfile.ZipFile(os.path.join(folder, f)) as z:
            for n in z.namelist():
                for r in csv.reader(io.TextIOWrapper(z.open(n))):
                    if r and r[0][:1].isdigit():
                        yield r


def _ts(x):
    t = int(x)
    return t // 1000 if t < 1e14 else t // 1_000_000   # milliseconds, or microseconds since 2025


def hourly():
    """One row per hour (UTC), indexed by the hour's open time."""
    spot = {}
    for r in _rows(os.path.join(CACHE, "spot")):
        t = _ts(r[0])
        spot[t] = (float(r[1]), float(r[2]), float(r[3]), float(r[4]), float(r[7]), float(r[10]), float(r[8]))
    df = pd.DataFrame.from_dict(spot, orient="index", columns=["open", "high", "low", "close", "qvol", "taker_qvol", "trades"])
    df.index = pd.to_datetime(df.index, unit="s", utc=True)
    df = df.sort_index()
    df = df[~df.index.duplicated()].asfreq("1h")
    df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].ffill()
    df[["qvol", "taker_qvol", "trades"]] = df[["qvol", "taker_qvol", "trades"]].fillna(0)

    prem = {_ts(r[0]): float(r[4]) for r in _rows(os.path.join(CACHE, "premium"))}
    p = pd.Series(prem, dtype=float); p.index = pd.to_datetime(p.index, unit="s", utc=True)
    df["premium"] = p.sort_index().reindex(df.index)

    fund = {}
    for r in _rows(os.path.join(CACHE, "funding")):
        fund[_ts(r[0])] = float(r[2])
    f = pd.Series(fund, dtype=float); f.index = pd.to_datetime(f.index, unit="s", utc=True)
    f = f.sort_index()
    f.index = f.index.floor("1h")
    df["funding"] = f[~f.index.duplicated()].reindex(df.index).ffill(limit=8)   # last known funding rate

    met = {}
    for r in _rows(os.path.join(CACHE, "metrics")):
        try:
            t = pd.Timestamp(r[0], tz="UTC").floor("1h")
            met[t] = (float(r[3] or "nan"), float(r[4] or "nan"), float(r[5] or "nan"), float(r[6] or "nan"), float(r[7] or "nan"))
        except ValueError:
            continue
    m = pd.DataFrame.from_dict(met, orient="index", columns=["oi_usd", "top_ls_count", "top_ls_pos", "ls_count", "taker_ls"])
    m = m.sort_index()
    df = df.join(m.reindex(df.index))
    return df


if __name__ == "__main__":
    download()          # the nightly job runs this first, then profiles.py
