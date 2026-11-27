/**
 * Which copies of a library part an edit replaces, read from the assembly's
 * definition, and what each becomes. Pure.
 */
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";
import {
    type PickProblem,
    ProblemSeverity,
    type SelectedEntity
} from "../auto-assembly/contract";
import {
    type ConfigurationParameter,
    type PartialSelection,
    type Selection
} from "../configurations/contract";
import {
    applyChanges,
    canonicalValues,
    toSelection
} from "../configurations/selection";
import { decodeConfiguration } from "../configurations/utils";

/** The tab a library part is, wherever its copies are pinned. */
export interface PartSource {
    documentId: string;
    elementId: string;
}

/** One insert of the part: the instances it placed, where, and as what. */
export interface Copy {
    /** Several for a Part Studio of several parts, placed together. */
    instanceIds: string[];
    transform: number[];
    selection: Selection;
    /** Its configuration, spelled for comparing. */
    configurationKey: string;
}

/** A copy and the configuration the edit gives it. */
export interface EditTarget {
    copy: Copy;
    selection: Selection;
}

export interface EditPlan {
    targets: EditTarget[];
    pickedCount: number;
    /** Copies whose configuration matches a pick's, the picks included. */
    matchingCount: number;
    problems: PickProblem[];
}

export function problemKey(part: SelectedEntity): string {
    return `${part.occurrencePath.join("/")}|${part.entityId}`;
}

/** The top-level instance a pick is on, or in. */
export function topInstance(
    definition: OnshapeAssemblyDefinition,
    part: SelectedEntity
): OnshapeAssemblyInstance | undefined {
    return definition.rootAssembly.instances.find(
        (instance) => instance.id === part.occurrencePath[0]
    );
}

function isFrom(instance: OnshapeAssemblyInstance, source: PartSource) {
    return (
        instance.documentId === source.documentId &&
        instance.elementId === source.elementId
    );
}

/** Every copy of the part at the assembly's top level. */
export function copiesOf(
    definition: OnshapeAssemblyDefinition,
    source: PartSource,
    parameters: ConfigurationParameter[]
): Copy[] {
    const transforms = new Map(
        (definition.rootAssembly.occurrences ?? [])
            .filter((occurrence) => occurrence.path.length === 1)
            .map((occurrence) => [occurrence.path[0], occurrence.transform])
    );
    const copies = new Map<string, Copy>();
    for (const instance of definition.rootAssembly.instances) {
        const transform = transforms.get(instance.id);
        if (!isFrom(instance, source) || !transform) {
            continue;
        }
        const selection = toSelection(
            decodeConfiguration(instance.configuration ?? ""),
            parameters
        );
        const configurationKey = JSON.stringify(
            canonicalValues(selection, parameters)
        );
        // Parts placed together share a configuration and a place.
        const key = `${configurationKey}|${transform.join(",")}`;
        const copy = copies.get(key);
        if (copy) {
            copy.instanceIds.push(instance.id);
        } else {
            copies.set(key, {
                instanceIds: [instance.id],
                transform,
                selection,
                configurationKey
            });
        }
    }
    return [...copies.values()];
}

interface PlanEditArgs {
    definition: OnshapeAssemblyDefinition;
    source: PartSource;
    parameters: ConfigurationParameter[];
    parts: SelectedEntity[];
    changes: PartialSelection;
    applyToAll: boolean;
}

/**
 * The picks' copies, widened to every copy configured like one of them when
 * asked, each with what the changes make of it. A pick that isn't a copy of
 * the part, or whose configuration can't take the changes, is a problem and
 * left alone.
 */
export function planEdit(args: PlanEditArgs): EditPlan {
    const { definition, source, parameters, parts, changes, applyToAll } = args;
    const copies = copiesOf(definition, source, parameters);
    const problems: PickProblem[] = [];
    const picked = new Set<Copy>();
    for (const part of parts) {
        const copy = copies.find((each) =>
            each.instanceIds.includes(part.occurrencePath[0])
        );
        if (!copy) {
            problems.push({
                key: problemKey(part),
                message: topInstance(definition, part)?.documentId
                    ? "A different part"
                    : "Not found in the assembly",
                severity: ProblemSeverity.ERROR
            });
            continue;
        }
        if (applyChanges(copy.selection, changes, parameters) === undefined) {
            problems.push({
                key: problemKey(part),
                message: "Its configuration can't take this change",
                severity: ProblemSeverity.ERROR
            });
        }
        picked.add(copy);
    }
    const configurations = new Set(
        [...picked].map((copy) => copy.configurationKey)
    );
    const matching = copies.filter((copy) =>
        configurations.has(copy.configurationKey)
    );
    const targets = (applyToAll ? matching : [...picked]).flatMap((copy) => {
        const selection = applyChanges(copy.selection, changes, parameters);
        return selection ? [{ copy, selection }] : [];
    });
    return {
        targets,
        pickedCount: picked.size,
        matchingCount: matching.length,
        problems
    };
}
