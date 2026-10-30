"""Mint an RS256 operator token for the dev issuer.

The private key stays in .jwt/, which is gitignored. The public JWKS is what
Convex serves. Re-running this script reuses the same key.
"""

import base64
import json
import time
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

ROOT = Path(__file__).resolve().parents[1]
KEY_DIR = ROOT / ".jwt"
PRIVATE = KEY_DIR / "private.pem"
PUBLIC = KEY_DIR / "jwks.json"
TOKEN = KEY_DIR / "session.token"
KID = "dse-dev-1"
ISSUER = "https://effervescent-kangaroo-10.convex.site"
AUDIENCE = "dse-gateway"
SUBJECT = "operator"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_int(value: int) -> str:
    length = max(1, (value.bit_length() + 7) // 8)
    return b64url(value.to_bytes(length, "big"))


def load_or_create():
    KEY_DIR.mkdir(exist_ok=True)
    if PRIVATE.is_file():
        return serialization.load_pem_private_key(PRIVATE.read_bytes(), password=None)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    PRIVATE.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    return key


def main():
    key = load_or_create()
    numbers = key.public_key().public_numbers()
    jwks = {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": KID,
                "n": b64url_int(numbers.n),
                "e": b64url_int(numbers.e),
            }
        ]
    }
    PUBLIC.write_text(json.dumps(jwks, separators=(",", ":")), encoding="utf-8")
    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT", "kid": KID}).encode())
    payload = b64url(
        json.dumps(
            {
                "iss": ISSUER,
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
    TOKEN.write_text(signing.decode() + "." + b64url(signature), encoding="utf-8")
    print(f"kid={KID}")
    print(f"issuer={ISSUER}")
    print(f"audience={AUDIENCE}")
    print(f"subject={SUBJECT}")
    print("token-written")


if __name__ == "__main__":
    main()
