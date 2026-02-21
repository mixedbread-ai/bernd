import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(passphrase: string): Buffer {
  return createHash("sha256").update(passphrase).digest();
}

function getEncryptionKey(): string | undefined {
  return process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
}

export function encrypt(data: string, key?: string): string {
  const k = key ?? getEncryptionKey();
  if (!k) return data;

  const derivedKey = deriveKey(k);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encrypted: string, key?: string): string {
  const k = key ?? getEncryptionKey();
  if (!k) return encrypted;

  try {
    const parts = encrypted.split(":");
    if (parts.length !== 3) return encrypted;

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const derivedKey = deriveKey(k);
    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    // If decryption fails, assume it's unencrypted (backwards compat)
    return encrypted;
  }
}
