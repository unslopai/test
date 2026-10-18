async function test() {
    const [{ GoogleGenAI }, fs, path, os] = await Promise.all([
        import('@google/genai'),
        import('node:fs'),
        import('node:path'),
        import('node:os'),
    ]);

    const envFile = fs.readFileSync('.env.local', 'utf-8');
    envFile.split('\n').forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) return;

        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) return;

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^"(.*)"$/, '$1');
        process.env[key] = value;
    });

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
            vertexai: true,
        });

        console.log("Client initialisiert, generiere Content...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Test',
        });
        console.log("Antwort:", response.text);
    } catch (error) {
        console.error("FEHLER:", error);
    }
}
void test();
