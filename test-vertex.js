const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const envFile = fs.readFileSync('.env.local', 'utf-8');
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)="?(.*)"?$/);
    if (match) process.env[match[1]] = match[2];
});

async function test() {
    try {
        console.log("Starte Test...");
        const projectId = process.env.GOOGLE_PROJECT_ID;
        const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
        
        const decodedKey = Buffer.from(base64Key, 'base64').toString('utf-8');
        const keyPath = path.join(os.tmpdir(), 'test-vertex-key.json');
        fs.writeFileSync(keyPath, decodedKey);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

        const ai = new GoogleGenAI({
            project: projectId,
            location: 'europe-west3',
            vertexai: {
                project: projectId,
                location: 'europe-west3'
            }
        });

        console.log("Client initialisiert, generiere Content...");
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: 'Test'
        });
        console.log("Antwort:", response.text);
    } catch (e) {
        console.error("FEHLER:", e);
    }
}
test();
