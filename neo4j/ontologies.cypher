// Ontology bootstrap for bioscience concepts
CREATE CONSTRAINT IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE;

MERGE (snomed:Ontology {name: 'SNOMED'})
MERGE (umls:Ontology {name: 'UMLS'});

MERGE (epilepsy:Concept {id: 'C0018681', name: 'Epilepsy'})-[:IN_ONTOLOGY]->(umls);
MERGE (seizure:Concept {id: '71388002', name: 'Seizure'})-[:IN_ONTOLOGY]->(snomed);
MERGE (epilepsy)-[:RELATED {type: 'is_a', weight: 0.8}]->(seizure);
