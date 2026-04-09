"""
E2E tests for the Knowledge Base API.
"""
import pytest
from conftest import PM_EMAIL, USER_EMAIL


def test_kb_list(client, pm):
    r = client.get("/api/kb", headers=pm)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_kb_create_and_delete(client, pm):
    # Create
    r = client.post("/api/kb", headers=pm, json={
        "title": "[TEST] KB Entry",
        "content": "This is a test knowledge base entry.",
    })
    assert r.status_code == 201, r.text
    entry = r.json()
    assert entry["title"] == "[TEST] KB Entry"
    assert entry["source_type"] == "manual"

    # Appears in list
    r = client.get("/api/kb", headers=pm)
    ids = [e["id"] for e in r.json()]
    assert entry["id"] in ids

    # Delete
    r = client.delete(f"/api/kb/{entry['id']}", headers=pm)
    assert r.status_code in (200, 204)

    # Gone from list
    r = client.get("/api/kb", headers=pm)
    ids = [e["id"] for e in r.json()]
    assert entry["id"] not in ids


def test_kb_create_requires_pm(client, user):
    r = client.post("/api/kb", headers=user, json={
        "title": "Unauthorized entry",
        "content": "Should fail.",
    })
    assert r.status_code == 403
