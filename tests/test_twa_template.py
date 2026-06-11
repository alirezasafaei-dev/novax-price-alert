from novax_price_alert.api.templates import TWA_SHELL_HTML


def test_twa_alert_activation_uses_create_then_confirm_flow() -> None:
    assert "confirm:true" not in TWA_SHELL_HTML
    assert 'await api("/api/v1/alerts",{method:"POST"' in TWA_SHELL_HTML
    assert 'await api(`/api/v1/alerts/${created.id}/confirm`,{method:"POST"});' in TWA_SHELL_HTML


def test_twa_template_escapes_api_rendered_values() -> None:
    assert "function escapeHtml(value)" in TWA_SHELL_HTML
    assert "${escapeHtml(x.asset_name)}" in TWA_SHELL_HTML
    assert "${escapeHtml(assetLabel(a))}" in TWA_SHELL_HTML
    assert "button[data-alert-id]" in TWA_SHELL_HTML


def test_twa_template_does_not_depend_on_browser_id_globals() -> None:
    assert 'const nextAsset = document.getElementById("next-asset");' in TWA_SHELL_HTML
    assert 'const prices = document.getElementById("prices");' in TWA_SHELL_HTML
    assert 'const alerts = document.getElementById("alerts");' in TWA_SHELL_HTML


def test_twa_template_exposes_price_history_panel() -> None:
    assert 'id="history-card"' in TWA_SHELL_HTML
    assert 'data-history-asset="${escapeHtml(x.asset_code)}"' in TWA_SHELL_HTML
    assert "async function loadHistory(assetCode)" in TWA_SHELL_HTML
    assert "/api/v1/prices/history?asset_code=" in TWA_SHELL_HTML
    # close logic present (may be in template literal)
    assert 'historyCard.classList.add("hidden")' in TWA_SHELL_HTML


def test_twa_template_supports_alert_target_edit() -> None:
    assert 'data-edit-alert-id="${escapeHtml(a.id)}"' in TWA_SHELL_HTML
    assert "async function editAlertTarget(id,currentTarget,unit)" in TWA_SHELL_HTML
    assert 'method:"PATCH"' in TWA_SHELL_HTML
    assert "JSON.stringify({target_price:val})" in TWA_SHELL_HTML
