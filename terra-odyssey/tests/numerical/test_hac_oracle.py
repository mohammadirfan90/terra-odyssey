"""Independent pure-NumPy Newey-West HAC numerical test oracle.

Serves strictly as an independent mathematical oracle to cross-verify statsmodels
HAC output down to machine precision (relative tolerance < 1e-10) across:
- Regression coefficients (beta)
- Asymptotic covariance matrix (V_HAC)
- Parameter standard errors (SE)
- Student-t statistics and p-values
- Confidence intervals
"""

import numpy as np
import pytest
from scipy import stats
import statsmodels.api as sm


def pure_numpy_newey_west_hac(
    y: np.ndarray,
    X: np.ndarray,
    maxlags: int = 2,
    alpha: float = 0.05,
):
    """Independent pure-NumPy implementation of OLS with Newey-West (1987) HAC covariance."""
    y = np.asarray(y, dtype=np.float64)
    X = np.asarray(X, dtype=np.float64)
    n, k = X.shape

    # 1. OLS parameter estimate
    XtX_inv = np.linalg.inv(X.T @ X)
    beta = XtX_inv @ (X.T @ y)

    # 2. Residuals
    residuals = y - X @ beta

    # 3. Autocovariance matrices and Bartlett kernel weighting
    gamma_0 = sum(residuals[t] ** 2 * np.outer(X[t], X[t]) for t in range(n)) / n
    omega = gamma_0.copy()

    for l in range(1, maxlags + 1):
        weight = 1.0 - (l / (maxlags + 1.0))
        gamma_l = sum(
            residuals[t] * residuals[t - l] * np.outer(X[t], X[t - l])
            for t in range(l, n)
        ) / n
        omega += weight * (gamma_l + gamma_l.T)

    # 4. Small-sample correction factor: n / (n - k)
    correction = n / (n - k)
    v_hac = XtX_inv @ (n * omega) @ XtX_inv * correction

    # 5. Standard errors, t-statistics, and Student-t inference
    se = np.sqrt(np.diag(v_hac))
    t_stats = beta / se
    df = n - k
    p_values = 2.0 * stats.t.sf(np.abs(t_stats), df=df)

    t_crit = stats.t.ppf(1.0 - alpha / 2.0, df=df)
    ci_lower = beta - t_crit * se
    ci_upper = beta + t_crit * se

    return {
        "beta": beta,
        "cov": v_hac,
        "se": se,
        "t_stats": t_stats,
        "p_values": p_values,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "df": df,
    }


@pytest.mark.parametrize("n", [20, 25, 40])
@pytest.mark.parametrize("maxlags", [1, 2, 3, 5])
def test_oracle_matches_statsmodels_linear_gaussian(n: int, maxlags: int):
    """Verify oracle matches statsmodels on linear trend with Gaussian errors."""
    np.random.seed(100 + n + maxlags)
    x = np.arange(n) - (n - 1) / 2.0
    X = sm.add_constant(x)
    y = 1.25 * x + np.random.normal(0, 1.5, n)

    # Statsmodels
    model = sm.OLS(y, X).fit()
    robust = model.get_robustcov_results(
        cov_type="HAC",
        maxlags=maxlags,
        kernel="bartlett",
        use_correction=True,
        use_t=True,
    )

    # Pure NumPy Oracle
    oracle = pure_numpy_newey_west_hac(y, X, maxlags=maxlags, alpha=0.05)

    # Assertions
    np.testing.assert_allclose(robust.params, oracle["beta"], rtol=1e-12, atol=1e-12)
    np.testing.assert_allclose(robust.cov_params(), oracle["cov"], rtol=1e-10, atol=1e-10)
    np.testing.assert_allclose(robust.bse, oracle["se"], rtol=1e-10, atol=1e-10)
    np.testing.assert_allclose(robust.tvalues, oracle["t_stats"], rtol=1e-10, atol=1e-10)
    np.testing.assert_allclose(robust.pvalues, oracle["p_values"], rtol=1e-10, atol=1e-10)

    sm_ci = robust.conf_int(alpha=0.05)
    np.testing.assert_allclose(sm_ci[:, 0], oracle["ci_lower"], rtol=1e-10, atol=1e-10)
    np.testing.assert_allclose(sm_ci[:, 1], oracle["ci_upper"], rtol=1e-10, atol=1e-10)


def test_oracle_matches_statsmodels_ar1_autocorrelated_errors():
    """Verify oracle matches statsmodels on time series with AR(1) serial correlation."""
    np.random.seed(42)
    n = 30
    x = np.arange(n) - (n - 1) / 2.0
    X = sm.add_constant(x)

    # Generate AR(1) errors: e_t = 0.6 * e_{t-1} + eta_t
    errors = np.zeros(n)
    eta = np.random.normal(0, 1, n)
    for t in range(1, n):
        errors[t] = 0.6 * errors[t - 1] + eta[t]

    y = 0.35 * x + errors

    model = sm.OLS(y, X).fit()
    robust = model.get_robustcov_results(
        cov_type="HAC",
        maxlags=2,
        kernel="bartlett",
        use_correction=True,
        use_t=True,
    )

    oracle = pure_numpy_newey_west_hac(y, X, maxlags=2, alpha=0.05)

    np.testing.assert_allclose(robust.params, oracle["beta"], rtol=1e-12, atol=1e-12)
    np.testing.assert_allclose(robust.cov_params(), oracle["cov"], rtol=1e-10, atol=1e-10)
    np.testing.assert_allclose(robust.bse, oracle["se"], rtol=1e-10, atol=1e-10)
    np.testing.assert_allclose(robust.pvalues, oracle["p_values"], rtol=1e-10, atol=1e-10)


def test_oracle_matches_statsmodels_heteroskedastic_errors():
    """Verify oracle matches statsmodels on time series with heteroskedastic variance."""
    np.random.seed(99)
    n = 25
    x = np.arange(n) - (n - 1) / 2.0
    X = sm.add_constant(x)

    # Variance increases with time
    scale = np.linspace(0.5, 3.0, n)
    errors = np.random.normal(0, scale)
    y = -0.4 * x + errors

    model = sm.OLS(y, X).fit()
    robust = model.get_robustcov_results(
        cov_type="HAC",
        maxlags=2,
        kernel="bartlett",
        use_correction=True,
        use_t=True,
    )

    oracle = pure_numpy_newey_west_hac(y, X, maxlags=2, alpha=0.05)

    np.testing.assert_allclose(robust.params, oracle["beta"], rtol=1e-12, atol=1e-12)
    np.testing.assert_allclose(robust.cov_params(), oracle["cov"], rtol=1e-10, atol=1e-10)
    np.testing.assert_allclose(robust.bse, oracle["se"], rtol=1e-10, atol=1e-10)
    np.testing.assert_allclose(robust.pvalues, oracle["p_values"], rtol=1e-10, atol=1e-10)
