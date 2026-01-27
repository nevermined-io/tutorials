"""
Weather service: geocoding and current forecast using Open-Meteo.

This module provides functions to get weather data using the free Open-Meteo API.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import httpx


@dataclass
class TodayWeather:
    """Today's weather data."""

    city: str
    country: Optional[str]
    latitude: float
    longitude: float
    timezone: str
    updated_at: str
    tmax_c: Optional[float]
    tmin_c: Optional[float]
    precipitation_mm: Optional[float]
    weather_code: Optional[int]
    weather_text: Optional[str]


class CityNotFoundError(Exception):
    """Raised when a city cannot be found."""

    def __init__(self, city: str):
        self.city = city
        super().__init__(f"City not found: {city}")


class DownstreamError(Exception):
    """Raised when an external API call fails."""

    pass


def sanitize_city(raw_city: str) -> str:
    """
    Sanitize and validate city name.

    Args:
        raw_city: Raw city name input.

    Returns:
        Sanitized city name.

    Raises:
        ValueError: If city name is invalid.
    """
    trimmed = raw_city.strip()
    if len(trimmed) < 2 or len(trimmed) > 80:
        raise ValueError("City must be between 2 and 80 characters long")
    return trimmed


async def geocode_city(city: str) -> dict:
    """
    Geocode a city name to coordinates using Open-Meteo.

    Args:
        city: City name to geocode.

    Returns:
        Dict with name, country, latitude, longitude, timezone.

    Raises:
        CityNotFoundError: If the city is not found.
        DownstreamError: If the API call fails.
    """
    sanitized = sanitize_city(city)

    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": sanitized, "count": "1", "language": "en"}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
        except Exception as e:
            raise DownstreamError(f"Failed to reach Open-Meteo geocoding API: {e}")

        if response.status_code != 200:
            raise DownstreamError(
                f"Geocoding API returned HTTP {response.status_code}"
            )

        data = response.json()

    if not data or not isinstance(data.get("results"), list) or len(data["results"]) == 0:
        raise CityNotFoundError(sanitized)

    first = data["results"][0]
    return {
        "name": str(first["name"]),
        "country": str(first["country"]) if first.get("country") else None,
        "latitude": float(first["latitude"]),
        "longitude": float(first["longitude"]),
        "timezone": str(first["timezone"]) if first.get("timezone") else None,
    }


def weather_code_to_text(code: Optional[int]) -> Optional[str]:
    """
    Convert Open-Meteo weather code to human-readable text.

    Args:
        code: Weather code from Open-Meteo API.

    Returns:
        Human-readable weather description or None.
    """
    if code is None:
        return None

    mapping = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }
    return mapping.get(code, "Unknown")


async def get_today_weather(city: str) -> TodayWeather:
    """
    Get today's weather for a city.

    Args:
        city: City name.

    Returns:
        TodayWeather object with current weather data.

    Raises:
        CityNotFoundError: If the city is not found.
        DownstreamError: If the API call fails.
    """
    import time

    geo = await geocode_city(city)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": str(geo["latitude"]),
        "longitude": str(geo["longitude"]),
        "current_weather": "true",
        "timezone": "auto",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
    }

    start = time.time()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
        except Exception as e:
            raise DownstreamError(f"Failed to reach Open-Meteo forecast API: {e}")

    latency_ms = int((time.time() - start) * 1000)
    print(f"[open-meteo] forecast latency {latency_ms}ms for {geo['name']}")

    if response.status_code != 200:
        raise DownstreamError(f"Forecast API returned HTTP {response.status_code}")

    data = response.json()

    tz = data.get("timezone") or geo.get("timezone") or "unknown"
    daily = data.get("daily", {})

    tmax = None
    if isinstance(daily.get("temperature_2m_max"), list) and len(daily["temperature_2m_max"]) > 0:
        tmax = float(daily["temperature_2m_max"][0])

    tmin = None
    if isinstance(daily.get("temperature_2m_min"), list) and len(daily["temperature_2m_min"]) > 0:
        tmin = float(daily["temperature_2m_min"][0])

    precip = None
    if isinstance(daily.get("precipitation_sum"), list) and len(daily["precipitation_sum"]) > 0:
        precip = float(daily["precipitation_sum"][0])

    current = data.get("current_weather", {})
    code = None
    if isinstance(current.get("weathercode"), (int, float)):
        code = int(current["weathercode"])

    return TodayWeather(
        city=geo["name"],
        country=geo["country"],
        latitude=geo["latitude"],
        longitude=geo["longitude"],
        timezone=tz,
        updated_at=datetime.utcnow().isoformat() + "Z",
        tmax_c=tmax,
        tmin_c=tmin,
        precipitation_mm=precip,
        weather_code=code,
        weather_text=weather_code_to_text(code),
    )
