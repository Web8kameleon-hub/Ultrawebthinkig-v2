"""Read live observations from the configured FHIR R4 server."""
import argparse
import json
import os
from medical_client import MedicalServiceClient

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("patient_id")
    args = parser.parse_args()
    client = MedicalServiceClient("FHIR_SERVER_URL", key_env="FHIR_UNUSED_KEY")
    token = os.getenv("FHIR_AUTH_TOKEN", "").strip()
    if token:
        client.session.headers["Authorization"] = f"Bearer {token}"
    bundle = client.get(f"Observation?patient={args.patient_id}&_sort=-date&_count=50", accept="application/fhir+json")
    print(json.dumps(bundle, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
