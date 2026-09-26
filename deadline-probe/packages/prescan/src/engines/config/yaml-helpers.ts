/**
 * Gemeinsame Node-Helfer für alle YAML-/JSON-basierten Config-Checks
 * (K8s-Manifeste, CloudFormation/SAM, Agent-Settings).
 */
import { isMap, isScalar, isSeq } from 'yaml';
import type { LineCounter, Node as YamlNode, Pair, YAMLMap, YAMLSeq } from 'yaml';

export function mapValue(mapNode: YAMLMap | null, key: string): YamlNode | null {
    if (!mapNode) return null;
    const matchingPair = mapNode.items.find(
        (pair: Pair) => isScalar(pair.key) && pair.key.value === key,
    );
    return (matchingPair?.value as YamlNode | undefined) ?? null;
}

export function asMap(node: YamlNode | null): YAMLMap | null {
    return isMap(node) ? node : null;
}

export function asSeq(node: YamlNode | null): YAMLSeq | null {
    return isSeq(node) ? node : null;
}

export function scalarBool(mapNode: YAMLMap | null, key: string): boolean | null {
    const valueNode = mapValue(mapNode, key);
    return isScalar(valueNode) && typeof valueNode.value === 'boolean' ? valueNode.value : null;
}

/** String-Wert eines Skalars (auch getaggt, z. B. `!Sub …`), sonst null. */
export function scalarString(node: YamlNode | null): string | null {
    return isScalar(node) && typeof node.value === 'string' ? node.value : null;
}

/** Ein Skalar oder eine Sequenz von Skalaren als Strings (Nicht-Strings werden verworfen). */
export function scalarStrings(node: YamlNode | null): readonly string[] {
    const single = scalarString(node);
    if (single !== null) return [single];
    if (!isSeq(node)) return [];
    return node.items.flatMap((item) => {
        const itemString = scalarString(item as YamlNode);
        return itemString === null ? [] : [itemString];
    });
}

export function mapEntries(mapNode: YAMLMap | null): readonly { readonly key: string; readonly value: YamlNode | null }[] {
    if (!mapNode) return [];
    return mapNode.items.flatMap((pair: Pair) => (isScalar(pair.key)
        ? [{ key: String(pair.key.value), value: (pair.value as YamlNode | null) ?? null }]
        : []));
}

export function lineOfNode(lineCounter: LineCounter, node: YamlNode | null): number {
    return lineCounter.linePos(node?.range?.[0] ?? 0).line;
}
