"""Encryption utilities for sensitive data like OAuth tokens."""

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def get_encryption_key() -> str | None:
    """Get the encryption key from environment variable."""
    return os.getenv("GOOGLE_TOKEN_ENCRYPTION_KEY")


def _derive_fernet_key(passphrase: str) -> bytes:
    """Derive a valid Fernet key from an arbitrary passphrase.

    Fernet requires a 32-byte base64-encoded key. We use SHA256 to derive
    a consistent 32-byte key from any passphrase.
    """
    key_bytes = hashlib.sha256(passphrase.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


def _get_fernet(key: str) -> Fernet:
    """Get a Fernet instance from a key (either valid Fernet key or passphrase)."""
    try:
        # Try to use the key directly as a Fernet key
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, Exception):
        # If it's not a valid Fernet key, derive one from it as a passphrase
        derived_key = _derive_fernet_key(key)
        return Fernet(derived_key)


def encrypt_token(data: str, key: str | None = None) -> str:
    """Encrypt a token string.

    Args:
        data: The plaintext token to encrypt
        key: Encryption key (uses env var if not provided)

    Returns:
        Base64-encoded encrypted data, or original data if no key available
    """
    if key is None:
        key = get_encryption_key()

    if not key:
        return data  # No encryption if no key configured

    fernet = _get_fernet(key)
    encrypted = fernet.encrypt(data.encode())
    return encrypted.decode()


def decrypt_token(encrypted: str, key: str | None = None) -> str:
    """Decrypt an encrypted token string.

    Args:
        encrypted: The encrypted token (base64 Fernet token)
        key: Encryption key (uses env var if not provided)

    Returns:
        Decrypted plaintext, or original data if decryption fails/no key
    """
    if key is None:
        key = get_encryption_key()

    if not key:
        return encrypted  # Return as-is if no key configured

    try:
        fernet = _get_fernet(key)
        decrypted = fernet.decrypt(encrypted.encode())
        return decrypted.decode()
    except (InvalidToken, Exception):
        # If decryption fails, assume it's unencrypted (backwards compat)
        return encrypted
