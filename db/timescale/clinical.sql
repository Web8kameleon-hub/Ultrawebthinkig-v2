CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS telemetry (
  ts TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  signal TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  tags JSONB DEFAULT '{}'::jsonb
);
SELECT create_hypertable('telemetry', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS telemetry_idx ON telemetry (source, signal, ts DESC);

CREATE TABLE IF NOT EXISTS drugs (
  drug_id SERIAL PRIMARY KEY,
  brand_name TEXT,
  generic_name TEXT,
  atc_code TEXT,
  route TEXT
);

CREATE TABLE IF NOT EXISTS indications (
  id SERIAL PRIMARY KEY,
  drug_id INT REFERENCES drugs(drug_id),
  indication TEXT
);
