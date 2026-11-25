"""Run real pharmacology verification for explicit RxCUI inputs."""
import argparse
import json
from medical_client import MedicalServiceClient

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rxcui", action="append", required=True)
    parser.add_argument("--weight-kg", type=float, required=True)
    parser.add_argument("--creatinine-clearance", type=float, required=True)
    args = parser.parse_args()
    result = MedicalServiceClient("AGI_MED_ENGINE_URL").post("v1/pharmacology/verify-dosing", {"rxcui_codes": args.rxcui, "patient_parameters": {"weight_kg": args.weight_kg, "creatinine_clearance": args.creatinine_clearance}})
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
