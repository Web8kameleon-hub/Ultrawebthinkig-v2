# No Fake Ever Policy

Production behavior must be backed by an observable real source. If a source is missing, unreachable, unauthorized, or malformed, the system must return an explicit unavailable/error state. It must not manufacture a successful response.

## Forbidden in runtime code

- Randomly generated telemetry, balances, prices, health, load, threats, users, devices, transactions, confidence, or analytics.
- Mock, fake, dummy, synthetic, simulated, or placeholder providers presented as live functionality.
- Silent fallback from a failed real provider to invented values.
- Claims such as `live`, `verified`, `healthy`, or `real` without evidence from the responsible provider.

## Allowed

- Clearly isolated test fixtures under test/fixture directories.
- Cryptographically generated opaque identifiers that do not represent measurements or facts.
- UI placeholders that are labels or input hints rather than records.
- Explicit `unknown`, `unavailable`, or error results with source and timestamp metadata.

## Required response provenance

Runtime data should expose the provider/source, observation timestamp, and availability state where practical. Cached data must say it is cached and retain the original observation time.

## Enforcement

Run `npm run no-fake:audit` for a JSON inventory or `npm run no-fake:enforce` to fail on violations. The enforcement command is intentionally fail-closed: unresolved violations block a production claim.
