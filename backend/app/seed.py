"""Idempotent starter content taken from the project brief.

Creates structure only: profile text supplied in the brief, skill categories
and skill names, service outlines and project categories. It creates NO
projects, statistics, testimonials or proficiency ratings; the owner adds
those from the dashboard. Run: python -m app.seed
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_sessionmaker
from app.core.text import slugify
from app.models import Profile, ProjectCategory, Service, SiteSettings, Skill, SkillCategory

SKILLS = {
    ("Software Development", "code"): ["Full-stack web development", "React", "TypeScript", "Python", "FastAPI", "REST APIs", "Backend architecture", "Database design", "Distributed systems", "Multi-tenant applications"],
    ("Artificial Intelligence and Machine Learning", "brain"): ["Machine learning", "Deep learning", "Computer vision", "Object detection", "YOLO architectures", "Object tracking", "Transformer architectures", "AI-powered applications", "LLM integration", "AI agents and automation"],
    ("Computer Vision", "eye"): ["Image processing", "Real-time object detection", "Object tracking", "Video analytics", "Intelligent surveillance applications", "Robotics vision", "Edge computer vision"],
    ("Cloud Engineering and DevOps", "cloud"): ["Docker", "Docker Compose", "Jenkins", "CI/CD pipelines", "Linux server administration", "Cloud infrastructure", "Load balancing", "Reverse proxies", "Redis", "System monitoring", "Infrastructure automation", "Deployment architecture"],
    ("System and Database Security", "shield"): ["Authentication and authorization", "JWT security", "Role-based access control", "API security", "Database security", "Secure application architecture", "Audit logging", "Application performance and reliability"],
    ("IoT and Edge AI", "cpu"): ["Internet of Things", "Embedded systems", "ESP32", "Arduino", "Edge AI", "Hardware/software integration", "Intelligent automation"],
    ("System Design and Implementation", "layers"): ["System architecture", "Database architecture", "Business management systems", "Inventory management", "Payment integrations", "Microservices", "Multi-tenant applications", "Technical documentation"],
}

SERVICES = [
    ("web-development", "Web Development", "globe", "Fast, secure websites and web applications built around your business goals."),
    ("system-design-and-implementation", "System Design and Implementation", "layers", "Business systems, such as inventory, sales and purchasing software, designed and built to fit how you work."),
    ("machine-learning-solutions", "Machine Learning Solutions", "brain", "Models that learn from your data to automate decisions and uncover patterns."),
    ("computer-vision-systems", "Computer Vision Systems", "eye", "Systems that detect, count and track objects in images and video."),
    ("ai-integration", "AI Integration", "sparkles", "Add intelligent features to software you already use."),
    ("chatbot-development", "Chatbot Development", "message-circle", "Assistants that answer customer questions and capture inquiries around the clock."),
    ("cloud-engineering", "Cloud Engineering", "cloud", "Reliable deployment, containers and automated pipelines for your applications."),
    ("edge-ai-and-iot", "Edge AI and IoT Solutions", "cpu", "Connected devices and on-device intelligence for real-world automation."),
    ("system-and-database-security", "System and Database Security", "shield", "Protect your applications and data with sound authentication, access control and auditing."),
]

PROJECT_CATEGORIES = ["Web Applications", "Enterprise Systems", "Artificial Intelligence", "Computer Vision", "Machine Learning", "DevOps and Cloud", "IoT and Embedded Systems", "Research and Academic Projects"]



def seed(db: Session) -> None:
    if not db.scalars(select(Profile).limit(1)).first():
        db.add(Profile(
            full_name="Gregory Bahati",
            professional_title="Software Developer | AI/ML Engineer | System Architect | Technology Innovator",
            headline="Building Intelligent Systems and Transforming Ideas into Technology.",
            hero_description="I design, develop, and implement intelligent software systems, AI-powered solutions, and scalable digital infrastructure that solve real-world problems.",
            email="gregorybahati8@gmail.com", availability="", bio_sections={}, stats=[],
        ))
    if not db.scalars(select(SiteSettings).limit(1)).first():
        db.add(SiteSettings(site_title="Gregory Bahati | GregTech", meta_description="Software developer, AI/ML engineer and system architect building intelligent systems."))
    for i, ((name, icon), skills) in enumerate(SKILLS.items()):
        slug = slugify(name)
        cat = db.scalars(select(SkillCategory).where(SkillCategory.slug == slug)).first()
        if not cat:
            cat = SkillCategory(name=name, slug=slug, icon=icon, sort_order=i)
            db.add(cat)
            db.flush()
            for j, sk in enumerate(skills):
                db.add(Skill(category_id=cat.id, name=sk, sort_order=j))
    for i, (slug, title, icon, summary) in enumerate(SERVICES):
        if not db.scalars(select(Service).where(Service.slug == slug)).first():
            db.add(Service(slug=slug, title=title, icon=icon, summary=summary, description=summary, sort_order=i))
    for i, name in enumerate(PROJECT_CATEGORIES):
        if not db.scalars(select(ProjectCategory).where(ProjectCategory.slug == slugify(name))).first():
            db.add(ProjectCategory(name=name, slug=slugify(name), sort_order=i))
    db.commit()


if __name__ == "__main__":
    with get_sessionmaker()() as session:
        seed(session)
    print("Seed complete.")
