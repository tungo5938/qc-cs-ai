"""
E2E tests for the Issues API.
Full flow: create → list → get → approve → vote → reject
Run with: pytest backend/tests/ -v  (from qc-cs-ai/ root)
Requires local backend running: uvicorn main:app --port 8000 --app-dir backend
"""
import pytest
import httpx
from conftest import BASE_URL, PM_EMAIL, USER_EMAIL


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Create ────────────────────────────────────────────────────────────────────

def test_create_issue_returns_201(client):
    r = client.post("/api/issues", json={
        "title": "[TEST] Login page crashes on submit",
        "description": "Clicking submit on the login page causes a 500 error.",
        "type": "bug",
        "submitted_by_email": USER_EMAIL,
    })
    assert r.status_code == 201, r.text
    data = r.json()
    issue_id = data["id"]
    assert data["status"] == "pending_review"
    # Verify full fields via GET as PM
    r2 = client.get(f"/api/issues/{issue_id}", headers={"x-user-email": PM_EMAIL})
    assert r2.json()["title"] == "[TEST] Login page crashes on submit"
    assert r2.json()["is_public"] is False
    # Cleanup
    client.post(f"/api/issues/{issue_id}/reject",
                headers={"x-user-email": PM_EMAIL})


def test_create_issue_missing_fields_returns_422(client):
    r = client.post("/api/issues", json={"title": "No description"})
    assert r.status_code == 422


# ── List ──────────────────────────────────────────────────────────────────────

def test_list_issues_anonymous_sees_only_public(client):
    r = client.get("/api/issues")
    assert r.status_code == 200
    issues = r.json()
    assert all(i["is_public"] for i in issues), \
        "Anonymous user should only see public issues"


def test_list_issues_pm_sees_all(client, pm, created_issue):
    r = client.get("/api/issues", headers=pm)
    assert r.status_code == 200
    ids = [i["id"] for i in r.json()]
    assert created_issue["id"] in ids, \
        "PM should see pending (non-public) issues"


# ── Get ───────────────────────────────────────────────────────────────────────

def test_get_issue_pm_can_read_pending(client, pm, created_issue):
    r = client.get(f"/api/issues/{created_issue['id']}", headers=pm)
    assert r.status_code == 200
    assert r.json()["id"] == created_issue["id"]


def test_get_issue_anonymous_cannot_read_pending(client, created_issue):
    r = client.get(f"/api/issues/{created_issue['id']}")
    assert r.status_code == 404, \
        "Pending issue should not be visible to anonymous users"


def test_get_nonexistent_issue_returns_404(client):
    r = client.get("/api/issues/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


# ── Update ────────────────────────────────────────────────────────────────────

def test_pm_can_update_root_cause(client, pm, created_issue):
    r = client.patch(
        f"/api/issues/{created_issue['id']}",
        headers=pm,
        json={"root_cause": "Memory leak in auth middleware"},
    )
    assert r.status_code == 200
    assert r.json().get("ok") is True
    # Verify via GET
    r2 = client.get(f"/api/issues/{created_issue['id']}", headers=pm)
    assert r2.json()["root_cause"] == "Memory leak in auth middleware"


def test_non_pm_cannot_update(client, user, created_issue):
    r = client.patch(
        f"/api/issues/{created_issue['id']}",
        headers=user,
        json={"root_cause": "Should not work"},
    )
    assert r.status_code == 403


# ── Approve / Reject ──────────────────────────────────────────────────────────

def test_full_approve_flow(client, pm):
    """Create → approve → verify public visibility → cleanup."""
    # Create
    r = client.post("/api/issues", json={
        "title": "[TEST] Approve flow",
        "description": "Testing the full approve flow end to end.",
        "type": "feature_request",
        "submitted_by_email": USER_EMAIL,
    })
    assert r.status_code == 201
    issue_id = r.json()["id"]

    # Approve
    r = client.post(f"/api/issues/{issue_id}/approve", headers=pm)
    assert r.status_code == 200
    assert r.json().get("ok") is True

    # Verify via GET as PM
    r2 = client.get(f"/api/issues/{issue_id}", headers=pm)
    assert r2.json()["status"] == "approved"
    assert r2.json()["is_public"] is True

    # Anonymous can now see it
    r = client.get(f"/api/issues/{issue_id}")
    assert r.status_code == 200

    # Cleanup
    client.post(f"/api/issues/{issue_id}/reject", headers=pm)


def test_reject_flow(client, pm):
    r = client.post("/api/issues", json={
        "title": "[TEST] Reject flow",
        "description": "Testing the reject flow.",
        "type": "unclear",
        "submitted_by_email": USER_EMAIL,
    })
    assert r.status_code == 201
    issue_id = r.json()["id"]

    r = client.post(f"/api/issues/{issue_id}/reject", headers=pm)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    # Verify status via GET as PM
    r2 = client.get(f"/api/issues/{issue_id}", headers=pm)
    assert r2.json()["status"] == "rejected"


def test_non_pm_cannot_approve(client, user, created_issue):
    r = client.post(f"/api/issues/{created_issue['id']}/approve", headers=user)
    assert r.status_code == 403


# ── Vote ──────────────────────────────────────────────────────────────────────

def test_vote_on_approved_issue(client, pm):
    # Create + approve
    r = client.post("/api/issues", json={
        "title": "[TEST] Vote flow",
        "description": "Testing voting.",
        "type": "bug",
        "submitted_by_email": USER_EMAIL,
    })
    issue_id = r.json()["id"]
    client.post(f"/api/issues/{issue_id}/approve", headers=pm)

    # Vote
    r = client.post(f"/api/issues/{issue_id}/vote", json={
        "voter_email": USER_EMAIL,
        "vote_type": "up",
    })
    assert r.status_code == 200
    assert r.json()["upvotes"] >= 1

    # Voting again with same email is idempotent (upsert)
    r2 = client.post(f"/api/issues/{issue_id}/vote", json={
        "voter_email": USER_EMAIL,
        "vote_type": "up",
    })
    assert r2.status_code == 200
    assert r2.json()["upvotes"] == r.json()["upvotes"]

    # Cleanup
    client.post(f"/api/issues/{issue_id}/reject", headers=pm)
