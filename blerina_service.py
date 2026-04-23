#!/usr/bin/env python3
"""Blerina service: real text reformatting API."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

app = FastAPI(title="Blerina Service", version="1.0.0")


class ReformatRequest(BaseModel):
	text: str = Field(..., min_length=1)
	max_summary_sentences: int = Field(3, ge=1, le=10)
	include_entities: bool = True


def _normalize_whitespace(text: str) -> str:
	return re.sub(r"\s+", " ", text).strip()


def _split_sentences(text: str) -> list[str]:
	parts = re.split(r"(?<=[.!?])\s+", text.strip())
	return [p.strip() for p in parts if p and p.strip()]


def _extract_entities(text: str) -> dict[str, list[str]]:
	emails = sorted(set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)))
	urls = sorted(set(re.findall(r"https?://[^\s]+", text)))
	hashtags = sorted(set(re.findall(r"#[A-Za-z0-9_]+", text)))
	mentions = sorted(set(re.findall(r"@[A-Za-z0-9_]+", text)))
	capitalized = sorted(
		set(
			token
			for token in re.findall(r"\b[A-Z][a-zA-Z]{2,}\b", text)
			if token.lower() not in {"the", "and", "for", "with", "from"}
		)
	)
	return {
		"emails": emails,
		"urls": urls,
		"hashtags": hashtags,
		"mentions": mentions,
		"keywords": capitalized,
	}


def _format_text(text: str, max_summary_sentences: int, include_entities: bool) -> dict[str, Any]:
	normalized = _normalize_whitespace(text)
	if not normalized:
		raise HTTPException(status_code=422, detail="Text must not be empty")

	sentences = _split_sentences(normalized)
	summary = " ".join(sentences[:max_summary_sentences]) if sentences else normalized

	payload: dict[str, Any] = {
		"normalized_text": normalized,
		"summary": summary,
		"sentence_count": len(sentences),
		"word_count": len(normalized.split()),
		"character_count": len(normalized),
		"sha256": hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
		"timestamp": datetime.now(timezone.utc).isoformat(),
	}

	if include_entities:
		payload["entities"] = _extract_entities(normalized)

	return payload


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "healthy", "service": "blerina"}


@app.post("/api/v1/blerina/reformat")
def reformat(payload: ReformatRequest) -> dict[str, Any]:
	return _format_text(
		text=payload.text,
		max_summary_sentences=payload.max_summary_sentences,
		include_entities=payload.include_entities,
	)


@app.get("/api/v1/blerina/reformat")
def reformat_get(
	text: str = Query(..., min_length=1),
	max_summary_sentences: int = Query(3, ge=1, le=10),
	include_entities: bool = Query(True),
) -> dict[str, Any]:
	return _format_text(
		text=text,
		max_summary_sentences=max_summary_sentences,
		include_entities=include_entities,
	)
