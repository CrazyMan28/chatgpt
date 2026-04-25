import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createDefaultAuthConfig } from "@chatgpt-code/runtime-core";
import { PlatformDatabase } from "./database.js";
const AUTH_VAULT_KEY = "auth-config";
export class SqliteVaultAuthStore {
    database;
    passphrase;
    constructor(database, passphrase) {
        this.database = database;
        this.passphrase = passphrase;
    }
    async load(fallback = createDefaultAuthConfig()) {
        const row = this.database.get(`
        SELECT ciphertext, iv, salt, tag
        FROM vault_entries
        WHERE key = ?
      `, AUTH_VAULT_KEY);
        if (!row) {
            return this.save(fallback);
        }
        try {
            return decryptJson(row, this.passphrase);
        }
        catch {
            emitVaultWarning([
                "Saved auth could not be decrypted with the provided vault passphrase.",
                "Starting with the configured fallback auth instead.",
                "Use the original passphrase to recover the saved login, set CHATGPT_CODE_MISTRAL_API_KEY, or run /login to save new credentials with this passphrase."
            ].join(" "));
            return fallback;
        }
    }
    async save(config) {
        const encrypted = encryptJson(config, this.passphrase);
        this.database.run(`
        INSERT INTO vault_entries(key, salt, iv, tag, ciphertext, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          salt = excluded.salt,
          iv = excluded.iv,
          tag = excluded.tag,
          ciphertext = excluded.ciphertext,
          updated_at = excluded.updated_at
      `, AUTH_VAULT_KEY, encrypted.salt, encrypted.iv, encrypted.tag, encrypted.ciphertext, Date.now());
        return config;
    }
}
function encryptJson(value, passphrase) {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = scryptSync(passphrase, salt, 32);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const payload = Buffer.from(JSON.stringify(value), "utf8");
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        ciphertext: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        salt: salt.toString("base64"),
        tag: tag.toString("base64")
    };
}
function decryptJson(row, passphrase) {
    const salt = Buffer.from(row.salt, "base64");
    const iv = Buffer.from(row.iv, "base64");
    const tag = Buffer.from(row.tag, "base64");
    const ciphertext = Buffer.from(row.ciphertext, "base64");
    const key = scryptSync(passphrase, salt, 32);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]).toString("utf8");
    return JSON.parse(plaintext);
}
function emitVaultWarning(message) {
    process.stderr.write(`Auth warning: ${message}\n`);
}
//# sourceMappingURL=auth-store.js.map