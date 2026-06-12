import pytest
from fastapi.testclient import TestClient

from novax_price_alert.api.main import create_app
from novax_price_alert.core.observability import metrics, record_metric
from novax_price_alert.core.settings import settings

pytestmark = pytest.mark.integration


def test_metrics_endpoint_returns_observability_counters() -> None:
    metrics.clear()
    record_metric("alert_creation_count")
    record_metric("alert_creation_count")
    record_metric("notification_send_succeeded_count")

    client = TestClient(create_app())
    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.json() == {
        "metrics": {
            "alert_creation_count": 2,
            "notification_send_succeeded_count": 1,
        }
    }


def test_metrics_endpoint_requires_configured_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "metrics_access_token", "secret-token")
    TestClient(create_app())


def test_track_and_prometheus() -> None:
    client = TestClient(create_app())
    r1 = client.post("/metrics/track", json={"event": "test_click"})
    assert r1.status_code == 200
    r2 = client.get("/metrics/prometheus")
    assert r2.status_code == 200
    assert "novax_twa_test_click" in r2.text


def test_manifest() -> None:
    client = TestClient(create_app())
    r = client.get("/manifest.json")
    assert r.status_code == 200
    assert r.json()["name"] == "Novax"


def test_metrics_token_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "metrics_access_token", "secret-token")
    client = TestClient(create_app())
    missing_token = client.get("/metrics")
    wrong_token = client.get("/metrics", headers={"X-Metrics-Token": "wrong"})
    valid_token = client.get("/metrics", headers={"X-Metrics-Token": "secret-token"})

    assert missing_token.status_code == 401
    assert wrong_token.status_code == 401
    assert valid_token.status_code == 200


def test_metrics_endpoint_requires_token_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "metrics_access_token", "")
    client = TestClient(create_app())

    response = client.get("/metrics")

    assert response.status_code == 401
