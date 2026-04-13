import httpx, pytest
BASE_URL = "http://localhost:8000"
PM = "tunm1@ghn.vn"


@pytest.fixture
def solution_id(client):
    """Reuse first available solution, or skip if none."""
    r = client.get("/api/solutions", headers={"x-user-email": PM})
    items = r.json()
    if not items:
        pytest.skip("No solutions in DB")
    return items[0]["id"]


def test_patch_canvas_saves_tldraw_data(client, solution_id):
    payload = {"tldraw_data": {"shapes": [{"id": "shape1", "type": "geo"}]}}
    r = client.patch(f"/api/solutions/{solution_id}/canvas",
                     json=payload, headers={"x-user-email": PM})
    assert r.status_code == 200
    assert r.json()["tldraw_data"]["shapes"][0]["id"] == "shape1"


def test_patch_prd_saves_content(client, solution_id):
    payload = {"prd_content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello PRD"}]}]}}
    r = client.patch(f"/api/solutions/{solution_id}/prd",
                     json=payload, headers={"x-user-email": PM})
    assert r.status_code == 200
    assert r.json()["prd_content"]["type"] == "doc"
