/**
 * Aufzeichnender Supabase-Ersatz für Tests, die prüfen, WELCHE Abfragen ein
 * Modul in WELCHER Reihenfolge absetzt (Tabelle, Operation, Filter).
 *
 * Jeder `from(table)`-Aufruf ergibt eine aufgezeichnete Abfrage; jede
 * Builder-Methode hängt einen Schritt an und gibt denselben Builder zurück.
 * `await` löst mit der Antwort des Tests auf (Default: leere Liste, kein Fehler).
 * Wird ausschließlich aus *.test.ts importiert, nie aus Produktions-Code.
 */
export interface RecordedStep {
    readonly method: string;
    readonly args: readonly unknown[];
}

export interface RecordedQuery {
    readonly table: string;
    readonly steps: RecordedStep[];
}

export interface RecordedResponse {
    readonly data: unknown;
    readonly error: { message: string } | null;
}

export interface SupabaseRecorder {
    readonly client: { from: (table: string) => unknown };
    readonly queries: RecordedQuery[];
    /** Antwort je Abfrage; vom Test überschreibbar. */
    respond: (recordedQuery: RecordedQuery) => RecordedResponse;
    reset: () => void;
}

const EMPTY_RESPONSE: RecordedResponse = { data: [], error: null };

export function createSupabaseRecorder(): SupabaseRecorder {
    const recorder: SupabaseRecorder = {
        queries: [],
        respond: () => EMPTY_RESPONSE,
        reset: () => {
            recorder.queries.length = 0;
            recorder.respond = () => EMPTY_RESPONSE;
        },
        client: {
            from: (table: string) => {
                const recordedQuery: RecordedQuery = { table, steps: [] };
                recorder.queries.push(recordedQuery);
                return buildRecordingBuilder(recorder, recordedQuery);
            },
        },
    };
    return recorder;
}

function buildRecordingBuilder(recorder: SupabaseRecorder, recordedQuery: RecordedQuery): unknown {
    const recordingBuilder: unknown = new Proxy({}, {
        get: (_target, propertyName) => {
            if (propertyName === 'then') {
                return (onFulfilled: (response: RecordedResponse) => unknown) =>
                    Promise.resolve(recorder.respond(recordedQuery)).then(onFulfilled);
            }
            return (...args: unknown[]) => {
                recordedQuery.steps.push({ method: String(propertyName), args });
                return recordingBuilder;
            };
        },
    });
    return recordingBuilder;
}

/** Der erste Schritt mit diesem Methodennamen, z. B. das Argument von `update`. */
export function findStep(recordedQuery: RecordedQuery, method: string): RecordedStep | undefined {
    return recordedQuery.steps.find((recordedStep) => recordedStep.method === method);
}

/** true, wenn die Abfrage einen Schritt mit genau diesen Argumenten enthält. */
export function hasStep(recordedQuery: RecordedQuery, method: string, args: readonly unknown[]): boolean {
    return recordedQuery.steps.some((recordedStep) => recordedStep.method === method
        && JSON.stringify(recordedStep.args) === JSON.stringify(args));
}
