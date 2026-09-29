"""Authoritative SQLite Job Store for Terra Odyssey."""

from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from backend.paths import DATA_DIR

logger = logging.getLogger("terra_odyssey.backend.store")


def default_db_path() -> Path:
    """Resolve default SQLite database path in data/jobs.db."""
    return DATA_DIR / "jobs.db"


class JobStore:
    """Thread-safe SQLite store managing job lifecycles and orthogonal statuses."""

    def __init__(self, db_path: Optional[Union[str, Path]] = None) -> None:
        self.db_path = Path(db_path) if db_path else default_db_path()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS investigation_jobs (
                    job_id TEXT PRIMARY KEY,
                    idempotency_key TEXT UNIQUE,
                    config_hash TEXT NOT NULL,
                    job_status TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    result_status TEXT,
                    progress_pct INTEGER NOT NULL DEFAULT 0,
                    request_json TEXT NOT NULL,
                    resolved_config_json TEXT,
                    error_json TEXT,
                    artifacts_dir TEXT,
                    created_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT,
                    updated_at TEXT NOT NULL
                );
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_jobs_config_hash ON investigation_jobs (config_hash);"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_jobs_status ON investigation_jobs (job_status);"
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS study_plots (
                    plot_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    geometry_type TEXT NOT NULL DEFAULT 'Polygon',
                    coordinates_json TEXT NOT NULL,
                    bbox_json TEXT NOT NULL,
                    measurements_json TEXT NOT NULL,
                    dataset_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_study_plots_active ON study_plots (is_active);"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_study_plots_updated_at ON study_plots (updated_at);"
            )
            conn.commit()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        data = dict(row)
        for json_col in ("request_json", "resolved_config_json", "error_json"):
            val = data.get(json_col)
            if val is not None:
                try:
                    data[json_col.replace("_json", "")] = json.loads(val)
                except Exception:
                    data[json_col.replace("_json", "")] = val
            else:
                data[json_col.replace("_json", "")] = None
        return data

    def create_job(
        self,
        request_data: Dict[str, Any],
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new job or return existing job for idempotent or in-flight requests."""
        config_hash = hashlib.sha256(
            json.dumps(request_data, sort_keys=True).encode("utf-8")
        ).hexdigest()

        with self._get_connection() as conn:
            # 1. Check idempotency key if provided
            if idempotency_key:
                cursor = conn.execute(
                    "SELECT * FROM investigation_jobs WHERE idempotency_key = ?",
                    (idempotency_key,),
                )
                row = cursor.fetchone()
                if row:
                    logger.info("Deduplicated job by idempotency key: %s", idempotency_key)
                    return self._row_to_dict(row)

            # 2. Check active in-flight job with identical config hash
            cursor = conn.execute(
                """
                SELECT * FROM investigation_jobs
                WHERE config_hash = ? AND job_status IN ('submitted', 'running')
                ORDER BY created_at DESC LIMIT 1
                """,
                (config_hash,),
            )
            active_row = cursor.fetchone()
            if active_row:
                logger.info("Reusing in-flight job with matching config hash: %s", active_row["job_id"])
                return self._row_to_dict(active_row)

            # 3. Create fresh job
            job_id = f"inv-{uuid.uuid4().hex[:12]}"
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO investigation_jobs (
                    job_id, idempotency_key, config_hash, job_status, stage,
                    result_status, progress_pct, request_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    idempotency_key,
                    config_hash,
                    "submitted",
                    "validating",
                    None,
                    0,
                    json.dumps(request_data),
                    now,
                    now,
                ),
            )
            conn.commit()

        return self.get_job(job_id)  # type: ignore[return-value]

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Fetch job details by job_id."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM investigation_jobs WHERE job_id = ?",
                (job_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_dict(row)

    def update_stage(
        self,
        job_id: str,
        stage: str,
        progress_pct: Optional[int] = None,
    ) -> None:
        """Advance job pipeline stage and record timestamps."""
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT job_status, started_at FROM investigation_jobs WHERE job_id = ?",
                (job_id,),
            )
            row = cursor.fetchone()
            if not row:
                return

            new_status = "running" if row["job_status"] == "submitted" else row["job_status"]
            started_at = row["started_at"] or (now if new_status == "running" else None)

            if progress_pct is not None:
                conn.execute(
                    """
                    UPDATE investigation_jobs
                    SET stage = ?, job_status = ?, progress_pct = ?, started_at = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (stage, new_status, progress_pct, started_at, now, job_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE investigation_jobs
                    SET stage = ?, job_status = ?, started_at = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (stage, new_status, started_at, now, job_id),
                )
            conn.commit()

    def set_result(
        self,
        job_id: str,
        job_status: str,
        result_status: Optional[str] = None,
        artifacts_dir: Optional[str] = None,
        error: Optional[Union[Dict[str, Any], str]] = None,
        resolved_config: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Transition job to terminal state and record scientific outcome."""
        now = datetime.now(timezone.utc).isoformat()
        err_str = json.dumps(error) if isinstance(error, (dict, list)) else (str(error) if error else None)
        cfg_str = json.dumps(resolved_config) if resolved_config is not None else None
        pct = 100 if job_status == "succeeded" else None

        with self._get_connection() as conn:
            if pct is not None:
                conn.execute(
                    """
                    UPDATE investigation_jobs
                    SET job_status = ?, result_status = ?, artifacts_dir = ?,
                        error_json = ?, resolved_config_json = COALESCE(?, resolved_config_json),
                        progress_pct = ?, completed_at = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (job_status, result_status, artifacts_dir, err_str, cfg_str, pct, now, now, job_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE investigation_jobs
                    SET job_status = ?, result_status = ?, artifacts_dir = ?,
                        error_json = ?, resolved_config_json = COALESCE(?, resolved_config_json),
                        completed_at = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (job_status, result_status, artifacts_dir, err_str, cfg_str, now, now, job_id),
                )
            conn.commit()

    def request_cancellation(self, job_id: str) -> bool:
        """Signal cooperative cancellation to worker."""
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT job_status FROM investigation_jobs WHERE job_id = ?",
                (job_id,),
            )
            row = cursor.fetchone()
            if not row or row["job_status"] not in ("submitted", "running"):
                return False

            conn.execute(
                """
                UPDATE investigation_jobs
                SET job_status = 'cancel_requested', updated_at = ?
                WHERE job_id = ?
                """,
                (now, job_id),
            )
            conn.commit()
            return True

    def is_cancelled(self, job_id: str) -> bool:
        """Check if job cancellation was requested or completed."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT job_status FROM investigation_jobs WHERE job_id = ?",
                (job_id,),
            )
            row = cursor.fetchone()
            if not row:
                return False
            return row["job_status"] in ("cancel_requested", "cancelled")

    def recover_interrupted_jobs(self) -> int:
        """Mark stranded jobs from prior server run as failed."""
        now = datetime.now(timezone.utc).isoformat()
        err_str = json.dumps({
            "code": "interrupted_on_restart",
            "message": "Process was interrupted due to server restart",
        })
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE investigation_jobs
                SET job_status = 'failed', error_json = ?, completed_at = ?, updated_at = ?
                WHERE job_status IN ('running', 'cancel_requested')
                """,
                (err_str, now, now),
            )
            conn.commit()
            return cursor.rowcount

    def list_jobs(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """List investigation jobs ordered newest first."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM investigation_jobs ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            return [self._row_to_dict(r) for r in cursor.fetchall()]

    def _plot_row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert SQLite study_plots row into clean Python dictionary."""
        data = dict(row)
        data["is_active"] = bool(data.get("is_active", 0))
        for json_col, target in (
            ("coordinates_json", "coordinates"),
            ("bbox_json", "bbox"),
            ("measurements_json", "measurements"),
        ):
            val = data.get(json_col)
            if val is not None:
                try:
                    data[target] = json.loads(val)
                except Exception:
                    data[target] = []
            else:
                data[target] = []
            data.pop(json_col, None)
        return data

    def upsert_study_plot(self, plot_data: Dict[str, Any]) -> Dict[str, Any]:
        """Upsert a study plot in SQLite. Marks it as active and deactivates others if active."""
        plot_id = plot_data.get("plot_id") or f"plot-{uuid.uuid4().hex[:12]}"
        name = plot_data.get("name") or "Custom Study Region"
        is_active = 1 if plot_data.get("is_active", True) else 0
        geometry_type = plot_data.get("geometry_type") or "Polygon"
        coordinates_json = json.dumps(plot_data.get("coordinates", []))
        bbox_json = json.dumps(plot_data.get("bbox", []))
        measurements_json = json.dumps(plot_data.get("measurements", {}))
        dataset_id = plot_data.get("dataset_id")
        now = datetime.now(timezone.utc).isoformat()

        with self._get_connection() as conn:
            # If activating this plot, mark all others inactive
            if is_active:
                conn.execute("UPDATE study_plots SET is_active = 0 WHERE is_active = 1")

            cursor = conn.execute(
                "SELECT created_at FROM study_plots WHERE plot_id = ?",
                (plot_id,),
            )
            existing = cursor.fetchone()
            created_at = existing["created_at"] if existing else now

            conn.execute(
                """
                INSERT OR REPLACE INTO study_plots (
                    plot_id, name, is_active, geometry_type,
                    coordinates_json, bbox_json, measurements_json,
                    dataset_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    plot_id,
                    name,
                    is_active,
                    geometry_type,
                    coordinates_json,
                    bbox_json,
                    measurements_json,
                    dataset_id,
                    created_at,
                    now,
                ),
            )
            conn.commit()

        result = self.get_study_plot(plot_id)
        if not result:
            raise RuntimeError(f"Failed to retrieve upserted plot {plot_id}")
        return result

    def get_study_plot(self, plot_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific study plot from SQLite by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM study_plots WHERE plot_id = ?",
                (plot_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._plot_row_to_dict(row)

    def get_active_study_plot(self) -> Optional[Dict[str, Any]]:
        """Retrieve the currently active study plot from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM study_plots WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1"
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._plot_row_to_dict(row)

    def list_study_plots(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List all study plots from SQLite ordered newest first."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM study_plots ORDER BY updated_at DESC LIMIT ?",
                (limit,),
            )
            return [self._plot_row_to_dict(r) for r in cursor.fetchall()]

    def delete_study_plot(self, plot_id: str) -> bool:
        """Delete a study plot from SQLite by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM study_plots WHERE plot_id = ?",
                (plot_id,),
            )
            conn.commit()
            return cursor.rowcount > 0

    def clear_study_plots(self) -> int:
        """Clear all study plots from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM study_plots")
            conn.commit()
            return cursor.rowcount

