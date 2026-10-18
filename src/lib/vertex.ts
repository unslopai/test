import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let aiClient: GoogleGenAI | null = null;

export function getVertexClient() {
    if (aiClient) return aiClient;

    try {
        console.log("Initializing Vertex AI Client...");
        const projectId = process.env.GOOGLE_PROJECT_ID;
        const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;


        if (!projectId || !base64Key) {
            throw new Error('Fehlende Environment Variables: GOOGLE_PROJECT_ID oder GOOGLE_SERVICE_ACCOUNT_BASE64');
        }

        // Base64 String in UTF-8 umwandeln und als JSON parsen
        const decodedKey = Buffer.from(base64Key, 'base64').toString('utf-8');

        // Für @google/genai (Vertex AI) ist es am sichersten, Application Default Credentials (ADC) zu nutzen.
        // Wir schreiben den Key in eine temporäre Datei und setzen GOOGLE_APPLICATION_CREDENTIALS.
        const tmpDir = os.tmpdir();
        const keyPath = path.join(tmpDir, 'vertex-key.json');
        fs.writeFileSync(keyPath, decodedKey);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

        // GoogleGenAI initialisieren
        aiClient = new GoogleGenAI({
            project: projectId,
            location: 'europe-west3',
            // @ts-expect-error: Bekannter SDK-Typisierungsbug (erwartet boolean, erfordert aber Objekt für Vertex)
            vertexai: {
                project: projectId,
                location: 'europe-west3',
            }
        });

        return aiClient;
    } catch (error) {
        console.error('Fehler beim Initialisieren des Vertex AI Clients:', error);
        throw error;
    }
}

