"""Bounded asynchronous queue worker and execution management for Terra Odyssey."""

from __future__ import annotations

import asyncio
from concurrent.futures import Executor, ProcessPoolExecutor, ThreadPoolExecutor
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union

from src.backend.stepper import run_pipeline

logger = logging.getLogger("terra_odyssey.backend.worker")

# Bounded queue preventing concurrent overload
_job_queue: Optional[asyncio.Queue[Tuple[str, Dict[str, Any], Optional[str], Optional[str]]]] = None
_executor: Optional[Executor] = None
_worker_task: Optional[asyncio.Task] = None


def get_queue(maxsize: int = 10) -> asyncio.Queue:
    global _job_queue
    if _job_queue is None:
        _job_queue = asyncio.Queue(maxsize=maxsize)
    return _job_queue


def get_executor(use_threads: bool = False) -> Executor:
    global _executor
    if _executor is None:
        # Default to ThreadPoolExecutor or ProcessPoolExecutor
        if use_threads:
            _executor = ThreadPoolExecutor(max_workers=1)
        else:
            try:
                _executor = ProcessPoolExecutor(max_workers=1)
            except Exception as e:
                logger.warning("Failed to initialize ProcessPoolExecutor (%s); falling back to ThreadPoolExecutor", e)
                _executor = ThreadPoolExecutor(max_workers=1)
    return _executor


async def worker_loop() -> None:
    """Consume jobs sequentially from bounded queue and execute via executor."""
    queue = get_queue()
    executor = get_executor()
    loop = asyncio.get_running_loop()

    logger.info("Terra Odyssey scientific job worker started")
    try:
        while True:
            job_id, req_data, artifacts_dir, store_path = await queue.get()
            logger.info("Worker picked up job %s from queue", job_id)
            try:
                await loop.run_in_executor(
                    executor,
                    run_pipeline,
                    job_id,
                    req_data,
                    artifacts_dir,
                    store_path,
                )
            except Exception as exc:
                logger.error("Job %s execution failed in worker: %s", job_id, exc)
            finally:
                queue.task_done()
    except asyncio.CancelledError:
        logger.info("Worker loop cancelled; exiting gracefully")
        raise


async def enqueue_job(
    job_id: str,
    request_data: Dict[str, Any],
    artifacts_dir: Optional[Union[str, Path]] = None,
    store_db_path: Optional[Union[str, Path]] = None,
) -> bool:
    """Enqueue a job ID and its configuration into the bounded worker queue."""
    queue = get_queue()
    art_str = str(artifacts_dir) if artifacts_dir else None
    db_str = str(store_db_path) if store_db_path else None
    try:
        queue.put_nowait((job_id, request_data, art_str, db_str))
        return True
    except asyncio.QueueFull:
        logger.warning("Worker queue is full (maxsize=%d); rejecting job %s", queue.maxsize, job_id)
        return False


def start_worker_task() -> asyncio.Task:
    """Start background worker task."""
    global _worker_task
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(worker_loop())
    return _worker_task


async def stop_worker_task() -> None:
    """Stop worker task and shut down executor."""
    global _worker_task, _executor
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        _worker_task = None

    if _executor:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None
