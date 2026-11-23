from app.models import CustomerInquiry, Project, ProjectCategory, Service, Skill, SkillCategory


def _seed(db):
    cat = ProjectCategory(name="Artificial Intelligence", slug="ai")
    svc = Service(slug="web-development", title="Web Development", summary="s")
    db.add_all([cat, svc])
    db.flush()
    db.add_all([
        Project(slug="pub", title="Published Vision", short_description="detects things", is_published=True, category_id=cat.id, service_id=svc.id, is_featured=True),
        Project(slug="draft", title="Draft Project", is_published=False),
    ])
    sc = SkillCategory(name="Dev", slug="dev")
    db.add(sc)
    db.flush()
    db.add_all([Skill(category_id=sc.id, name="Python"), Skill(category_id=sc.id, name="Hidden", visible=False)])
    db.commit()


def test_empty_state(client):
    assert client.get("/api/v1/profile").json() is None
    assert client.get("/api/v1/projects").json()["total"] == 0
    assert client.get("/api/v1/skills").json() == []
    assert client.get("/api/v1/site").json()["primary_color"] == "#2563EB"


def test_only_published_projects_public(client, db):
    _seed(db)
    data = client.get("/api/v1/projects").json()
    assert [p["slug"] for p in data["items"]] == ["pub"]
    assert client.get("/api/v1/projects/draft").status_code == 404
    detail = client.get("/api/v1/projects/pub").json()
    assert detail["category_slug"] == "ai" and detail["service_slug"] == "web-development"


def test_project_filters(client, db):
    _seed(db)
    assert client.get("/api/v1/projects", params={"category": "ai"}).json()["total"] == 1
    assert client.get("/api/v1/projects", params={"category": "none"}).json()["total"] == 0
    assert client.get("/api/v1/projects", params={"q": "vision"}).json()["total"] == 1
    assert client.get("/api/v1/projects", params={"q": "zzz"}).json()["total"] == 0
    assert client.get("/api/v1/projects", params={"featured": "true"}).json()["total"] == 1


def test_hidden_skills_not_listed(client, db):
    _seed(db)
    names = [s["name"] for c in client.get("/api/v1/skills").json() for s in c["skills"]]
    assert names == ["Python"]


def test_service_detail(client, db):
    _seed(db)
    d = client.get("/api/v1/services/web-development").json()
    assert d["title"] == "Web Development" and len(d["projects"]) == 1
    assert client.get("/api/v1/services/nope").status_code == 404


VALID = {"name": "Amina Juma", "email": "amina@example.com", "message": "I need an inventory system for my shop."}


def test_inquiry_saved_with_reference(client, db):
    r = client.post("/api/v1/inquiries", json={**VALID, "service_slug": "nope"})
    assert r.status_code == 201
    ref = r.json()["reference"]
    assert ref.startswith("GRG-")
    row = db.query(CustomerInquiry).one()
    assert row.reference == ref and row.status == "new"


def test_inquiry_validation(client):
    r = client.post("/api/v1/inquiries", json={"name": "A", "email": "bad", "message": "short"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_inquiry_honeypot_stores_nothing(client, db):
    r = client.post("/api/v1/inquiries", json={**VALID, "website": "http://spam"})
    assert r.status_code == 201
    assert db.query(CustomerInquiry).count() == 0


def test_inquiry_rate_limited(client):
    codes = [client.post("/api/v1/inquiries", json=VALID).status_code for _ in range(6)]
    assert codes[:5] == [201] * 5 and codes[5] == 429


def test_seed_is_idempotent_and_invents_nothing(client, db):
    from app.seed import seed

    seed(db)
    seed(db)
    assert db.query(Service).count() == 9
    assert db.query(ProjectCategory).count() == 8
    assert db.query(Project).count() == 0
    assert db.query(Skill).filter(Skill.proficiency.isnot(None)).count() == 0
    p = client.get("/api/v1/profile").json()
    assert p["full_name"] == "Gregory Bahati" and p["stats"] == []
