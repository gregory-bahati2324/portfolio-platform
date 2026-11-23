from fastapi import APIRouter

from app.api.v1.admin import chatbot, content, extras, media, projects

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(content.router)
router.include_router(projects.router)
router.include_router(media.router)
router.include_router(chatbot.router)
router.include_router(extras.router)
