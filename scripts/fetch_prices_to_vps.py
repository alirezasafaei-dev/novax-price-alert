#!/usr/bin/env python3
"""
Price Fetcher for Iranian VPS
Fetches prices from external APIs (Binance, TGJU, etc.) and sends to VPS
Designed to run on GitHub Actions to avoid IP blocking
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class PriceFetcher:
    def __init__(self):
        self.vps_api_url = os.getenv("VPS_API_URL")
        self.vps_api_token = os.getenv("VPS_API_TOKEN")
        self.enable_tgju = os.getenv("ENABLE_TGJU_FETCH", "").lower() == "true"
        self.enable_nobitex = os.getenv("ENABLE_NOBITEX_FETCH", "").lower() == "true"

        if not self.vps_api_url or not self.vps_api_token:
            raise ValueError("VPS_API_URL and VPS_API_TOKEN must be set")

    async def fetch_binance_prices(self) -> List[Dict]:
        """Fetch crypto prices, preferring Binance-compatible endpoints."""
        symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT"]
        candidate_urls = [
            "https://api.binance.com/api/v3/ticker/price",
            "https://api-gcp.binance.com/api/v3/ticker/price",
            "https://data-api.binance.vision/api/v3/ticker/price",
        ]

        async with httpx.AsyncClient(timeout=30.0) as client:
            for url in candidate_urls:
                try:
                    response = await client.get(
                        url, params={"symbols": str(symbols).replace("'", '"')}
                    )
                    response.raise_for_status()
                    return self._normalize_binance_prices(response.json())
                except Exception as exc:
                    logger.warning("Binance endpoint failed: %s (%s)", url, exc)

            logger.warning("Falling back to CoinGecko for crypto prices")
            response = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": "bitcoin,ethereum,binancecoin",
                    "vs_currencies": "usd",
                },
            )
            response.raise_for_status()
            payload = response.json()
            symbol_map = {
                "bitcoin": "BTC",
                "ethereum": "ETH",
                "binancecoin": "BNB",
            }
            now = datetime.utcnow().isoformat()
            return [
                {
                    "asset_code": f"{symbol}_USDT",
                    "asset_name": self._get_asset_name(symbol),
                    "price_value": float(payload[coin]["usd"]),
                    "currency_code": "USDT",
                    "display_unit": "USDT",
                    "provider": "coingecko_fallback",
                    "fetched_at": now,
                }
                for coin, symbol in symbol_map.items()
                if coin in payload and "usd" in payload[coin]
            ]

    def _normalize_binance_prices(self, items: List[Dict]) -> List[Dict]:
        prices = []
        now = datetime.utcnow().isoformat()
        for item in items:
            base_quote = item["symbol"]
            if base_quote.endswith("USDT"):
                base = base_quote[:-5]
                prices.append(
                    {
                        "asset_code": f"{base}_USDT",
                        "asset_name": self._get_asset_name(base),
                        "price_value": float(item["price"]),
                        "currency_code": "USDT",
                        "display_unit": "USDT",
                        "provider": "binance",
                        "fetched_at": now,
                    }
                )
        return prices

    async def fetch_tgju_prices(self) -> List[Dict]:
        """Fetch Iranian market prices from TGJU"""
        raise RuntimeError("TGJU external fetch is disabled until a real parser is implemented")

    async def fetch_nobitex_prices(self) -> List[Dict]:
        """Fetch prices from Nobitex (Iranian exchange)"""
        url = "https://api.nobitex.ir/market/depth"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json={"srcCurrency": "btc", "dstCurrency": "rls"})
            response.raise_for_status()
            data = response.json()

            if data.get("status") == "ok":
                best_bid = float(data.get("bids", [[0]])[0][0]) if data.get("bids") else 0
                return [
                    {
                        "asset_code": "BTC_IRT",
                        "asset_name": "Bitcoin",
                        "price_value": best_bid,
                        "currency_code": "IRT",
                        "display_unit": "IRT",
                        "provider": "nobitex",
                        "fetched_at": datetime.utcnow().isoformat(),
                    }
                ]

            return []

    def _get_asset_name(self, code: str) -> str:
        """Get human-readable asset name"""
        names = {"BTC": "Bitcoin", "ETH": "Ethereum", "BNB": "Binance Coin", "ADA": "Cardano"}
        return names.get(code, code)

    async def send_to_vps(self, prices: List[Dict]) -> bool:
        """Send fetched prices to VPS"""
        if not prices:
            logger.warning("No prices to send")
            return False

        url = f"{self.vps_api_url}/api/v1/prices/ingest"
        headers = {
            "Authorization": f"Bearer {self.vps_api_token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(url, json={"items": prices}, headers=headers)
                response.raise_for_status()
                logger.info(f"Successfully sent {len(prices)} prices to VPS")
                return True
            except httpx.HTTPError as e:
                logger.error(f"Failed to send prices to VPS: {e}")
                return False

    async def run(self):
        """Main fetch and send loop"""
        logger.info("Starting price fetch...")

        all_prices = []

        try:
            # Fetch from different sources
            try:
                binance_prices = await self.fetch_binance_prices()
                all_prices.extend(binance_prices)
                logger.info(f"Fetched {len(binance_prices)} prices from Binance")
            except Exception as exc:
                logger.warning(f"Crypto fetch failed: {exc}")

            if self.enable_tgju:
                try:
                    tgju_prices = await self.fetch_tgju_prices()
                    all_prices.extend(tgju_prices)
                    logger.info(f"Fetched {len(tgju_prices)} prices from TGJU")
                except Exception as exc:
                    logger.warning(f"TGJU fetch failed: {exc}")
            else:
                logger.info(
                    "Skipping TGJU external fetch; VPS-local provider remains source of truth"
                )

            if self.enable_nobitex:
                try:
                    nobitex_prices = await self.fetch_nobitex_prices()
                    all_prices.extend(nobitex_prices)
                    logger.info(f"Fetched {len(nobitex_prices)} prices from Nobitex")
                except Exception as exc:
                    logger.warning(f"Nobitex fetch failed: {exc}")
            else:
                logger.info(
                    "Skipping Nobitex external fetch; only crypto is ingested from GitHub Actions"
                )

            # Send to VPS
            if all_prices:
                success = await self.send_to_vps(all_prices)
                if success:
                    logger.info("Price fetch completed successfully")
                    return 0
                else:
                    logger.error("Failed to send prices to VPS")
                    return 1
            else:
                logger.warning("No prices fetched from any source")
                return 1

        except Exception as e:
            logger.error(f"Error during price fetch: {e}")
            return 1


async def main():
    fetcher = PriceFetcher()
    return await fetcher.run()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
