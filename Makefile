.PHONY: up down airflow init-db seed-neo

up:
	docker compose up -d

down:
	docker compose down

airflow:
	docker compose exec airflow airflow dags list

init-db:
	docker compose exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB -f /docker-entrypoint-initdb.d/01-timescale.sql

seed-neo:
	docker compose exec neo4j cypher-shell -u $$NEO4J_USER -p $$NEO4J_PASSWORD -f /opt/neo4j/import/ontologies.cypher
