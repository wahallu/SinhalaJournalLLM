"""
Admin routers.

Every route registered here must carry `require_admin`. These endpoints read
through the service-role client, which bypasses Row Level Security, so a
route added without that dependency is a full authorization bypass —
tests/test_admin_auth.py enumerates the registered routes to catch exactly
that.
"""

from fastapi import APIRouter

from app.api.v1.admin.categories import router as categories_router
from app.api.v1.admin.overview import router as overview_router
from app.api.v1.admin.users import router as users_router

router = APIRouter()

router.include_router(overview_router)
router.include_router(users_router)
router.include_router(categories_router)
