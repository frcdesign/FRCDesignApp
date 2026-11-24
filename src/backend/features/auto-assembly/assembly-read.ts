/**
 * The assembly as Auto Assembly and the insert location read it: its
 * definition, cached by what pins the assembly tab, and the microversions of
 * its own workspace's tabs. A check, the insert after it and a run's index read
 * the definition once between edits to the assembly or what it references.
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
import { type ElementMicroversions, pathKey } from "./assembly";

/** The insert location's marker is a sketch, so non-solids are read too; `partOccurrences` takes only parts. */
const DEFINITION_OPTIONS = { excludeSuppressed: true, includeNonSolids: true };

/** In the cache id, as other options answer a different definition. */
const OPTIONS_KEY = JSON.stringify(DEFINITION_OPTIONS);

/** A week: a pin is never stale, so this only bounds what's kept of assemblies edited since. */
const DEFINITION_TTL_SECONDS = 7 * 24 * 60 * 60;

const definitions = kvStore<OnshapeAssemblyDefinition>(
    "auto-assembly-assembly",
    { ttlSeconds: DEFINITION_TTL_SECONDS }
);

/** The `definitions` id a workspace assembly was last read under, by its tab. */
const latestReads = kvStore<string>("auto-assembly-latest", {
    ttlSeconds: DEFINITION_TTL_SECONDS
});

export interface AssemblyRead {
    definition: OnshapeAssemblyDefinition;
    /** Each tab of the assembly's own workspace, by element id; empty outside a workspace. */
    microversions: ElementMicroversions;
    /** False when the definition is from an earlier edit, served for `holding`. */
    isCurrent: boolean;
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

function tabId(assembly: ElementPath): string {
    return `${assembly.documentId}|${assembly.instanceType}|${assembly.instanceId}|${assembly.elementId}`;
}

function hasOccurrences(
    definition: OnshapeAssemblyDefinition,
    paths: string[][]
): boolean {
    const present = new Set(
        (definition.rootAssembly.occurrences ?? []).map((occurrence) =>
            pathKey(occurrence.path)
        )
    );
    return paths.every((path) => present.has(pathKey(path)));
}

/**
 * The definition from the cache when the assembly tab hasn't changed since it
 * was last read. With `holding`, the last definition read of a workspace
 * assembly serves while it has every one of those occurrences, whatever was
 * edited since: an insert or drag moves the tab, and a pick needs only which
 * Part Studio its part is from.
 */
export async function readAssembly(
    client: OnshapeApi,
    kv: KVNamespace,
    assembly: ElementPath,
    holding?: string[][]
): Promise<AssemblyRead> {
    const { pin, microversions } = await pinElement(client, assembly);
    const id = pin && `${pin}|${OPTIONS_KEY}`;
    const cached = id ? await definitions.get(kv, id) : undefined;
    if (cached) {
        return { definition: cached, microversions, isCurrent: true };
    }
    if (holding && assembly.instanceType === "w") {
        const latestId = await latestReads.get(kv, tabId(assembly));
        const latest =
            latestId !== undefined
                ? await definitions.get(kv, latestId)
                : undefined;
        if (latest && hasOccurrences(latest, holding)) {
            return { definition: latest, microversions, isCurrent: false };
        }
    }
    const definition = await getAssembly(client, assembly, DEFINITION_OPTIONS);
    if (id) {
        await putQuietly(definitions, kv, id, definition);
        if (assembly.instanceType === "w") {
            await putQuietly(latestReads, kv, tabId(assembly), id);
        }
    }
    return { definition, microversions, isCurrent: true };
}
