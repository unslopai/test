/**
 * Serverseitiger Secret-Filter für den Modell-Diff (REPO_CONTEXT_SPEC §9 1a,
 * ROADMAP „Datenschutz-Hygiene“): bis 2026-10-05 lief der Filter nur in den
 * Clients, im PR-Pfad ging jede hinzugefügte Zeile unverändert an das Modell.
 *
 * Redigiert wird nur, was ein Modell liest (`reviewableFiles`). Der Pre-Scanner
 * liest weiter die unveränderten Dateien: seine Secret-Regeln sollen einen
 * eingecheckten Schlüssel finden und melden. Ersetzt wird das Material, nicht
 * die Zeile — Zeilennummern, Hunk-Grenzen und der Name der Variable bleiben,
 * damit das Modell „hier steht ein Literal“ weiter sehen und melden kann.
 */
import { redactSecretsInPatch } from '@unslop/shared/secret-filter';
import type { PullRequestFile } from '@/lib/github';
import type { SecretRedaction } from '@/lib/pipeline/types';

export interface RedactedFiles {
    readonly redactedFiles: PullRequestFile[];
    /** Je redigierter Zeile ein Eintrag: Datei und Musterklassen, nie das Material. */
    readonly secretRedactions: SecretRedaction[];
}

export function redactSecretsInFiles(modelFiles: readonly PullRequestFile[]): RedactedFiles {
    const secretRedactions: SecretRedaction[] = [];
    const redactedFiles = modelFiles.map((modelFile) => {
        if (!modelFile.patch) return modelFile;
        const patchRedaction = redactSecretsInPatch(modelFile.patch);
        if (patchRedaction.redactedLineClasses.length === 0) return modelFile;
        for (const patternClasses of patchRedaction.redactedLineClasses) {
            secretRedactions.push({ path: modelFile.filename, patternClasses });
        }
        return { ...modelFile, patch: patchRedaction.redactedPatch };
    });
    return { redactedFiles, secretRedactions };
}
