#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3000}"
HOST_HEADER="${2:-www.clisonix.com}"
PROTO_HEADER="${3:-https}"
TEST_USER_ID="${4:-anonymous-user}"

TMP_BODY="/tmp/clisonix_verify_body"

request_code() {
  local method="$1"
  local path="$2"
  local extra_header_name="${3:-}"
  local extra_header_value="${4:-}"

  if [[ -n "$extra_header_name" ]]; then
    curl -sS -X "$method" \
      -H "Host: ${HOST_HEADER}" \
      -H "X-Forwarded-Proto: ${PROTO_HEADER}" \
      -H "${extra_header_name}: ${extra_header_value}" \
      -o "$TMP_BODY" -w '%{http_code}' -m 20 "${BASE_URL}${path}" || true
  else
    curl -sS -X "$method" \
      -H "Host: ${HOST_HEADER}" \
      -H "X-Forwarded-Proto: ${PROTO_HEADER}" \
      -o "$TMP_BODY" -w '%{http_code}' -m 20 "${BASE_URL}${path}" || true
  fi
}

assert_code() {
  local got="$1"
  local expected="$2"
  local label="$3"
  if [[ "$got" != "$expected" ]]; then
    echo "[VERIFY] FAIL ${label}: expected ${expected}, got ${got}"
    head -c 300 "$TMP_BODY" || true
    echo
    exit 1
  fi
}

assert_body_contains() {
  local needle="$1"
  local label="$2"
  if ! grep -q "$needle" "$TMP_BODY"; then
    echo "[VERIFY] FAIL ${label}: body missing '${needle}'"
    head -c 300 "$TMP_BODY" || true
    echo
    exit 1
  fi
}

echo "[VERIFY] 1/6 Zurich health"
code="$(request_code GET /api/zurich)"
assert_code "$code" "200" "zurich health code"
assert_body_contains '"status":"online"' "zurich online"

echo "[VERIFY] 2/6 Kloud bridge"
code="$(request_code GET /api/proxy/kloud-bridge)"
assert_code "$code" "200" "kloud bridge code"
assert_body_contains '"activity_updates":null' "kloud no synthetic updates"

echo "[VERIFY] 3/6 user-data-sources without identity"
code="$(request_code GET /api/proxy/user-data-sources)"
assert_code "$code" "422" "user-data-sources no identity"
assert_body_contains 'Missing required identity' "user-data-sources strict identity"

echo "[VERIFY] 4/6 user-summary without identity"
code="$(request_code GET /api/proxy/user-summary)"
assert_code "$code" "422" "user-summary no identity"
assert_body_contains 'Missing required identity' "user-summary strict identity"

echo "[VERIFY] 5/6 user-data-sources with identity"
code="$(request_code GET /api/proxy/user-data-sources X-User-ID "$TEST_USER_ID")"
assert_code "$code" "200" "user-data-sources with identity"

echo "[VERIFY] 6/6 user-summary with identity"
code="$(request_code GET /api/proxy/user-summary X-User-ID "$TEST_USER_ID")"
assert_code "$code" "200" "user-summary with identity"

echo "[VERIFY] PASS"
