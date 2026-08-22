"""Submit a real PACS study to the configured AGI diagnostics engine."""
import argparse
import json
from medical_client import MedicalServiceClient

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("study_uid", help="Real DICOM StudyInstanceUID")
    args = parser.parse_args()
    pacs = MedicalServiceClient("PACS_DICOMWEB_URL", key_env="PACS_API_KEY")
    engine = MedicalServiceClient("AGI_MED_ENGINE_URL")
    instances = pacs.get(f"studies/{args.study_uid}/instances", accept="application/dicom+json", timeout=30)
    if not isinstance(instances, list):
        raise RuntimeError("PACS returned invalid instance metadata")
    result = engine.post("v1/diagnostics/analyze-study", {"studyInstanceUid": args.study_uid, "instancesCount": len(instances)}, timeout=90)
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
