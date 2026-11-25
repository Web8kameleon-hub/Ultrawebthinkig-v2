"""Shared, real-only HTTP client for AGI×Med pipelines."""
from __future__ import annotations

import os
from typing import Any
from urllib.parse import urljoin, urlparse

import requests


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is not configured")
    return value


def require_service_url(name: str) -> str:
    value = require_env(name).rstrip("/") + "/"
    parsed = urlparse(value)
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}):
        raise RuntimeError(f"{name} must use HTTPS (HTTP is allowed only for localhost)")
    return value


class MedicalServiceClient:
    def __init__(self, base_env: str, key_env: str = "AGI_MED_API_KEY") -> None:
        self.base_url = require_service_url(base_env)
        self.session = requests.Session()
        key = os.getenv(key_env, "").strip()
        self.session.headers.update({"Accept": "application/json"})
        if key:
            self.session.headers.update({"X-API-Key": key})

    def get(self, path: str, *, accept: str = "application/json", timeout: int = 20) -> Any:
        response = self.session.get(urljoin(self.base_url, path.lstrip("/")), headers={"Accept": accept}, timeout=timeout)
        response.raise_for_status()
        return response.json()

    def post(self, path: str, payload: dict[str, Any], *, timeout: int = 30) -> Any:
        response = self.session.post(urljoin(self.base_url, path.lstrip("/")), json=payload, timeout=timeout)
        response.raise_for_status()
        return response.json()
