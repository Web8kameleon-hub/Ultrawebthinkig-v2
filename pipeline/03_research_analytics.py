"""Analyze a real registered clinical-trial cohort."""
import argparse
import json
from medical_client import MedicalServiceClient

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("trial_id")
    args = parser.parse_args()
    result = MedicalServiceClient("AGI_MED_ENGINE_URL").post("v1/research/analyze-cohort", {"trial_id": args.trial_id})
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
