"""Bitcoin Lab · forecasting models (NumPy only, so every step can be read and explained).

Each model, given training rows (features X, realised log return y), returns for new rows:
  p   probability the price is higher after the horizon
  q   5 quantiles (5%, 25%, 50%, 75%, 95%) of the log return

  climatology   base rate: share of past periods that rose; past returns' quantiles
  momentum      logistic regression on the trailing return over the same horizon
  rhymes        nearest past price shapes (daily track only), the Market Rhymes idea
  price         ridge logistic regression on price-only features
  full          the same with derivatives features (funding, premium, open interest, long/short)
  volatility    HAR model of realised variance -> width of the forecast distribution
  ensemble      average of the others' probabilities and quantiles
"""
import math

import numpy as np

QS = np.array([0.05, 0.25, 0.5, 0.75, 0.95])


def norm_ppf(p):
    """Inverse standard normal CDF (Acklam's approximation, |error| < 1.2e-9)."""
    p = np.clip(np.asarray(p, dtype=float), 1e-9, 1 - 1e-9)
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
    out = np.empty_like(p)
    lo, hi = p < 0.02425, p > 1 - 0.02425
    mid = ~(lo | hi)
    q = np.sqrt(-2 * np.log(p[lo]))
    out[lo] = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    q = np.sqrt(-2 * np.log(1 - p[hi]))
    out[hi] = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    q = p[mid] - 0.5
    r = q * q
    out[mid] = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    return out


def norm_cdf(x):
    return 0.5 * (1 + np.vectorize(math.erf)(np.asarray(x) / math.sqrt(2)))


class Scaler:
    def fit(self, X):
        self.m = np.nanmean(X, axis=0)
        self.s = np.nanstd(X, axis=0)
        self.s[~np.isfinite(self.s) | (self.s == 0)] = 1
        self.m[~np.isfinite(self.m)] = 0
        return self

    def __call__(self, X):
        Z = (X - self.m) / self.s
        return np.clip(np.nan_to_num(Z), -5, 5)


def ridge_logit(Z, up, lam, iters=25):
    """L2-penalised logistic regression by Newton's method. Returns (intercept, weights)."""
    n, k = Z.shape
    A = np.hstack([np.ones((n, 1)), Z])
    w = np.zeros(k + 1)
    P = np.eye(k + 1) * lam
    P[0, 0] = 0
    for _ in range(iters):
        p = 1 / (1 + np.exp(-np.clip(A @ w, -30, 30)))
        g = A.T @ (p - up) + P @ w
        H = (A * (p * (1 - p))[:, None]).T @ A + P
        step = np.linalg.solve(H, g)
        w -= step
        if np.abs(step).max() < 1e-7:
            break
    return w


def logit_predict(w, Z):
    return 1 / (1 + np.exp(-np.clip(w[0] + Z @ w[1:], -30, 30)))


class HARVol:
    """log(realised variance over the horizon) ~ log RV over short, medium and long past windows (Corsi's HAR)."""
    def fit(self, V, target_lrv):
        ok = np.isfinite(V).all(axis=1) & np.isfinite(target_lrv)
        A = np.hstack([np.ones((ok.sum(), 1)), V[ok]])
        self.b, *_ = np.linalg.lstsq(A, target_lrv[ok], rcond=None)
        res = target_lrv[ok] - A @ self.b
        self.s2 = res.var()
        return self

    def sigma(self, V):
        V = np.where(np.isfinite(V), V, np.nanmean(V, axis=0))
        lrv = self.b[0] + V @ self.b[1:]
        return np.sqrt(np.exp(lrv + 0.5 * self.s2))


def standardized_quantiles(y, sig):
    """Quantiles of y / sigma in the training data (fat tails and drift included)."""
    z = y / sig
    z = z[np.isfinite(z)]
    return np.quantile(z, QS), np.mean(z > 0)


def dist_from_p(p, sig, zq_center):
    """Quantiles of a distribution with scale sig whose P(>0) is p: shift the training shape so its 'zero' sits at p."""
    shift = norm_ppf(p)                      # in standard-deviation units
    return sig[:, None] * (zq_center[None, :] + shift[:, None])


def rhymes(lp, ends_train, y_train, ends_pred, window, k=40):
    """Nearest past shapes: z-scored log-price windows, Pearson similarity, k best non-overlapping matches."""
    def zwin(e):
        w = lp[e - window + 1:e + 1]
        w = w - w.mean()
        return w / (w.std() or 1)
    if len(ends_train) < k * 3:
        return np.full(len(ends_pred), np.nan), np.full((len(ends_pred), len(QS)), np.nan)
    Zt = np.stack([zwin(e) for e in ends_train])
    Zp = np.stack([zwin(e) for e in ends_pred])
    S = Zp @ Zt.T / window
    ps, qs = [], []
    for i in range(len(ends_pred)):
        order = np.argsort(-S[i])
        picked = []
        for j in order:
            if all(abs(ends_train[j] - ends_train[m]) >= window // 3 for m in picked):
                picked.append(j)
                if len(picked) == k:
                    break
        outs = y_train[picked]
        ps.append((np.sum(outs > 0) + 1) / (len(outs) + 2))
        qs.append(np.quantile(outs, QS))
    return np.array(ps), np.array(qs)
