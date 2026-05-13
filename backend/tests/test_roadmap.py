"""
Tests for Roadmap API:
- Phase CRUD
- Sprint CRUD
- Task assignment to sprint
- Delete phase → action_items get phase_id nullified
"""
import pytest
import httpx

BASE_URL = "http://localhost:8000"


def _get_product_id() -> str:
    """Get a real product ID from the API."""
    try:
        r = httpx.get(f"{BASE_URL}/api/products", timeout=10)
        products = r.json()
        if products:
            return products[0]["id"]
    except Exception:
        pass
    return "a47913fb-3cda-473d-912a-a388682556e7"  # fallback


PRODUCT_ID = _get_product_id()


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        yield c


@pytest.fixture
def phase_and_sprint(client):
    """Creates a phase + sprint, yields (phase, sprint), deletes phase on teardown."""
    phase = create_phase(client, name="Fixture Phase")
    sprint = create_sprint(client, phase["id"])
    yield phase, sprint
    # Phase delete cascades to sprint
    client.delete(f"/api/roadmap/phases/{phase['id']}")


def create_phase(client, name="Test Phase") -> dict:
    r = client.post("/api/roadmap/phases", json={
        "product_id": PRODUCT_ID,
        "name": name,
        "description": "Test description",
    })
    assert r.status_code == 201, r.text
    return r.json()


def create_sprint(client, phase_id: str, name="Sprint 1") -> dict:
    r = client.post("/api/roadmap/sprints", json={
        "phase_id": phase_id,
        "name": name,
        "start_date": "2026-05-18",
        "end_date": "2026-05-31",
    })
    assert r.status_code == 201, r.text
    return r.json()


def create_action_item(client, phase_id: str, sprint_id: str) -> dict:
    r = client.post("/api/action-items", json={
        "product_id": PRODUCT_ID,
        "title": "Roadmap task",
        "phase_id": phase_id,
        "sprint_id": sprint_id,
    })
    assert r.status_code == 201, r.text
    return r.json()


# ── Phase CRUD ────────────────────────────────────────────────────────────────

def test_create_phase(client):
    phase = create_phase(client)
    assert phase["name"] == "Test Phase"
    assert phase["product_id"] == PRODUCT_ID
    assert phase["sprints"] == []
    # Cleanup
    client.delete(f"/api/roadmap/phases/{phase['id']}")


def test_list_phases(client):
    phase = create_phase(client, name="Phase List Test")
    r = client.get(f"/api/roadmap/phases?product_id={PRODUCT_ID}")
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert phase["id"] in ids
    # Cleanup
    client.delete(f"/api/roadmap/phases/{phase['id']}")


def test_update_phase(client):
    phase = create_phase(client)
    r = client.patch(f"/api/roadmap/phases/{phase['id']}", json={"name": "Updated Phase"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Phase"
    # Cleanup
    client.delete(f"/api/roadmap/phases/{phase['id']}")


def test_delete_phase(client):
    phase = create_phase(client)
    r = client.delete(f"/api/roadmap/phases/{phase['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/api/roadmap/phases?product_id={PRODUCT_ID}")
    ids = [p["id"] for p in r2.json()]
    assert phase["id"] not in ids


# ── Sprint CRUD ───────────────────────────────────────────────────────────────

def test_create_sprint(client):
    phase = create_phase(client)
    sprint = create_sprint(client, phase["id"])
    assert sprint["phase_id"] == phase["id"]
    assert sprint["name"] == "Sprint 1"
    assert sprint["start_date"] == "2026-05-18"
    assert sprint["task_counts"]["total"] == 0
    # Cleanup
    client.delete(f"/api/roadmap/sprints/{sprint['id']}")
    client.delete(f"/api/roadmap/phases/{phase['id']}")


def test_update_sprint(client):
    phase = create_phase(client)
    sprint = create_sprint(client, phase["id"])
    r = client.patch(f"/api/roadmap/sprints/{sprint['id']}", json={"name": "Sprint Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Sprint Updated"
    # Cleanup
    client.delete(f"/api/roadmap/phases/{phase['id']}")


def test_delete_sprint(client):
    phase = create_phase(client)
    sprint = create_sprint(client, phase["id"])
    r = client.delete(f"/api/roadmap/sprints/{sprint['id']}")
    assert r.status_code == 204
    # Cleanup
    client.delete(f"/api/roadmap/phases/{phase['id']}")


# ── Task assignment ───────────────────────────────────────────────────────────

def test_task_appears_in_sprint(client, phase_and_sprint):
    phase, sprint = phase_and_sprint
    task = create_action_item(client, phase["id"], sprint["id"])
    assert task["phase_id"] == phase["id"]
    assert task["sprint_id"] == sprint["id"]

    r = client.get(f"/api/roadmap/tasks?sprint_id={sprint['id']}")
    assert r.status_code == 200
    task_ids = [t["id"] for t in r.json()]
    assert task["id"] in task_ids

    # task_counts reflect task
    sprint_r = client.get(f"/api/roadmap/phases?product_id={PRODUCT_ID}")
    phases = sprint_r.json()
    target_phase = next(p for p in phases if p["id"] == phase["id"])
    target_sprint = next(s for s in target_phase["sprints"] if s["id"] == sprint["id"])
    assert target_sprint["task_counts"]["total"] == 1

    # Cleanup task (phase/sprint cleaned up by fixture)
    client.delete(f"/api/action-items/{task['id']}")


def test_delete_phase_nullifies_task_phase_id(client, phase_and_sprint):
    """Deleting a phase sets phase_id = null on its tasks (tasks not deleted)."""
    phase, sprint = phase_and_sprint
    task = create_action_item(client, phase["id"], sprint["id"])

    client.delete(f"/api/roadmap/phases/{phase['id']}")

    # Task still exists but phase_id and sprint_id are null
    r = client.get(f"/api/action-items/{task['id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["phase_id"] is None
    assert body["sprint_id"] is None

    # Cleanup task
    client.delete(f"/api/action-items/{task['id']}")
