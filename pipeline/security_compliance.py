"""Local PHI encryption utility. It makes no compliance certification claims."""
import argparse
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def key() -> bytes:
    raw = os.getenv("E2EE_MASTER_KEY_HEX", "")
    if len(raw) != 64:
        raise RuntimeError("E2EE_MASTER_KEY_HEX must contain 64 hexadecimal characters")
    return bytes.fromhex(raw)

def encrypt(value: dict) -> dict:
    nonce = os.urandom(12)
    ciphertext = AESGCM(key()).encrypt(nonce, json.dumps(value).encode("utf-8"), None)
    return {"algorithm": "AES-256-GCM", "nonce": nonce.hex(), "ciphertext": ciphertext.hex()}

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_file", help="Path to an authorized local JSON input")
    args = parser.parse_args()
    with open(args.json_file, "r", encoding="utf-8") as handle:
        print(json.dumps(encrypt(json.load(handle)), indent=2))

if __name__ == "__main__":
    main()
