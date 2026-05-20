from fastapi.testclient import TestClient

from bale_price_alert.main import app

client = TestClient(app)

def test_webhook_handler_start_command():
    payload = {
        "message": {
            "text": "/start",
            "from": {"id": "123456"}
        }
    }
    # دقت کن که در روتر، prefix را "/bot" تعریف کردی
    response = client.post("/bot/webhook", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["handled"] is True
    assert data["command"] == "/start"
