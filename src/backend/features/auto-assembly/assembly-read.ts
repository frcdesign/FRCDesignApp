/**
 * The assembly as Auto Assembly reads it: its definition, cached by what pins
 * the assembly tab, and the microversions of its own workspace's tabs. A check,
 * the insert after it and a run's index read the definition once between edits
 * to the assembly or what it references.
 */
import { kvStore, putQuietly } from "../../lib/kv-store";
import { type OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { type ElementPath } from "../../lib/onshape/path";
import { pinElement } from "../../lib/onshape/pin";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";
import { type ElementMicroversions } from "./assembly";

const DEFINITION_OPTIONS = { excludeSuppressed: true };

/** In the cache id, as other options answer a different definition. */
const OPTIONS_KEY = JSON.stringify(DEFINITION_OPTIONS);

/** A week: a pin is never stale, so this only bounds what's kept of assemblies edited since. */
const DEFINITION_TTL_SECONDS = 7 * 24 * 60 * 60;

const definitions = kvStore<OnshapeAssemblyDefinition>(
    "auto-assembly-assembly",
    { ttlSeconds: DEFINITION_TTL_SECONDS }
);

export interface AssemblyRead {
    definition: OnshapeAssemblyDefinition;
    /** Each tab of the assembly's own workspace, by element id; empty outside a workspace. */
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

/** The definition from the cache when the assembly tab hasn't changed since it was last read. */
export async function readAssembly(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath
): Promise<AssemblyRead> {
    const { pin, microversions } = await pinElement(client, assembly);
    const id = pin && `${pin}|${OPTIONS_KEY}`;
    const cached = id ? await definitions.get(kv, id) : undefined;
    if (cached) {
        return { definition: cached, microversions };
    }
    const definition = await getAssembly(client, assembly, DEFINITION_OPTIONS);
    if (id) {
        await putQuietly(definitions, kv, id, definition);
    }
    return { definition, microversions };
}
