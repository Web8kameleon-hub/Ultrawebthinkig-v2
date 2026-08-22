"""Verify one real medical license with the configured official registry."""
import argparse
import json
from medical_client import MedicalServiceClient

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("license_number")
    parser.add_argument("doctor_nid")
    args = parser.parse_args()
    client = MedicalServiceClient("MEDICAL_REGISTRY_API_URL", key_env="REGISTRY_API_KEY")
    key = client.session.headers.pop("X-API-Key", None)
    if key:
        client.session.headers["Authorization"] = f"Bearer {key}"
    result = client.post("", {"license_number": args.license_number, "nid": args.doctor_nid})
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
