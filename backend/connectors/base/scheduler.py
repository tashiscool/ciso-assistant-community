"""
Connector scheduler for managing sync operations.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
from enum import Enum
import logging

from .connector import BaseConnector, ConnectorResult, ConnectorStatus

logger = logging.getLogger(__name__)


class ScheduleType(Enum):
    """Type of schedule for connector sync."""
    INTERVAL = "interval"  # Run every N minutes
    CRON = "cron"  # Run on cron schedule
    WEBHOOK = "webhook"  # Triggered by webhook only
    MANUAL = "manual"  # Manual trigger only


@dataclass
class SyncSchedule:
    """Schedule configuration for a connector."""
    schedule_type: ScheduleType = ScheduleType.INTERVAL
    interval_minutes: int = 60
    cron_expression: Optional[str] = None
    enabled: bool = True
    max_retries: int = 3
    retry_delay_seconds: int = 60

    # Execution tracking
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    consecutive_failures: int = 0

    def calculate_next_run(self) -> Optional[datetime]:
        """Calculate the next run time."""
        if self.schedule_type == ScheduleType.INTERVAL:
            return datetime.utcnow() + timedelta(minutes=self.interval_minutes)
        elif self.schedule_type == ScheduleType.CRON:
            # Would need croniter library for full cron support
            # For now, fall back to interval
            return datetime.utcnow() + timedelta(minutes=self.interval_minutes)
        return None


@dataclass
class SyncTask:
    """A scheduled sync task."""
    task_id: str
    connector_type: str
    connector_config_id: str
    schedule: SyncSchedule
    connector: Optional[BaseConnector] = None
    callback: Optional[Callable[[ConnectorResult], Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SyncExecution:
    """Record of a sync execution."""
    execution_id: str
    task_id: str
    connector_type: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[ConnectorResult] = None
    status: str = "running"
    error_message: Optional[str] = None


class ConnectorScheduler:
    """
    Scheduler for managing connector sync operations.

    Features:
    - Interval-based scheduling
    - Retry logic with backoff
    - Concurrent execution management
    - Execution history tracking
    """

    def __init__(
        self,
        max_concurrent: int = 5,
        history_size: int = 100,
    ):
        self.max_concurrent = max_concurrent
        self.history_size = history_size

        self._tasks: Dict[str, SyncTask] = {}
        self._running: Dict[str, asyncio.Task] = {}
        self._history: List[SyncExecution] = []
        self._scheduler_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()
        self._semaphore: Optional[asyncio.Semaphore] = None

    async def start(self):
        """Start the scheduler."""
        if self._scheduler_task is not None:
            logger.warning("Scheduler already running")
            return

        self._shutdown_event.clear()
        self._semaphore = asyncio.Semaphore(self.max_concurrent)
        self._scheduler_task = asyncio.create_task(self._run_scheduler())
        logger.info("Connector scheduler started")

    async def stop(self):
        """Stop the scheduler gracefully."""
        if self._scheduler_task is None:
            return

        self._shutdown_event.set()

        # Wait for running tasks to complete
        if self._running:
            logger.info(f"Waiting for {len(self._running)} tasks to complete...")
            await asyncio.gather(*self._running.values(), return_exceptions=True)

        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass

        self._scheduler_task = None
        logger.info("Connector scheduler stopped")

    def add_task(self, task: SyncTask) -> None:
        """Add a sync task to the scheduler."""
        task.schedule.next_run = task.schedule.calculate_next_run()
        self._tasks[task.task_id] = task
        logger.info(f"Added sync task: {task.task_id} for {task.connector_type}")

    def remove_task(self, task_id: str) -> None:
        """Remove a sync task from the scheduler."""
        if task_id in self._tasks:
            del self._tasks[task_id]
            logger.info(f"Removed sync task: {task_id}")

    def get_task(self, task_id: str) -> Optional[SyncTask]:
        """Get a sync task by ID."""
        return self._tasks.get(task_id)

    def list_tasks(self) -> List[SyncTask]:
        """List all scheduled tasks."""
        return list(self._tasks.values())

    async def trigger_sync(self, task_id: str, **kwargs) -> Optional[SyncExecution]:
        """Manually trigger a sync for a task."""
        task = self._tasks.get(task_id)
        if task is None:
            logger.error(f"Task not found: {task_id}")
            return None

        if task_id in self._running:
            logger.warning(f"Task already running: {task_id}")
            return None

        return await self._execute_task(task, **kwargs)

    async def _run_scheduler(self):
        """Main scheduler loop."""
        while not self._shutdown_event.is_set():
            try:
                await self._check_scheduled_tasks()
                await asyncio.sleep(10)  # Check every 10 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Scheduler error: {e}")
                await asyncio.sleep(30)

    async def _check_scheduled_tasks(self):
        """Check for tasks that need to run."""
        now = datetime.utcnow()

        for task in self._tasks.values():
            if not task.schedule.enabled:
                continue

            if task.task_id in self._running:
                continue

            if task.schedule.next_run and task.schedule.next_run <= now:
                # Time to run this task
                asyncio.create_task(self._execute_task(task))

    async def _execute_task(self, task: SyncTask, **kwargs) -> SyncExecution:
        """Execute a sync task."""
        import uuid

        execution = SyncExecution(
            execution_id=str(uuid.uuid4()),
            task_id=task.task_id,
            connector_type=task.connector_type,
            started_at=datetime.utcnow(),
        )

        async with self._semaphore:
            self._running[task.task_id] = asyncio.current_task()

            try:
                if task.connector is None:
                    execution.status = "failed"
                    execution.error_message = "Connector not configured"
                    return execution

                # Run the sync
                result = await self._run_with_retry(task, **kwargs)
                execution.result = result
                execution.status = "success" if result.success else "failed"
                execution.error_message = result.error_message

                if result.success:
                    task.schedule.consecutive_failures = 0
                else:
                    task.schedule.consecutive_failures += 1

                # Call callback if configured
                if task.callback:
                    try:
                        callback_result = task.callback(result)
                        if asyncio.iscoroutine(callback_result):
                            await callback_result
                    except Exception as e:
                        logger.error(f"Callback error for task {task.task_id}: {e}")

            except Exception as e:
                execution.status = "error"
                execution.error_message = str(e)
                task.schedule.consecutive_failures += 1
                logger.exception(f"Task execution error: {task.task_id}")

            finally:
                execution.completed_at = datetime.utcnow()
                task.schedule.last_run = execution.completed_at
                task.schedule.next_run = task.schedule.calculate_next_run()

                self._add_to_history(execution)
                del self._running[task.task_id]

        return execution

    async def _run_with_retry(self, task: SyncTask, **kwargs) -> ConnectorResult:
        """Run sync with retry logic."""
        last_result = None
        retries = 0

        while retries <= task.schedule.max_retries:
            try:
                result = await task.connector.sync(**kwargs)
                if result.success:
                    return result

                last_result = result

                # Check if error is recoverable
                if "recoverable" in result.metadata and not result.metadata["recoverable"]:
                    return result

                retries += 1
                if retries <= task.schedule.max_retries:
                    delay = task.schedule.retry_delay_seconds * (2 ** (retries - 1))
                    logger.info(f"Retry {retries}/{task.schedule.max_retries} for {task.task_id} in {delay}s")
                    await asyncio.sleep(delay)

            except Exception as e:
                logger.error(f"Sync error for {task.task_id}: {e}")
                last_result = ConnectorResult(
                    success=False,
                    error_message=str(e),
                    error_code="SYNC_ERROR"
                )
                retries += 1
                if retries <= task.schedule.max_retries:
                    delay = task.schedule.retry_delay_seconds * (2 ** (retries - 1))
                    await asyncio.sleep(delay)

        return last_result or ConnectorResult(
            success=False,
            error_message="Max retries exceeded",
            error_code="MAX_RETRIES"
        )

    def _add_to_history(self, execution: SyncExecution):
        """Add execution to history, maintaining size limit."""
        self._history.append(execution)
        if len(self._history) > self.history_size:
            self._history = self._history[-self.history_size:]

    def get_history(
        self,
        task_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[SyncExecution]:
        """Get execution history, optionally filtered by task."""
        history = self._history
        if task_id:
            history = [e for e in history if e.task_id == task_id]
        return list(reversed(history[-limit:]))

    def get_status(self) -> dict:
        """Get scheduler status."""
        return {
            "running": self._scheduler_task is not None,
            "total_tasks": len(self._tasks),
            "enabled_tasks": sum(1 for t in self._tasks.values() if t.schedule.enabled),
            "currently_running": len(self._running),
            "history_size": len(self._history),
        }
