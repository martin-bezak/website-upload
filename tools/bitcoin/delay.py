"""Bitcoin Lab · does it matter that followers can't trade at the close?

The published backtest trades at the daily close (00:00 UTC). The website updates after the nightly job
(03:30 UTC, when Binance Vision has published the day's files), so a follower trades hours later.
This reruns the three profiles with every trade moved `delay` hours after the close (stops and targets
are orders placed with the trade, so they are not delayed). Same fees, same interest on cash, same start.

Run:  python3 tools/bitcoin/delay.py      writes BitcoinLab/data/strategies/delay.json
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo import run_combo, stats                     # noqa: E402
from improve import tbill                              # noqa: E402
from profiles import PROFILES, START                   # noqa: E402
from strategies import OUT                             # noqa: E402

DELAYS = [0, 1, 2, 4, 6, 8, 12]     # hours after 00:00 UTC; 4 = about when the website has updated


def main():
    rf = tbill()
    out = {"delays": DELAYS, "profiles": {}}
    for key, prof in PROFILES.items():
        rows = []
        for h in DELAYS:
            eq, trades, _, _ = run_combo(**prof["kw"], start=START, cash=rf, delay=h)
            s = stats(eq)
            rows.append({"delay": h, "mult": round(1 + s["total"], 2), "cagr": s["cagr"], "sharpe": s["sharpe"],
                         "mdd": s["mdd"], "squeeze_trades": len(trades)})
            print(f"{prof['name']:<10} delay {h:>2}h  $1 -> {1 + s['total']:6.2f}  CAGR {s['cagr']:6.1%}  "
                  f"Sharpe {s['sharpe']:.2f}  maxDD {s['mdd']:6.1%}  squeeze trades {len(trades)}")
        base = rows[0]
        for r in rows:
            r["mult_vs_0"] = round(r["mult"] / base["mult"] - 1, 4)
        out["profiles"][key] = {"name": prof["name"], "rows": rows}
        print()
    os.makedirs(os.path.join(OUT, "strategies"), exist_ok=True)
    json.dump(out, open(os.path.join(OUT, "strategies", "delay.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
