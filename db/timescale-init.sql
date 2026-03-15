CREATE EXTENSION IF NOT EXISTS timescaledb;
-- Telemetry hypertable (OPC UA / FIWARE / Ditto / OpenPLC)
CREATE TABLE IF NOT EXISTS telemetry (
  ts timestamptz NOT NULL,
  source text NOT NULL,
  signal text NOT NULL,
  value double precision NOT NULL,
  tags jsonb DEFAULT '{}'::jsonb
);
SELECT create_hypertable('telemetry','ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS telemetry_source_idx ON telemetry (source, ts DESC);

-- Clinical/Medicinal curated tables (OpenFDA/EMA/ATC/CT.gov)
CREATE TABLE IF NOT EXISTS drug_labels (
  id text PRIMARY KEY,
  brand_name text[],
  generic_name text[],
  purpose text[],
  indications text,
  route text[]
);

CREATE TABLE IF NOT EXISTS clinical_trials (
  nct_id text PRIMARY KEY,
  title text,
  status text,
  conditions text[],
  phases text[],
  start_date date,
  last_update date
);
