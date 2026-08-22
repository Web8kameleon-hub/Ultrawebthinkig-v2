"""Request a surgical plan from the configured authorized engine."""
import argparse
import json
from medical_client import MedicalServiceClient

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("patient_reference", help="Authorized upstream patient reference")
    parser.add_argument("procedure_code")
    args = parser.parse_args()
    result = MedicalServiceClient("AGI_MED_ENGINE_URL").post("v1/surgical/plan", {"patient_reference": args.patient_reference, "procedure_code": args.procedure_code}, timeout=60)
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
