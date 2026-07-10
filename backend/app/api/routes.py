"""Thin aggregator — includes all sub-routers under a single namespace."""
from fastapi import APIRouter

from app.api.brands import router as brands_router
from app.api.queries import router as queries_router
from app.api.scans import router as scans_router
from app.api.dashboard import router as dashboard_router
from app.api.drilldown import router as drilldown_router
from app.api.credits import router as credits_router

router = APIRouter()

router.include_router(brands_router)
router.include_router(queries_router)
router.include_router(scans_router)
router.include_router(dashboard_router)
router.include_router(drilldown_router)
router.include_router(credits_router)

# Re-export background task for main.py recovery
from app.api.scans import _run_scan_background  # noqa: F401
