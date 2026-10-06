def test_health_check(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["status"] == "online"


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    json_data = response.json()
    assert "version" in json_data
    assert json_data["docs"] == "/docs"
