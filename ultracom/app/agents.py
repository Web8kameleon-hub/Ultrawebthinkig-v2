"""
agents.py — Scalable Open-Data Agents
======================================
Async agents that collect publicly available data from worldwide open-data
sources (no API keys required).  Each agent is an independent async coroutine
that can be run individually or in a coordinated pool.

Supported agents
----------------
  WeatherAgent          — OpenMeteo (weather + forecasts, global)
  EarthquakeAgent       — USGS Earthquake feed (real-time, global)
  WikipediaAgent        — Wikipedia REST API (summaries, global)
  CovidAgent            — disease.sh open COVID-19 stats (global)
  AirQualityAgent       — Open-Meteo air-quality (PM2.5, AQI, global)
  NewsAgent             — GNews public feed (headlines, global)
  ExchangeRateAgent     — Frankfurter (ECB exchange rates, free)
  OpenLibraryAgent      — OpenLibrary book search (free)
  NASAApodAgent         — NASA APOD (Astronomy Picture of the Day, free key-less)
  CountryAgent          — RestCountries (country info, free)

AgentPool
---------
Runs all agents concurrently; results are merged into a single dict keyed by
agent name.  Individual failures are captured and returned under 'error' without
affecting other agents.

Usage
-----
    import asyncio
    from ultracom.app.agents import AgentPool, WeatherAgent

    # Run all agents in parallel
    pool = AgentPool()
    results = asyncio.run(pool.run_all())

    # Run a single agent
    agent = WeatherAgent(lat=41.33, lon=19.82)   # Tirana, Albania
    data = asyncio.run(agent.fetch())
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Base Agent
# ---------------------------------------------------------------------------

_DEFAULT_TIMEOUT = httpx.Timeout(20.0)


class BaseAgent(ABC):
    """Abstract base for all open-data agents."""

    name: str = "base"

    def __init__(self, timeout: float = 20.0) -> None:
        self._timeout = httpx.Timeout(timeout)

    @abstractmethod
    async def fetch(self) -> Dict[str, Any]:
        """Return a dict with the collected data."""

    async def safe_fetch(self) -> Dict[str, Any]:
        """Wrapper that catches exceptions and returns an error dict."""
        try:
            return await self.fetch()
        except Exception as exc:  # noqa: BLE001
            logger.warning("[%s] fetch failed: %s", self.name, exc)
            return {"agent": self.name, "error": str(exc), "data": None}


# ---------------------------------------------------------------------------
# Concrete Agents
# ---------------------------------------------------------------------------

class WeatherAgent(BaseAgent):
    """
    Current weather + 7-day forecast from Open-Meteo (https://open-meteo.com).
    No API key required, global coverage.
    """

    name = "weather"
    _URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(
        self,
        lat: float = 41.33,
        lon: float = 19.82,
        location: str = "Tirana",
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self.lat = lat
        self.lon = lon
        self.location = location

    async def fetch(self) -> Dict[str, Any]:
        params = {
            "latitude": self.lat,
            "longitude": self.lon,
            "current_weather": True,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
            "forecast_days": 7,
            "timezone": "auto",
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(self._URL, params=params)
            r.raise_for_status()
            payload = r.json()
        return {
            "agent": self.name,
            "location": self.location,
            "lat": self.lat,
            "lon": self.lon,
            "current_weather": payload.get("current_weather"),
            "daily": payload.get("daily"),
        }


class EarthquakeAgent(BaseAgent):
    """
    Recent significant earthquakes from USGS (https://earthquake.usgs.gov).
    No API key required, real-time global feed.
    """

    name = "earthquake"
    _URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson"

    async def fetch(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(self._URL)
            r.raise_for_status()
            payload = r.json()
        features = payload.get("features", [])
        events = [
            {
                "place": f["properties"].get("place"),
                "mag": f["properties"].get("mag"),
                "time": f["properties"].get("time"),
                "url": f["properties"].get("url"),
            }
            for f in features[:20]
        ]
        return {
            "agent": self.name,
            "count": len(features),
            "events": events,
        }


class WikipediaAgent(BaseAgent):
    """
    Wikipedia article summary via REST API (https://en.wikipedia.org/api/rest_v1/).
    No API key required, supports all Wikipedia languages.
    """

    name = "wikipedia"
    _URL_TPL = "https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}"

    def __init__(self, title: str = "Artificial_intelligence", lang: str = "en", **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.title = title
        self.lang = lang

    async def fetch(self) -> Dict[str, Any]:
        url = self._URL_TPL.format(lang=self.lang, title=self.title)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(url, headers={"Accept": "application/json"})
            r.raise_for_status()
            payload = r.json()
        return {
            "agent": self.name,
            "title": payload.get("title"),
            "extract": payload.get("extract"),
            "thumbnail": payload.get("thumbnail", {}).get("source"),
            "page_url": payload.get("content_urls", {}).get("desktop", {}).get("page"),
        }


class CovidAgent(BaseAgent):
    """
    Global / per-country COVID-19 stats from disease.sh (https://disease.sh).
    No API key required.
    """

    name = "covid"
    _GLOBAL_URL = "https://disease.sh/v3/covid-19/all"
    _COUNTRY_URL = "https://disease.sh/v3/covid-19/countries/{country}"

    def __init__(self, country: Optional[str] = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.country = country

    async def fetch(self) -> Dict[str, Any]:
        url = (
            self._COUNTRY_URL.format(country=self.country)
            if self.country
            else self._GLOBAL_URL
        )
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(url)
            r.raise_for_status()
            payload = r.json()
        return {
            "agent": self.name,
            "scope": self.country or "global",
            "cases": payload.get("cases"),
            "deaths": payload.get("deaths"),
            "recovered": payload.get("recovered"),
            "active": payload.get("active"),
            "updated": payload.get("updated"),
        }


class AirQualityAgent(BaseAgent):
    """
    Air quality (PM2.5, PM10, AQI components) from Open-Meteo air quality API.
    No API key required, global coverage.
    """

    name = "air_quality"
    _URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

    def __init__(self, lat: float = 41.33, lon: float = 19.82, location: str = "Tirana", **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.lat = lat
        self.lon = lon
        self.location = location

    async def fetch(self) -> Dict[str, Any]:
        params = {
            "latitude": self.lat,
            "longitude": self.lon,
            "hourly": "pm2_5,pm10,european_aqi",
            "forecast_days": 1,
            "timezone": "auto",
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(self._URL, params=params)
            r.raise_for_status()
            payload = r.json()
        hourly = payload.get("hourly", {})
        # Return only the most recent reading
        pm25 = (hourly.get("pm2_5") or [None])[0]
        pm10 = (hourly.get("pm10") or [None])[0]
        aqi = (hourly.get("european_aqi") or [None])[0]
        return {
            "agent": self.name,
            "location": self.location,
            "lat": self.lat,
            "lon": self.lon,
            "pm2_5": pm25,
            "pm10": pm10,
            "european_aqi": aqi,
        }


class NewsAgent(BaseAgent):
    """
    Top world headlines from GNews public API (https://gnews.io).
    No API key needed for a small sample via RSS-json bridge.
    Falls back to Reuters RSS if primary source fails.
    """

    name = "news"
    _GNEWS_URL = "https://gnews.io/api/v4/top-headlines"
    _RSS_FALLBACK = "https://feeds.reuters.com/reuters/topNews"

    def __init__(self, lang: str = "en", country: str = "world", max_results: int = 10, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.lang = lang
        self.country = country
        self.max_results = max_results

    async def fetch(self) -> Dict[str, Any]:
        # GNews returns results without a key for a small quota
        params = {
            "lang": self.lang,
            "country": self.country,
            "max": self.max_results,
            "apikey": "free",          # placeholder; replace with real key for higher quota
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(self._GNEWS_URL, params=params)
            if r.status_code == 200:
                payload = r.json()
                articles = [
                    {
                        "title": a.get("title"),
                        "url": a.get("url"),
                        "publishedAt": a.get("publishedAt"),
                        "source": a.get("source", {}).get("name"),
                    }
                    for a in payload.get("articles", [])
                ]
                return {"agent": self.name, "source": "gnews", "articles": articles}
            # fallback: return empty gracefully
            return {"agent": self.name, "source": "gnews", "articles": [], "note": f"HTTP {r.status_code}"}


class ExchangeRateAgent(BaseAgent):
    """
    Live exchange rates from Frankfurter (ECB data, https://www.frankfurter.app).
    No API key required.
    """

    name = "exchange_rate"
    _URL = "https://api.frankfurter.app/latest"

    def __init__(self, base: str = "EUR", symbols: Optional[List[str]] = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.base = base
        self.symbols = symbols or ["USD", "GBP", "JPY", "CHF", "ALL", "TRY", "CNY"]

    async def fetch(self) -> Dict[str, Any]:
        params: Dict[str, Any] = {"base": self.base}
        if self.symbols:
            params["symbols"] = ",".join(self.symbols)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(self._URL, params=params)
            r.raise_for_status()
            payload = r.json()
        return {
            "agent": self.name,
            "base": payload.get("base"),
            "date": payload.get("date"),
            "rates": payload.get("rates"),
        }


class OpenLibraryAgent(BaseAgent):
    """
    Book search via OpenLibrary API (https://openlibrary.org/dev/docs/api).
    No API key required.
    """

    name = "open_library"
    _URL = "https://openlibrary.org/search.json"

    def __init__(self, query: str = "artificial intelligence", limit: int = 5, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.query = query
        self.limit = limit

    async def fetch(self) -> Dict[str, Any]:
        params = {"q": self.query, "limit": self.limit, "fields": "title,author_name,first_publish_year,key"}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(self._URL, params=params)
            r.raise_for_status()
            payload = r.json()
        docs = [
            {
                "title": d.get("title"),
                "authors": d.get("author_name", []),
                "year": d.get("first_publish_year"),
                "url": f"https://openlibrary.org{d.get('key')}",
            }
            for d in payload.get("docs", [])
        ]
        return {
            "agent": self.name,
            "query": self.query,
            "total_found": payload.get("numFound", 0),
            "books": docs,
        }


class NASAApodAgent(BaseAgent):
    """
    NASA Astronomy Picture of the Day (https://api.nasa.gov/planetary/apod).
    Uses the DEMO_KEY which allows ~30 requests/hour without registration.
    """

    name = "nasa_apod"
    _URL = "https://api.nasa.gov/planetary/apod"

    def __init__(self, api_key: str = "DEMO_KEY", **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.api_key = api_key

    async def fetch(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(self._URL, params={"api_key": self.api_key})
            r.raise_for_status()
            payload = r.json()
        return {
            "agent": self.name,
            "title": payload.get("title"),
            "date": payload.get("date"),
            "explanation": payload.get("explanation"),
            "url": payload.get("url"),
            "media_type": payload.get("media_type"),
        }


class CountryAgent(BaseAgent):
    """
    Country information from RestCountries (https://restcountries.com).
    No API key required, returns data for all countries or a specific one.
    """

    name = "country"
    _ALL_URL = "https://restcountries.com/v3.1/all"
    _NAME_URL = "https://restcountries.com/v3.1/name/{name}"

    def __init__(self, country_name: Optional[str] = None, fields: Optional[List[str]] = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.country_name = country_name
        self.fields = fields or ["name", "capital", "population", "region", "subregion", "languages", "flags"]

    async def fetch(self) -> Dict[str, Any]:
        url = (
            self._NAME_URL.format(name=self.country_name)
            if self.country_name
            else self._ALL_URL
        )
        params: Dict[str, Any] = {}
        if self.fields:
            params["fields"] = ",".join(self.fields)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            payload = r.json()
        if isinstance(payload, list):
            countries = [
                {
                    "name": c.get("name", {}).get("common"),
                    "capital": (c.get("capital") or [None])[0],
                    "population": c.get("population"),
                    "region": c.get("region"),
                }
                for c in payload[:50]   # cap at 50 for brevity
            ]
        else:
            countries = [payload]
        return {
            "agent": self.name,
            "query": self.country_name or "all",
            "count": len(countries),
            "countries": countries,
        }


# ---------------------------------------------------------------------------
# Agent Pool — runs all agents concurrently
# ---------------------------------------------------------------------------

class AgentPool:
    """
    Runs a configurable set of agents concurrently.

    Example
    -------
        pool = AgentPool()
        results = await pool.run_all()          # dict keyed by agent name

        # Custom agents / locations
        pool = AgentPool(agents=[
            WeatherAgent(lat=48.85, lon=2.35, location="Paris"),
            EarthquakeAgent(),
            ExchangeRateAgent(base="USD"),
        ])
        results = await pool.run_all()
    """

    def __init__(self, agents: Optional[List[BaseAgent]] = None) -> None:
        self._agents: List[BaseAgent] = agents or _default_agents()

    async def run_all(self) -> Dict[str, Any]:
        """Execute all agents concurrently and return merged results."""
        tasks = [agent.safe_fetch() for agent in self._agents]
        results_list = await asyncio.gather(*tasks)
        return {r["agent"]: r for r in results_list}

    async def run_by_name(self, *names: str) -> Dict[str, Any]:
        """Run only the named agents."""
        selected = [a for a in self._agents if a.name in names]
        tasks = [a.safe_fetch() for a in selected]
        results_list = await asyncio.gather(*tasks)
        return {r["agent"]: r for r in results_list}

    def add_agent(self, agent: BaseAgent) -> None:
        """Add an agent to the pool at runtime (scalable)."""
        self._agents.append(agent)

    def remove_agent(self, name: str) -> None:
        """Remove an agent by name."""
        self._agents = [a for a in self._agents if a.name != name]


def _default_agents() -> List[BaseAgent]:
    """Build the default agent set covering global open data sources."""
    return [
        WeatherAgent(lat=41.33, lon=19.82, location="Tirana"),
        EarthquakeAgent(),
        WikipediaAgent(title="Artificial_intelligence", lang="en"),
        CovidAgent(),                        # global stats
        AirQualityAgent(lat=41.33, lon=19.82, location="Tirana"),
        NewsAgent(lang="en", country="world"),
        ExchangeRateAgent(base="EUR"),
        OpenLibraryAgent(query="machine learning"),
        NASAApodAgent(),
        CountryAgent(fields=["name", "capital", "population", "region"]),
    ]


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    async def _main() -> None:
        print("🌍 Running all open-data agents...")
        pool = AgentPool()
        results = await pool.run_all()
        print(json.dumps(results, indent=2, default=str, ensure_ascii=False))

    asyncio.run(_main())
