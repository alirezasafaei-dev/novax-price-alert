from novax_price_alert.infra.providers.registry import ProviderRegistry


def test_provider_registry_skips_providers_without_required_credentials(
    monkeypatch,
) -> None:
    monkeypatch.setattr("novax_price_alert.infra.providers.registry.settings.nerkh_api_key", "")
    monkeypatch.setattr(
        "novax_price_alert.infra.providers.registry.settings.nerkh_base_url", "https://api.nerkh.io"
    )
    monkeypatch.setattr(
        "novax_price_alert.infra.providers.registry.settings.tgju_base_url", "https://www.tgju.org"
    )
    monkeypatch.setattr(
        "novax_price_alert.infra.providers.registry.settings.alanchand_api_token", ""
    )
    monkeypatch.setattr(
        "novax_price_alert.infra.providers.registry.settings.alanchand_base_url",
        "https://api.alanchand.com",
    )
    monkeypatch.setattr("novax_price_alert.infra.providers.registry.settings.api_ir_api_key", "")
    monkeypatch.setattr("novax_price_alert.infra.providers.registry.settings.api_ir_base_url", "")
    monkeypatch.setattr(
        "novax_price_alert.infra.providers.registry.settings.bonbast_base_url",
        "https://bonbast.com",
    )
    monkeypatch.setattr(
        "novax_price_alert.infra.providers.registry.settings.enable_bonbast_failover", False
    )
    monkeypatch.setattr(
        "novax_price_alert.infra.providers.registry.settings.use_mock_provider", False
    )

    registry = ProviderRegistry()

    assert [provider.slug for provider in registry.ordered()] == ["tgju_scrape"]
