"""Tests for the scoring system: user/PO/effort ratings, config."""
import pytest


def test_scoring_config_accessible(client, pm):
    r = client.get("/api/scoring/config", headers=pm)
    assert r.status_code == 200
    cfg = r.json()
    assert "user_rating_weight" in cfg
    assert "po_rating_weight" in cfg
    assert "csat_weight" in cfg
    assert "effort_weight" in cfg
    assert "threshold_medium" in cfg
    assert "threshold_high" in cfg
    assert "threshold_critical" in cfg
    assert "po_emails" in cfg
    assert "team_raters" in cfg


def test_scoring_config_requires_pm(client, user):
    r = client.get("/api/scoring/config", headers=user)
    assert r.status_code == 403


def test_po_rate_rejects_non_po(client, created_issue):
    r = client.post(f"/api/scoring/{created_issue['id']}/po-rate", json={
        "rating": 8,
        "po_email": "notapo@ghn.vn",
    })
    assert r.status_code == 403


def test_po_rate_valid(client, pm, created_issue):
    # First approve so issue exists properly
    client.post(f"/api/issues/{created_issue['id']}/approve", headers=pm)

    r = client.post(f"/api/scoring/{created_issue['id']}/po-rate", json={
        "rating": 7,
        "po_email": "tunm1@ghn.vn",  # default PO from migration
    })
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "composite_score" in data
    assert "priority" in data


def test_effort_requires_pm(client, user, created_issue):
    r = client.post(
        f"/api/scoring/{created_issue['id']}/effort",
        json={"effort": 3, "set_by_email": "user@ghn.vn"},
        headers=user,
    )
    assert r.status_code == 403


def test_effort_valid(client, pm, created_issue):
    r = client.post(
        f"/api/scoring/{created_issue['id']}/effort",
        json={"effort": 3, "set_by_email": "tunm1@ghn.vn"},
        headers=pm,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["composite_score"] is not None


def test_effort_validates_range(client, pm, created_issue):
    r = client.post(
        f"/api/scoring/{created_issue['id']}/effort",
        json={"effort": 11, "set_by_email": "tunm1@ghn.vn"},
        headers=pm,
    )
    assert r.status_code == 422


def test_update_team_rater(client, pm):
    r = client.put("/api/scoring/config/team-raters", headers=pm, json={
        "team": "cs_b2c",
        "rater_email": "rater_b2c@ghn.vn",
    })
    assert r.status_code == 200
    # Verify it's reflected in config
    cfg = client.get("/api/scoring/config", headers=pm).json()
    assert cfg["team_raters"].get("cs_b2c") == "rater_b2c@ghn.vn"


def test_user_rate_wrong_rater(client, created_issue):
    """After setting team rater, a different email should be rejected."""
    # Requires the team rater set in test_update_team_rater (session-scoped client so order matters)
    issue = client.get(f"/api/issues/{created_issue['id']}",
                       headers={"x-user-email": "tunm1@ghn.vn"}).json()
    # Only fails if issue.team == cs_b2c AND a rater is configured
    if issue.get("team") == "cs_b2c":
        r = client.post(f"/api/scoring/{created_issue['id']}/user-rate", json={
            "rating": 5,
            "rater_email": "wrong@ghn.vn",
        })
        assert r.status_code == 403


def test_recalculate_csat_requires_pm(client, user, created_issue):
    r = client.post(
        f"/api/scoring/{created_issue['id']}/recalculate-csat",
        headers=user,
    )
    assert r.status_code == 403


def test_recalculate_csat_valid(client, pm, created_issue):
    r = client.post(
        f"/api/scoring/{created_issue['id']}/recalculate-csat",
        headers=pm,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "csat_score" in data
    assert "composite_score" in data


def test_issue_has_scoring_fields(client, pm, created_issue):
    issue = client.get(
        f"/api/issues/{created_issue['id']}",
        headers=pm,
    ).json()
    for field in ["user_rating", "po_rating", "tech_effort", "csat_score", "composite_score"]:
        assert field in issue, f"Missing field: {field}"
