"""Encryption utilities using machine fingerprint + AES."""
import os
import base64
import hashlib
import platform
import uuid
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

def _get_machine_fingerprint() -> str:
    parts = [
        platform.node(),
        str(uuid.getnode()),
        platform.processor() or "unknown",
    ]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()

def _derive_key(salt: bytes = None) -> tuple[bytes, bytes]:
    if salt is None:
        salt = b"vasp_gui_salt_2024"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000)
    key = base64.urlsafe_b64encode(kdf.derive(_get_machine_fingerprint().encode()))
    return key, salt

def encrypt_password(password: str) -> str:
    key, _ = _derive_key()
    f = Fernet(key)
    return f.encrypt(password.encode()).decode()

def decrypt_password(encrypted: str) -> str:
    key, _ = _derive_key()
    f = Fernet(key)
    return f.decrypt(encrypted.encode()).decode()
