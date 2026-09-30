import { readFileSync } from 'node:fs';

export interface UserSettings {
    readonly theme: string;
    readonly language: string;
}

const DEFAULT_SETTINGS: UserSettings = { theme: 'light', language: 'en' };

export function loadUserSettings(settingsPath: string): UserSettings {
    try {
        const rawSettings = readFileSync(settingsPath, 'utf8');
        return JSON.parse(rawSettings) as UserSettings;
    } catch {
        return DEFAULT_SETTINGS;
    }
}
