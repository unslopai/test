/**
 * Parallele Abarbeitung mit fester Obergrenze — für GitHub-Contents-Fetches,
 * die seriell zu langsam und ungedeckelt ein Rate-Limit-Risiko wären.
 */

/**
 * Wendet `mapEntry` auf jeden Eintrag an, höchstens `concurrencyLimit` Aufrufe
 * gleichzeitig. Die Ergebnisse stehen in der Reihenfolge der Eingabe. Wirft ein
 * Aufruf, lehnt das Ganze ab — Fehlerbehandlung je Eintrag gehört in `mapEntry`.
 */
export async function mapWithConcurrency<Input, Output>(
    inputEntries: readonly Input[],
    concurrencyLimit: number,
    mapEntry: (inputEntry: Input) => Promise<Output>,
): Promise<Output[]> {
    const mappedEntries: Output[] = new Array(inputEntries.length);
    let nextEntryIndex = 0;

    const runWorker = async (): Promise<void> => {
        for (let entryIndex = nextEntryIndex++; entryIndex < inputEntries.length; entryIndex = nextEntryIndex++) {
            mappedEntries[entryIndex] = await mapEntry(inputEntries[entryIndex]);
        }
    };

    await Promise.all(Array.from({ length: Math.max(1, concurrencyLimit) }, () => runWorker()));
    return mappedEntries;
}
