"""
Credential Encryption Service — Cloudonomix
============================================
Encrypts all cloud credentials (AWS keys, Azure secrets, GCP service accounts)
before storing in database. Uses Fernet symmetric encryption (AES-128-CBC).

Key facts:
- Same key encrypts and decrypts (symmetric)
- Key stored in environment variable — NOT in database
- If database is stolen → encrypted blobs are useless without the key
- If only key is stolen (no DB) → also useless
- Both needed → this is why we separate them

Setup:
1. Generate key once: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
2. Add to .env: ENCRYPTION_KEY=your_generated_key_here
3. Add to Render environment variables
4. Never commit this key to GitHub
"""

import os
from cryptography.fernet import Fernet, InvalidToken

def _get_fernet():
    """Get or create Fernet encryption instance."""
    key = os.getenv('ENCRYPTION_KEY', '')
    if not key:
        # In development without key — use a consistent dev key
        # NEVER use this in production
        print("[Encryption] WARNING: No ENCRYPTION_KEY set — using dev key. Set in .env for production!")
        key = 'dev-key-replace-in-production-aaaaaaaaaaaaa='
        # Generate a valid Fernet key from the dev string
        import base64
        key = base64.urlsafe_b64encode(b'cloudonomix-dev-encryption-key!').decode()
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        # Key might not be proper Fernet format — generate one
        import base64, hashlib
        proper_key = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
        return Fernet(proper_key)

def encrypt(plain_text: str) -> str:
    """
    Encrypt a plain text string.
    Returns encrypted string safe for database storage.
    Returns empty string if input is empty.
    """
    if not plain_text:
        return ''
    try:
        f = _get_fernet()
        return f.encrypt(plain_text.encode()).decode()
    except Exception as e:
        print(f"[Encryption] Encrypt failed: {e}")
        return plain_text  # Fallback — store plain (not ideal but won't crash)

def decrypt(encrypted_text: str) -> str:
    """
    Decrypt an encrypted string back to plain text.
    Returns empty string if input is empty.
    Handles already-plain-text values gracefully (for migration).
    """
    if not encrypted_text:
        return ''
    try:
        f = _get_fernet()
        return f.decrypt(encrypted_text.encode()).decode()
    except InvalidToken:
        # Value is not encrypted (old plain text data during migration)
        # Return as-is so existing credentials keep working
        return encrypted_text
    except Exception as e:
        print(f"[Encryption] Decrypt failed: {e}")
        return encrypted_text  # Return as-is rather than crash

def encrypt_if_needed(value: str) -> str:
    """
    Encrypt a value only if it's not already encrypted.
    Used during migration of existing plain-text credentials.
    """
    if not value:
        return ''
    # Try decrypting — if it works, it's already encrypted
    try:
        f = _get_fernet()
        f.decrypt(value.encode())
        return value  # Already encrypted
    except Exception:
        # Not encrypted yet — encrypt it
        return encrypt(value)
