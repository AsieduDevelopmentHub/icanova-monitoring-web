"""Mint an RS256 operator token for the lab issuer.

The private key stays under .jwt/ (gitignored). The public JWKS is what Convex
serves. Re-running this script reuses the same key for that target.

Usage:
  python scripts/issue-operator-token.py            # development kangaroo
  python scripts/issue-operator-token.py --staging  # staging roadrunner
"""

from __future__ import annotations

import argparse
import base64
import json
import time
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

ROOT = Path(__file__).resolve().parents[1]
AUDIENCE = "dse-gateway"
SUBJECT = "operator"

TARGETS = {
    "dev": {
        "key_dir": ROOT / ".jwt",
        "kid": "dse-dev-1",
        "issuer": "https://effervescent-kangaroo-10.convex.site",
        "token_name": "session.token",
    },
    "staging": {
        "key_dir": ROOT / ".jwt" / "staging",
        "kid": "dse-staging-1",
        "issuer": "https://dapper-roadrunner-247.convex.site",
        "token_name": "session.token",
    },
}


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_int(value: int) -> str:
    length = max(1, (value.bit_length() + 7) // 8)
    return b64url(value.to_bytes(length, "big"))


def load_or_create(private_path: Path):
    private_path.parent.mkdir(parents=True, exist_ok=True)
    if private_path.is_file():
        return serialization.load_pem_private_key(private_path.read_bytes(), password=None)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    return key


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--staging",
        action="store_true",
        help="Mint against the staging Convex site issuer",
    )
    args = parser.parse_args()
    target = TARGETS["staging" if args.staging else "dev"]
    key_dir: Path = target["key_dir"]
    private_path = key_dir / "private.pem"
    public_path = key_dir / "jwks.json"
    token_path = key_dir / target["token_name"]
    kid = target["kid"]
    issuer = target["issuer"]

    key = load_or_create(private_path)
    numbers = key.public_key().public_numbers()
    jwks = {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": kid,
                "n": b64url_int(numbers.n),
                "e": b64url_int(numbers.e),
            }
        ]
    }
    public_path.write_text(json.dumps(jwks, separators=(",", ":")), encoding="utf-8")
    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT", "kid": kid}).encode())
    payload = b64url(
        json.dumps(
            {
                "iss": issuer,
                "aud": AUDIENCE,
                "sub": SUBJECT,
                "name": "Operator",
                "email": "operator@dse.local",
                "iat": now,
                "exp": now + 12 * 60 * 60,
            }
        ).encode()
    )
    signing = f"{header}.{payload}".encode()
    signature = key.sign(signing, padding.PKCS1v15(), hashes.SHA256())
    token_path.write_text(signing.decode() + "." + b64url(signature), encoding="utf-8")
    print(f"target={'staging' if args.staging else 'dev'}")
    print(f"kid={kid}")
    print(f"issuer={issuer}")
    print(f"audience={AUDIENCE}")
    print(f"subject={SUBJECT}")
    print(f"jwks={public_path}")
    print(f"token={token_path}")
    print("token-written")


if __name__ == "__main__":
    main()
