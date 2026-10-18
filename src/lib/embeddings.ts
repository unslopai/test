/**
 * Embedding-Modul für Vektor-Generierung via Vertex AI.
 *
 * Nutzt text-embedding-005 (768 Dimensionen) für Semantic Search.
 * Unterstützt verschiedene Task Types für optimierte Embeddings:
 * - RETRIEVAL_DOCUMENT: Beim Ingest (Dokumente indizieren)
 * - RETRIEVAL_QUERY: Bei der Suche (User-Anfrage)
 * - CODE_RETRIEVAL_QUERY: Für Code-spezifische Suchen
 */
import { getVertexClient } from '@/lib/vertex';

/** Unterstützte Task Types für text-embedding-005. */
export type EmbeddingTaskType =
    | 'RETRIEVAL_DOCUMENT'
    | 'RETRIEVAL_QUERY'
    | 'SEMANTIC_SIMILARITY'
    | 'CLASSIFICATION'
    | 'CLUSTERING'
    | 'CODE_RETRIEVAL_QUERY';

const EMBEDDING_MODEL = 'text-embedding-005';
const EMBEDDING_DIMENSIONS = 768;

/**
 * Generiert ein Embedding für einen einzelnen Text.
 *
 * @param text - Der zu embeddende Text
 * @param taskType - Der Task Type für optimierte Embeddings
 * @returns Array von 768 Floats (der Embedding-Vektor)
 * @throws Error wenn die Embedding-Generierung fehlschlägt
 */
export async function generateEmbedding(
    text: string,
    taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT',
): Promise<number[]> {
    const ai = getVertexClient();

    const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: {
            taskType,
            outputDimensionality: EMBEDDING_DIMENSIONS,
        },
    });

    const values = response.embeddings?.[0]?.values;

    if (!values || values.length === 0) {
        throw new Error(
            `Embedding-Generierung fehlgeschlagen: Keine Werte zurückgegeben für Text (${text.substring(0, 100)}...)`,
        );
    }

    return values;
}

/**
 * Generiert Embeddings für mehrere Texte in einem Batch.
 *
 * text-embedding-005 unterstützt bis zu 250 Texte pro Request.
 * Bei mehr Texten wird automatisch in Batches aufgeteilt.
 *
 * @param texts - Array von Texten
 * @param taskType - Der Task Type für optimierte Embeddings
 * @returns Array von Embedding-Vektoren (gleiche Reihenfolge wie Input)
 */
export async function generateEmbeddings(
    texts: string[],
    taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT',
): Promise<number[][]> {
    if (texts.length === 0) return [];

    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let batchStart = 0; batchStart < texts.length; batchStart += BATCH_SIZE) {
        const batch = texts.slice(batchStart, batchStart + BATCH_SIZE);

        console.log(
            `[Embeddings] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} ` +
            `(${batch.length} Texte)...`,
        );

        const ai = getVertexClient();

        // embedContent für Batch: contents als Array von Strings
        const batchEmbeddings: number[][] = [];

        for (const text of batch) {
            const response = await ai.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: text,
                config: {
                    taskType,
                    outputDimensionality: EMBEDDING_DIMENSIONS,
                },
            });

            const values = response.embeddings?.[0]?.values;
            if (!values || values.length === 0) {
                throw new Error(
                    `Embedding fehlgeschlagen für: "${text.substring(0, 80)}..."`,
                );
            }

            batchEmbeddings.push(values);
        }

        allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
}

/**
 * Gibt die konfigurierte Embedding-Dimension zurück.
 * Nützlich für Validierung und Tabellen-Erstellung.
 */
export function getEmbeddingDimensions(): number {
    return EMBEDDING_DIMENSIONS;
}
