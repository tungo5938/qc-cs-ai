import pytest
import httpx

BASE_URL = "http://localhost:8000"
PM_EMAIL = "tunm1@ghn.vn"        # from PM_QC_EMAILS in .env
USER_EMAIL = "tester@ghn.vn"     # regular GHN user


@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=60) as c:
        yield c


@pytest.fixture
def pm(client):
    """Headers for a PM/QC admin user."""
    return {"x-user-email": PM_EMAIL}


@pytest.fixture
def user(client):
    """Headers for a regular GHN user."""
    return {"x-user-email": USER_EMAIL}


@pytest.fixture
def created_issue(client, pm):
    """Creates a test issue and cleans it up afterward."""
    r = client.post("/api/issues", json={
        "title": "[TEST] Auto-created issue",
        "description": "This issue was created by the test suite.",
        "type": "bug",
        "submitted_by_email": USER_EMAIL,
    })
    assert r.status_code == 201, r.text
    issue = r.json()
    yield issue
    # Cleanup: reject so it doesn't pollute the queue
    client.post(f"/api/issues/{issue['id']}/reject", headers=pm)
