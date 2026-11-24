/**
 * The assembly as Auto Assembly reads it: its definition, and the microversions
 * of its own workspace's Part Studios, cached by what pins the assembly. A
 * check, the insert after it and a run's index read it once between edits.
 */
import { kvStore, putQuietly } from "../../lib/kv-store";
import { type OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { getElements } from "../../lib/onshape/endpoints/documents";
import { type ElementPath } from "../../lib/onshape/path";
import { pinElement } from "../../lib/onshape/pin";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance,
    OnshapeElementType
} from "../../lib/onshape/types";
import { type ElementMicroversions, isLocal } from "./assembly";

const DEFINITION_OPTIONS = { excludeSuppressed: true };

/** In the cache id, as other options answer a different definition. */
const OPTIONS_KEY = JSON.stringify(DEFINITION_OPTIONS);

/** A week: a pin is never stale, so this only bounds what's kept of assemblies edited since. */
const READ_TTL_SECONDS = 7 * 24 * 60 * 60;

interface StoredRead {
    definition: OnshapeAssemblyDefinition;
    /** By element id; empty when no part comes from the assembly's own workspace. */
    microversions: Record<string, string>;
}

const assemblyReads = kvStore<StoredRead>("auto-assembly-assembly", {
    ttlSeconds: READ_TTL_SECONDS
});

export interface AssemblyRead {
    definition: OnshapeAssemblyDefinition;
    microversions: ElementMicroversions;
}

/** Every instance, in the root and in each subassembly. */
export function assemblyInstances(
    definition: OnshapeAssemblyDefinition
): OnshapeAssemblyInstance[] {
    return [
        ...definition.rootAssembly.instances,
        ...definition.subAssemblies.flatMap((sub) => sub.instances ?? [])
    ];
}

async function localMicroversions(
    client: OnshapeApi,
    assembly: ElementPath,
    definition: OnshapeAssemblyDefinition
): Promise<Record<string, string>> {
    const anyLocal = assemblyInstances(definition).some(
        (instance) => instance.type === "Part" && isLocal(instance, assembly)
    );
    if (!anyLocal) {
        return {};
    }
    const elements = await getElements(
        client,
        assembly,
        OnshapeElementType.PART_STUDIO
    );
    return Object.fromEntries(
        elements.map((element) => [element.id, element.microversionId])
    );
}

/** From the cache when nothing in the document has changed since it was last read. */
export async function readAssembly(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath
): Promise<AssemblyRead> {
    const pin = await pinElement(client, assembly);
    const id = pin && `${pin}|${OPTIONS_KEY}`;
    let stored = id ? await assemblyReads.get(kv, id) : undefined;
    if (!stored) {
        const definition = await getAssembly(
            client,
            assembly,
            DEFINITION_OPTIONS
        );
        stored = {
            definition,
            microversions: await localMicroversions(
                client,
                assembly,
                definition
            )
        };
        if (id) {
            await putQuietly(assemblyReads, kv, id, stored);
        }
    }
    return {
        definition: stored.definition,
        microversions: new Map(Object.entries(stored.microversions))
    };
}
