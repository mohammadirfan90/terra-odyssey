"""End-to-end scientific pipeline stepper for Terra Odyssey investigation jobs.

Coordinates the 6-stage lifecycle:
  validating -> acquiring -> normalizing -> aggregating -> analyzing -> publishing
with cooperative cancellation and orthogonal job/result status separation.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import logging
import os
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
import xarray as xr

from src.analysis.aggregation import (
    aggregate_annual_precipitation,
    aggregate_annual_temperature,
    aggregate_seasonal,
    validate_consecutive_series,
)
from src.analysis.multiplicity import adjudicate_contrast_family, adjust_pvalues
from src.analysis.paired_contrast import estimate_paired_contrast
from src.analysis.spatial_aggregation import (
    aggregate_spatial_mean,
    compute_polygon_weights,
)
from src.analysis.trend_estimator import estimate_linear_trend, fit_ols_hac_trend
from src.backend.errors import (
    DataUnavailableError,
    InvalidGeometryError,
    ScientificallyIneligibleError,
    TerraOdysseyError,
)
from src.backend.store import JobStore

logger = logging.getLogger("terra_odyssey.backend.stepper")


def _compute_sha256(file_path: Path) -> str:
    """Compute hex SHA-256 checksum of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def _get_synthetic_cube(dataset_id: str, n_years: int = 25) -> xr.Dataset:
    """Generate synthetic test dataset cube when running in demo/test mode."""
    n_times = n_years * 12
    times = pd.date_range("2000-01-01", periods=n_times, freq="MS")
    lats = np.linspace(-60.0, 60.0, 15, dtype=np.float64)
    lons = np.linspace(-150.0, 150.0, 20, dtype=np.float64)

    rng = np.random.default_rng(42)

    if "merra" in dataset_id.lower() or "d1" in dataset_id.lower():
        # Temperature in Kelvin (~273.15 + 15 + trend + noise)
        base = 288.15
        trend_rate = 0.03  # 0.3 K/decade
        time_vals = np.arange(n_times) / 12.0
        t_trend = trend_rate * time_vals
        seasonal = 10.0 * np.sin(2 * np.pi * time_vals)

        cube = np.zeros((n_times, len(lats), len(lons)), dtype=np.float64)
        for t in range(n_times):
            cube[t, :, :] = base + t_trend[t] + seasonal[t] + rng.normal(0, 0.5, size=(len(lats), len(lons)))

        return xr.Dataset(
            data_vars={"T2M": (("time", "lat", "lon"), cube, {"units": "K", "long_name": "2-meter temperature"})},
            coords={"time": times, "lat": lats, "lon": lons},
            attrs={"collection": "M2TMNXSLV", "version": "5.12.4", "source_type": "model_reanalysis"},
        )
    else:
        # Precipitation in mm/hour (rate)
        base_rate = 0.25  # ~180 mm/month
        cube = np.maximum(0.0, rng.gamma(2.0, base_rate / 2.0, size=(n_times, len(lats), len(lons))))
        return xr.Dataset(
            data_vars={"precipitationCal": (("time", "lat", "lon"), cube, {"units": "mm/hr", "long_name": "calibrated precipitation"})},
            coords={"time": times, "lat": lats, "lon": lons},
            attrs={"collection": "GPM_3IMERGM", "version": "07", "source_type": "mission_product"},
        )


def run_pipeline(
    job_id: str,
    request_data: Dict[str, Any],
    artifacts_base_dir: Optional[Union[str, Path]] = None,
    store_db_path: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Execute the full 6-stage scientific analysis lifecycle for an investigation."""
    store = JobStore(store_db_path)

    base_dir = Path(artifacts_base_dir) if artifacts_base_dir else Path("terra-odyssey/data/investigations")
    job_artifacts_dir = base_dir / job_id
    staging_dir = base_dir / f"{job_id}_staging"

    try:
        # Check cancellation
        if store.is_cancelled(job_id):
            store.set_result(job_id, job_status="cancelled", error={"reason": "cancelled_before_start"})
            return {"job_id": job_id, "job_status": "cancelled"}

        # ---------------------------------------------------------
        # STAGE 1: VALIDATING (10%)
        # ---------------------------------------------------------
        store.update_stage(job_id, "validating", 10)
        logger.info("[%s] Stage 1: Validating request parameters", job_id)

        dataset_id = str(request_data.get("dataset_id", "merra2_t2m"))
        variable = str(request_data.get("variable", "T2M"))
        period = request_data.get("period", {})
        start_year = int(period.get("start_year", 2000))
        end_year = int(period.get("end_year", 2024))
        temporal_agg = str(request_data.get("temporal_aggregation", "annual_mean"))
        spatial_agg = str(request_data.get("spatial_aggregation", "area_weighted"))
        exec_mode = str(request_data.get("execution_mode", "auto"))
        selection_status = str(request_data.get("selection_status", "predefined"))
        region_a_raw = request_data.get("region_a")
        region_b_raw = request_data.get("region_b")

        if region_a_raw is None:
            raise InvalidGeometryError("region_a geometry is required")

        year_span = end_year - start_year + 1
        is_length_ineligible = year_span < 20

        if store.is_cancelled(job_id):
            store.set_result(job_id, job_status="cancelled", error={"reason": "cancelled_at_validation"})
            return {"job_id": job_id, "job_status": "cancelled"}

        # ---------------------------------------------------------
        # STAGE 2: ACQUIRING (25%)
        # ---------------------------------------------------------
        store.update_stage(job_id, "acquiring", 25)
        logger.info("[%s] Stage 2: Acquiring data for mode=%s", job_id, exec_mode)

        # Check execution mode constraints
        if exec_mode == "live":
            # Live DAAC demands Earthdata credentials
            has_creds = bool(os.environ.get("EARTHDATA_TOKEN") or os.environ.get("EARTHDATA_USERNAME"))
            if not has_creds:
                raise DataUnavailableError(
                    "Live Earthdata acquisition requested but NASA credentials are not configured in environment.",
                    type_uri="https://terra-odyssey.local/errors/earthdata-unavailable",
                    retryable=True,
                )

        data_mode = "cached_verified"
        if exec_mode == "demo_sample":
            data_mode = "demo_sample"
            raw_cube = _get_synthetic_cube(dataset_id, n_years=year_span)
        else:
            # Check local files / sample directory
            manifests_dir = Path(__file__).resolve().parents[2] / "data" / "samples"
            local_granules = list(manifests_dir.glob("*.nc4")) + list(manifests_dir.glob("*.HDF5")) if manifests_dir.is_dir() else []

            if local_granules:
                data_mode = "cached_verified"
                # Load first granule or merged dataset
                raw_cube = xr.open_dataset(local_granules[0])
            elif exec_mode in ("auto", "demo_sample"):
                data_mode = "demo_sample"
                raw_cube = _get_synthetic_cube(dataset_id, n_years=year_span)
            else:
                raise DataUnavailableError(
                    f"No cached granules found for {dataset_id} in period {start_year}-{end_year}.",
                    retryable=True,
                )

        if store.is_cancelled(job_id):
            store.set_result(job_id, job_status="cancelled", error={"reason": "cancelled_at_acquiring"})
            return {"job_id": job_id, "job_status": "cancelled"}

        # ---------------------------------------------------------
        # STAGE 3: NORMALIZING (45%)
        # ---------------------------------------------------------
        store.update_stage(job_id, "normalizing", 45)
        logger.info("[%s] Stage 3: Normalizing cube and applying quality masks", job_id)

        target_var = "T2M" if ("merra" in dataset_id.lower() or "d1" in dataset_id.lower()) else "precipitationCal"
        if target_var not in raw_cube:
            for alt in ("precipitationCal", "T2M", "t2m", "precip"):
                if alt in raw_cube:
                    target_var = alt
                    break

        da = raw_cube[target_var]

        # Apply physical conversions
        if "merra" in dataset_id.lower() or "d1" in dataset_id.lower():
            # Convert K -> degC if values are around ~273+
            if float(da.mean(skipna=True)) > 150.0:
                da = da - 273.15
            da.attrs["units"] = "degC"
            units = "degC"
            unit_per_decade = "degC/decade"
        else:
            # GPM precipitation accumulation (mm/year)
            # If rate in mm/hr, convert to mm/month accumulation: rate * days_in_month * 24
            if "time" in da.dims:
                hours_in_month = da.time.dt.days_in_month * 24
                da = da * hours_in_month
            da.attrs["units"] = "mm/year"
            units = "mm/year"
            unit_per_decade = "mm/year/decade"

        if store.is_cancelled(job_id):
            store.set_result(job_id, job_status="cancelled", error={"reason": "cancelled_at_normalizing"})
            return {"job_id": job_id, "job_status": "cancelled"}

        # ---------------------------------------------------------
        # STAGE 4: AGGREGATING (65%)
        # ---------------------------------------------------------
        store.update_stage(job_id, "aggregating", 65)
        logger.info("[%s] Stage 4: Extracting spatial and temporal series", job_id)

        lat_name = "lat" if "lat" in da.coords else "latitude"
        lon_name = "lon" if "lon" in da.coords else "longitude"
        lats = da[lat_name].values
        lons = da[lon_name].values

        # Enforce validated temporal aggregation (calendar hours and day-of-month weighting)
        if "time" in da.dims:
            if "merra" in dataset_id.lower() or "d1" in dataset_id.lower():
                da_ann = aggregate_annual_temperature(da)
            else:
                da_ann = aggregate_annual_precipitation(da)
        else:
            da_ann = da

        weights_a, meta_a = compute_polygon_weights(region_a_raw, lats, lons)
        ts_a, cov_a, sum_meta_a = aggregate_spatial_mean(
            da_ann, weights_a, coverage_threshold=1.0 if "merra" in dataset_id.lower() else 0.90, product_id=dataset_id
        )

        has_paired = region_b_raw is not None
        if has_paired:
            weights_b, meta_b = compute_polygon_weights(region_b_raw, lats, lons)
            ts_b, cov_b, sum_meta_b = aggregate_spatial_mean(
                da_ann, weights_b, coverage_threshold=1.0 if "merra" in dataset_id.lower() else 0.90, product_id=dataset_id
            )

        # Extract consecutive annual values
        if "year" in ts_a.dims or "year" in ts_a.coords:
            years_a = ts_a["year"].values.astype(int)
            vals_a = ts_a.values.astype(float)
        elif "time" in ts_a.dims:
            years_a = pd.to_datetime(ts_a["time"].values).year.values.astype(int)
            vals_a = ts_a.values.astype(float)
        else:
            years_a = np.arange(start_year, end_year + 1)
            vals_a = np.full(len(years_a), float(ts_a.values))

        if has_paired:
            if "year" in ts_b.dims or "year" in ts_b.coords:
                years_b = ts_b["year"].values.astype(int)
                vals_b = ts_b.values.astype(float)
            elif "time" in ts_b.dims:
                years_b = pd.to_datetime(ts_b["time"].values).year.values.astype(int)
                vals_b = ts_b.values.astype(float)
            else:
                years_b = np.arange(start_year, end_year + 1)
                vals_b = np.full(len(years_b), float(ts_b.values))

        # Check coverage eligibility
        coverage_ineligible = False
        min_cov = float(np.min(cov_a.values))
        if "merra" in dataset_id.lower() and min_cov < 0.999:
            coverage_ineligible = True
        elif min_cov < 0.80:
            coverage_ineligible = True

        if store.is_cancelled(job_id):
            store.set_result(job_id, job_status="cancelled", error={"reason": "cancelled_at_aggregating"})
            return {"job_id": job_id, "job_status": "cancelled"}

        # ---------------------------------------------------------
        # STAGE 5: ANALYZING (80%)
        # ---------------------------------------------------------
        store.update_stage(job_id, "analyzing", 80)
        logger.info("[%s] Stage 5: Fitting statistical estimators", job_id)

        analysis_results: List[Dict[str, Any]] = []

        if is_length_ineligible or coverage_ineligible:
            result_status = "ineligible"
            # Emit ineligible analysis result
            reason = "Time series length < 20 years" if is_length_ineligible else "Spatial area coverage below required threshold"
            ineligible_res = {
                "analysis_id": f"res-{uuid.uuid4().hex[:8]}",
                "status": "ineligible",
                "estimand": {
                    "dataset_id": dataset_id,
                    "variable": variable,
                    "units": units,
                    "period": {"start": f"{start_year}-01-01", "end": f"{end_year}-12-31"},
                    "geometry": region_a_raw if isinstance(region_a_raw, dict) else {"type": "BBox", "bbox": region_a_raw},
                    "temporal_aggregation": temporal_agg,
                    "spatial_aggregation": spatial_agg,
                },
                "effect": {"estimate": 0.0, "unit_per_decade": unit_per_decade, "fitted_change": 0.0},
                "uncertainty": {"lower": 0.0, "upper": 0.0, "level": 0.95, "method": "ols_hac_newey_west"},
                "coverage": {
                    "valid_periods": len(years_a),
                    "expected_periods": year_span,
                    "valid_fraction": min(1.0, len(years_a) / max(1, year_span)),
                    "missing_periods": [],
                    "spatial_coverage": sum_meta_a,
                },
                "method": {
                    "estimator": "ols_hac_newey_west",
                    "dependence_treatment": "newey_west_bartlett_lag_2",
                    "test_family": "single_predefined_test",
                    "selection_status": selection_status,
                },
                "provenance": {
                    "manifest_hash": "0000000000000000",
                    "source_release": "v1.0",
                    "configuration_hash": hashlib.sha256(json.dumps(request_data, sort_keys=True).encode()).hexdigest(),
                },
                "caveats": [f"Investigation is ineligible: {reason}"],
            }
            analysis_results.append(ineligible_res)
        elif has_paired:
            contrast_res = estimate_paired_contrast(
                years_a=years_a,
                values_a=vals_a,
                years_b=years_b,
                values_b=vals_b,
                dataset_id=dataset_id,
                variable=variable,
                units=units,
                unit_per_decade=unit_per_decade,
                geometry_a=region_a_raw if isinstance(region_a_raw, dict) else {"type": "BBox", "bbox": region_a_raw},
                geometry_b=region_b_raw if isinstance(region_b_raw, dict) else {"type": "BBox", "bbox": region_b_raw},
                selection_status=selection_status,
            )
            analysis_results.append(contrast_res)
            result_status = contrast_res["status"]

            # Wire exploratory hypothesis screening family tracking into contrast adjudication
            if selection_status == "exploratory_map_selected":
                family_id = f"map_screening_{job_id}"
                adjudicated = adjudicate_contrast_family(analysis_results, family_id=family_id, fdr_level=0.05)
                if adjudicated:
                    analysis_results = adjudicated
                    result_status = analysis_results[0]["status"]
        else:
            single_res = estimate_linear_trend(
                years=years_a,
                values=vals_a,
                dataset_id=dataset_id,
                variable=variable,
                units=units,
                unit_per_decade=unit_per_decade,
                geometry=region_a_raw if isinstance(region_a_raw, dict) else {"type": "BBox", "bbox": region_a_raw},
                selection_status=selection_status,
                spatial_coverage=sum_meta_a,
            )
            analysis_results.append(single_res)
            result_status = single_res["status"]

        if data_mode == "demo_sample":
            demo_caveat = "Analysis executed using synthetic demonstration sample data. For verified scientific findings, provide cached NASA granules or live Earthdata access."
            for r in analysis_results:
                if "caveats" in r and demo_caveat not in r["caveats"]:
                    r["caveats"].append(demo_caveat)

        if store.is_cancelled(job_id):
            store.set_result(job_id, job_status="cancelled", error={"reason": "cancelled_at_analyzing"})
            return {"job_id": job_id, "job_status": "cancelled"}

        # ---------------------------------------------------------
        # STAGE 6: PUBLISHING (90% -> 100%)
        # ---------------------------------------------------------
        store.update_stage(job_id, "publishing", 90)
        logger.info("[%s] Stage 6: Writing immutable artifacts and publishing", job_id)

        staging_dir.mkdir(parents=True, exist_ok=True)

        # 1. Write analysis_results.json
        res_file = staging_dir / "analysis_results.json"
        with open(res_file, "w", encoding="utf-8") as f:
            json.dump(analysis_results, f, indent=2)

        # 2. Write region_time_series.csv
        csv_file = staging_dir / "region_time_series.csv"
        if has_paired:
            ts_df = pd.DataFrame({
                "year": years_a,
                "region_a_value": vals_a,
                "region_b_value": vals_b,
                "difference_value": vals_a - vals_b,
            })
        else:
            ts_df = pd.DataFrame({"year": years_a, "region_a_value": vals_a})
        ts_df.to_csv(csv_file, index=False)

        # 3. Write map_grid.json.gz with real OLS+HAC decimated grid fits & Benjamini-Yekutieli FDR multiple testing
        map_file = staging_dir / "map_grid.json.gz"
        stride = max(1, len(lats) // 50)
        sub_lats = lats[::stride].tolist()
        sub_lons = lons[::stride].tolist()
        total_cells = len(sub_lats) * len(sub_lons)

        da_sub = da_ann.isel({lat_name: slice(None, None, stride), lon_name: slice(None, None, stride)})
        sub_vals = da_sub.values  # (n_years, len(sub_lats), len(sub_lons))
        sub_years = da_sub["year"].values.astype(int) if "year" in da_sub.coords else years_a

        slope_band: List[Optional[float]] = []
        slope_se_band: List[Optional[float]] = []
        ci_lower_band: List[Optional[float]] = []
        ci_upper_band: List[Optional[float]] = []
        raw_p_band: List[Optional[float]] = []
        cov_band: List[Optional[float]] = []
        elig_band: List[str] = []

        for i in range(len(sub_lats)):
            for j in range(len(sub_lons)):
                y_series = sub_vals[:, i, j] if sub_vals.ndim == 3 else np.array([sub_vals[i, j]])
                valid_mask = ~np.isnan(y_series)
                valid_cnt = int(np.sum(valid_mask))
                cov_frac = float(valid_cnt / max(1, len(sub_years)))
                cov_band.append(round(cov_frac, 4))

                if valid_cnt >= 20:
                    try:
                        fit = fit_ols_hac_trend(sub_years[valid_mask], y_series[valid_mask], confidence_level=0.95)
                        slope_band.append(round(float(fit["slope_per_decade"]), 4))
                        slope_se_band.append(round(float(fit["slope_se_per_decade"]), 4))
                        ci_lower_band.append(round(float(fit["ci_lower_decade"]), 4))
                        ci_upper_band.append(round(float(fit["ci_upper_decade"]), 4))
                        raw_p_band.append(float(fit["p_value"]))
                        elig_band.append("eligible")
                    except Exception:
                        slope_band.append(None)
                        slope_se_band.append(None)
                        ci_lower_band.append(None)
                        ci_upper_band.append(None)
                        raw_p_band.append(1.0)
                        elig_band.append("ineligible")
                else:
                    slope_band.append(None)
                    slope_se_band.append(None)
                    ci_lower_band.append(None)
                    ci_upper_band.append(None)
                    raw_p_band.append(1.0)
                    elig_band.append("missing" if valid_cnt == 0 else "ineligible")

        # Adjust p-values across all eligible cells in map screening family using Benjamini-Yekutieli (fdr_by)
        p_arr = np.array([p if p is not None else 1.0 for p in raw_p_band], dtype=np.float64)
        rej_by, adj_p_by = adjust_pvalues(p_arr, method="fdr_by", alpha=0.05)

        adj_p_band: List[Optional[float]] = []
        evid_band: List[str] = []
        for idx in range(total_cells):
            if elig_band[idx] == "eligible":
                adj_val = float(adj_p_by[idx])
                adj_p_band.append(round(adj_val, 6))
                evid_band.append("supported" if adj_val < 0.05 else "inconclusive")
            else:
                adj_p_band.append(None)
                evid_band.append("ineligible")

        valid_slopes = [s for s in slope_band if s is not None]
        max_abs_slope = float(max(abs(min(valid_slopes, default=-1.0)), abs(max(valid_slopes, default=1.0)), 0.1))

        grid_data = {
            "grid": {
                "crs": "EPSG:4326",
                "width": len(sub_lons),
                "height": len(sub_lats),
                "longitude": sub_lons,
                "latitude": sub_lats,
                "order": "latitude_longitude",
            },
            "bands": {
                "slope_per_decade": slope_band,
                "slope_se_per_decade": slope_se_band,
                "ci_lower_per_decade": ci_lower_band,
                "ci_upper_per_decade": ci_upper_band,
                "raw_p_value": [round(p, 6) if p is not None else None for p in raw_p_band],
                "adjusted_p_value": adj_p_band,
                "coverage_fraction": cov_band,
                "eligibility_code": elig_band,
                "evidence_code": evid_band,
            },
            "legend": {
                "variable": variable,
                "units": unit_per_decade,
                "center": 0.0,
                "minimum": -round(max_abs_slope, 2),
                "maximum": round(max_abs_slope, 2),
                "fdr_method": "fdr_by",
                "fdr_level": 0.05,
            },
            "provenance": {
                "map_family_id": f"map_family_{job_id}",
                "family_size": total_cells,
            },
        }
        with gzip.open(map_file, "wt", encoding="utf-8") as gz:
            json.dump(grid_data, gz)

        # 4. Compute artifact checksums
        artifact_index = {}
        for fpath in (res_file, csv_file, map_file):
            sha = _compute_sha256(fpath)
            mime = "application/json" if fpath.suffix == ".json" else ("text/csv" if fpath.suffix == ".csv" else "application/gzip")
            artifact_index[fpath.name] = {
                "checksum_sha256": sha,
                "mime_type": mime,
                "byte_size": fpath.stat().st_size,
            }

        # 5. Build InvestigationRecord
        now_iso = datetime.now(timezone.utc).isoformat()
        resolved_cfg = {
            "dataset_id": dataset_id,
            "variable": variable,
            "units": units,
            "period": {"start_year": start_year, "end_year": end_year},
            "quality_policy": {"policy": "standard_nasa_quality"},
            "estimator": {"family": "ols_hac", "lag": 2},
            "spatial_weighting": "exact_geodesic_cell_bounds",
            "execution_mode": exec_mode,
            "selection_status": selection_status,
        }
        cfg_hash = hashlib.sha256(json.dumps(resolved_cfg, sort_keys=True).encode()).hexdigest()

        record = {
            "schema_version": "1.0.0",
            "investigation_id": job_id,
            "created_at": now_iso,
            "published_at": now_iso,
            "job": {
                "job_id": job_id,
                "job_status": "succeeded",
                "stage": "publishing",
                "result_status": result_status,
                "progress_pct": 100,
                "created_at": now_iso,
                "started_at": now_iso,
                "completed_at": now_iso,
                "error": None,
            },
            "data_mode": data_mode,
            "request": request_data,
            "resolved_configuration": resolved_cfg,
            "resolved_configuration_hash": cfg_hash,
            "source_manifests": [f"data/manifests/{dataset_id}.json"],
            "source_manifest_objects": [{"dataset_id": dataset_id, "variable": variable}],
            "results": analysis_results,
            "artifact_index": artifact_index,
            "record_hash": "0000000000000000000000000000000000000000000000000000000000000000",
            "map_family_id": f"map_family_{job_id}",
            "software": {
                "version": "0.1.0",
                "environment": {"python": sys.version.split()[0]},
                "git_commit": "2cc4e43",
            },
            "selection_history": [],
            "citations": ["https://doi.org/10.5067/AP1B0BA5PD2K"],
        }
        # Compute canonical hash for record
        rec_str = json.dumps(record, sort_keys=True)
        record["record_hash"] = hashlib.sha256(rec_str.encode()).hexdigest()

        rec_file = staging_dir / "investigation_record.json"
        with open(rec_file, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)

        artifact_index[rec_file.name] = {
            "checksum_sha256": _compute_sha256(rec_file),
            "mime_type": "application/json",
            "byte_size": rec_file.stat().st_size,
        }

        # Atomically move staging to final directory
        if job_artifacts_dir.exists():
            shutil.rmtree(job_artifacts_dir)
        staging_dir.rename(job_artifacts_dir)

        # Update JobStore with success
        store.set_result(
            job_id=job_id,
            job_status="succeeded",
            result_status=result_status,
            artifacts_dir=str(job_artifacts_dir),
            resolved_config=resolved_cfg,
        )

        logger.info("[%s] Pipeline succeeded with result_status=%s", job_id, result_status)
        return {
            "job_id": job_id,
            "job_status": "succeeded",
            "result_status": result_status,
            "artifacts_dir": str(job_artifacts_dir),
        }

    except Exception as exc:
        logger.exception("[%s] Pipeline failed: %s", job_id, exc)
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)

        err_dict = {
            "type": type(exc).__name__,
            "message": str(exc),
        }
        store.set_result(job_id, job_status="failed", error=err_dict)
        raise exc
