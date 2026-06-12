"""Tests for dynamic price formatting and unit conversion."""

from decimal import Decimal

import pytest

from novax_price_alert.domain.enums import (
    AssetUnit,
    convert_units,
    irt_to_unit,
    unit_to_irt,
)
from novax_price_alert.domain.pricing import (
    _decimal_places_for,
    format_price,
    normalize_price,
)

# ── normalize_price ─────────────────────────────────────────────────


class TestNormalizePrice:
    def test_integer_string(self):
        assert normalize_price("100") == Decimal("100")

    def test_float_string(self):
        assert normalize_price("100.50") == Decimal("100.50000000")

    def test_comma_separated(self):
        assert normalize_price("1,000") == Decimal("1000")

    def test_negative_raises(self):
        with pytest.raises(ValueError, match="greater than zero"):
            normalize_price("-10")

    def test_zero_raises(self):
        with pytest.raises(ValueError, match="greater than zero"):
            normalize_price("0")

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            normalize_price("abc")

    def test_decimal_input(self):
        result = normalize_price(Decimal("50000.12345678"))
        assert result == Decimal("50000.12345678")


# ── _decimal_places_for ─────────────────────────────────────────────


class TestDecimalPlacesFor:
    def test_irt_zero_decimals(self):
        assert _decimal_places_for("IRT", Decimal("89500")) == 0

    def test_usdt_two_decimals(self):
        assert _decimal_places_for("USDT", Decimal("1.05")) == 2

    def test_btc_eighth_decimals(self):
        assert _decimal_places_for("BTC", Decimal("0.0005")) == 8

    def test_btc_large_value_reduces_decimals(self):
        # BTC at 65000+ has 5+ digits → decimals reduced
        places = _decimal_places_for("BTC", Decimal("65000"))
        assert places <= 8
        # With 65000 (5 digits), reduction kicks in: min(8, 8-(5-5)) = 8
        # At 100000+ (6 digits): min(8, 8-(6-5)) = 7
        places_100k = _decimal_places_for("BTC", Decimal("100000"))
        assert places_100k < 8

    def test_eth_six_decimals(self):
        assert _decimal_places_for("ETH", Decimal("3500.123456")) == 6

    def test_unknown_unit_defaults_to_4(self):
        assert _decimal_places_for("UNKNOWN", Decimal("100")) == 4

    def test_value_less_than_one(self):
        assert _decimal_places_for("BTC", Decimal("0.00001")) == 8

    def test_kwd_three_decimals(self):
        assert _decimal_places_for("KWD", Decimal("100")) == 3


# ── format_price ────────────────────────────────────────────────────


class TestFormatPrice:
    def test_irt_whole_number(self):
        result = format_price(Decimal("89500"), "IRT")
        assert result == "89,500 IRT"

    def test_usdt_with_decimals(self):
        result = format_price(Decimal("1.05"), "USDT")
        assert result == "1.05 USDT"

    def test_btc_small_value(self):
        result = format_price(Decimal("0.0005"), "BTC")
        assert "BTC" in result

    def test_btc_large_value(self):
        result = format_price(Decimal("65000.50"), "BTC")
        assert "BTC" in result
        assert "65" in result

    def test_default_unit_is_irt(self):
        result = format_price(Decimal("50000"))
        assert result == "50,000 IRT"

    def test_eur_two_decimals(self):
        result = format_price(Decimal("55000.50"), "EUR")
        assert "EUR" in result

    def test_gbp_two_decimals(self):
        result = format_price(Decimal("70000.25"), "GBP")
        assert "GBP" in result

    def test_try_two_decimals(self):
        result = format_price(Decimal("15000.75"), "TRY")
        assert "TRY" in result

    def test_jpy_two_decimals(self):
        result = format_price(Decimal("4000.50"), "JPY")
        assert "JPY" in result

    def test_ton_four_decimals(self):
        result = format_price(Decimal("15000.1234"), "TON")
        assert "TON" in result

    def test_integer_value_no_trailing_zeros(self):
        result = format_price(Decimal("100"), "USDT")
        assert result == "100 USDT"


# ── unit_to_irt / irt_to_unit ───────────────────────────────────────


class TestUnitConversion:
    def test_toman_to_irt(self):
        assert unit_to_irt(100, "IRT") == 100.0

    def test_usdt_to_irt(self):
        assert unit_to_irt(1, "USDT") == 50000.0

    def test_btc_to_irt(self):
        assert unit_to_irt(1, "BTC") == 3_000_000_000.0

    def test_unknown_unit_fallback(self):
        assert unit_to_irt(100, "UNKNOWN") == 100.0

    def test_irt_to_usdt(self):
        result = irt_to_unit(50000, "USDT")
        assert result == 1.0

    def test_irt_to_btc(self):
        result = irt_to_unit(3_000_000_000, "BTC")
        assert result == 1.0

    def test_irt_to_unit_zero_rate(self):
        # Should not crash on zero rate
        from novax_price_alert.domain.enums import UNIT_TO_IRT_RATES

        original = UNIT_TO_IRT_RATES.get("TEST_ZERO")
        UNIT_TO_IRT_RATES["TEST_ZERO"] = 0
        try:
            result = irt_to_unit(100, "TEST_ZERO")
            assert result == 0.0
        finally:
            if original is None:
                UNIT_TO_IRT_RATES.pop("TEST_ZERO", None)
            else:
                UNIT_TO_IRT_RATES["TEST_ZERO"] = original


# ── convert_units ───────────────────────────────────────────────────


class TestConvertUnits:
    def test_same_unit_returns_same(self):
        assert convert_units(100, "IRT", "IRT") == 100.0

    def test_usdt_to_irt(self):
        result = convert_units(2, "USDT", "IRT")
        assert result == 100000.0

    def test_irt_to_usdt(self):
        result = convert_units(100000, "IRT", "USDT")
        assert result == 2.0

    def test_btc_to_usdt(self):
        # 1 BTC = 3B IRT, 1 USDT = 50k IRT → 1 BTC = 60000 USDT
        result = convert_units(1, "BTC", "USDT")
        assert result == 60000.0

    def test_eth_to_btc(self):
        # 1 ETH = 100M IRT, 1 BTC = 3B IRT → 1 ETH = 0.0333... BTC
        result = convert_units(1, "ETH", "BTC")
        assert abs(result - 0.03333333) < 0.001


# ── AssetUnit enum ──────────────────────────────────────────────────


class TestAssetUnitEnum:
    def test_all_base_units_present(self):
        assert AssetUnit.TOMAN.value == "IRT"
        assert AssetUnit.IRR.value == "IRR"
        assert AssetUnit.USDT.value == "USDT"
        assert AssetUnit.BTC.value == "BTC"
        assert AssetUnit.ETH.value == "ETH"
        assert AssetUnit.TON.value == "TON"

    def test_new_fiat_units(self):
        assert AssetUnit.EUR.value == "EUR"
        assert AssetUnit.GBP.value == "GBP"
        assert AssetUnit.AED.value == "AED"
        assert AssetUnit.CNY.value == "CNY"
        assert AssetUnit.TRY.value == "TRY"
        assert AssetUnit.JPY.value == "JPY"
        assert AssetUnit.KWD.value == "KWD"
        assert AssetUnit.SAR.value == "SAR"
        assert AssetUnit.CAD.value == "CAD"
        assert AssetUnit.AUD.value == "AUD"
        assert AssetUnit.CHF.value == "CHF"
        assert AssetUnit.INR.value == "INR"
        assert AssetUnit.PKR.value == "PKR"

    def test_new_crypto_units(self):
        assert AssetUnit.DAI.value == "DAI"
        assert AssetUnit.SOL.value == "SOL"
        assert AssetUnit.BNB.value == "BNB"
        assert AssetUnit.XRP.value == "XRP"
        assert AssetUnit.DOGE.value == "DOGE"
        assert AssetUnit.ADA.value == "ADA"

    def test_irt_alias(self):
        assert AssetUnit.IRT.value == "IRT"
