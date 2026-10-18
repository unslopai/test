/**
 * Token-Verschlüsselung mit AES-256-GCM.
 *
 * Verwendet einen symmetrischen Schlüssel aus der Umgebungsvariable TOKEN_ENCRYPTION_KEY
 * (32 Byte, Base64-kodiert). Jede Verschlüsselung erzeugt einen zufälligen IV,
 * was sicherstellt, dass identische Tokens unterschiedliche Ciphertexte produzieren.
 */
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Lädt den Encryption Key aus der Umgebungsvariable.
 * Der Key muss exakt 32 Byte lang sein (Base64-kodiert: 44 Zeichen).
 *
 * @returns Buffer mit dem 32-Byte Encryption Key
 * @throws Error wenn TOKEN_ENCRYPTION_KEY nicht gesetzt oder ungültig ist
 */
function getEncryptionKey(): Buffer {
    const keyBase64 = process.env.TOKEN_ENCRYPTION_KEY;

    if (!keyBase64) {
        throw new Error(
            'TOKEN_ENCRYPTION_KEY ist nicht gesetzt. ' +
            'Generiere einen mit: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
        );
    }

    const keyBuffer = Buffer.from(keyBase64, 'base64');

    if (keyBuffer.length !== 32) {
        throw new Error(
            `TOKEN_ENCRYPTION_KEY muss exakt 32 Byte lang sein (Base64-kodiert), ist aber ${keyBuffer.length} Byte.`
        );
    }

    return keyBuffer;
}

/** Rückgabetyp der Verschlüsselung — alle Felder als Base64-Strings für die Datenbank. */
export interface EncryptedData {
    encryptedToken: string;
    iv: string;
    tag: string;
}

/**
 * Verschlüsselt einen Plaintext-Token mit AES-256-GCM.
 *
 * @param plaintext - Der zu verschlüsselnde Token (z.B. GitHub Access Token)
 * @returns EncryptedData mit Ciphertext, IV und Auth-Tag als Base64
 */
export function encryptToken(plaintext: string): EncryptedData {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag();

    return {
        encryptedToken: encrypted,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
    };
}

/**
 * Entschlüsselt einen mit encryptToken() verschlüsselten Token.
 *
 * @param encryptedData - Die verschlüsselten Daten (Ciphertext, IV, Tag)
 * @returns Der entschlüsselte Plaintext-Token
 * @throws Error bei ungültigem Auth-Tag (Manipulation erkannt)
 */
export function decryptToken(encryptedData: EncryptedData): string {
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedData.encryptedToken, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
