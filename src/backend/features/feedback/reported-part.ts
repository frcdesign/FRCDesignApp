import { and, eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { configurations, groups, insertables } from "../../db/schema";
import { type LibraryId } from "../library/library-id";
import { type ElementPath, toElementPath } from "../../lib/onshape/path";
import {
    ParameterType,
    type ConfigurationParameter,
    type PartialSelection,
    type Selection
} from "../configurations/contract";
import { onshapeOverrides, toSelection } from "../configurations/selection";
import {
    encodeQueryConfiguration,
    evaluateCondition,
    getOption
} from "../configurations/utils";
import { type ReportedPart } from "./discord";

/** Links open on cad's own domain: a reporter's company domain means nothing to a reader. */
const ONSHAPE_ORIGIN = "https://cad.onshape.com";

export interface FoundPart extends ReportedPart {
    path: ElementPath;
    insertableId: string;
}

/** The value as entered, but an enum by its option's name and a checkbox as Yes or No. */
function describeValue(
    parameter: ConfigurationParameter,
    value: string
): string {
    switch (parameter.type) {
        case ParameterType.ENUM:
            return getOption(parameter.options, value)?.name ?? value;
        case ParameterType.BOOLEAN:
            return value === "true" ? "Yes" : "No";
        case ParameterType.QUANTITY:
        case ParameterType.STRING:
            return value;
    }
}

/** What the reporter could see: a hidden parameter is never applied. */
export function describeSelection(
    selection: Selection,
    parameters: ConfigurationParameter[]
): string[] {
    return parameters
        .filter((parameter) =>
            evaluateCondition(parameter.condition, selection, parameters)
        )
        .map(
            (parameter) =>
                `${parameter.name}: ${describeValue(parameter, selection[parameter.id])}`
        );
}

export function partUrl(path: ElementPath, overrides?: PartialSelection) {
    let url = `${ONSHAPE_ORIGIN}/documents/${path.documentId}/${path.instanceType}/${path.instanceId}/e/${path.elementId}`;
    const encoded = encodeQueryConfiguration(overrides);
    if (encoded) {
        // Onshape unwraps exactly this one layer of escaping.
        url += "?configuration=" + encodeURIComponent(encoded);
    }
    return url;
}

/** Undefined when the part isn't in `libraryId`, so a report can't name another library's. */
export async function findReportedPart(
    db: Db,
    libraryId: LibraryId,
    insertableId: string,
    requested: PartialSelection | undefined
): Promise<FoundPart | undefined> {
    const row = await db
        .select({
            name: insertables.name,
            elementId: insertables.elementId,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            groupName: groups.name,
            parameters: configurations.parameters
        })
        .from(insertables)
        .innerJoin(groups, eq(groups.id, insertables.groupId))
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(
            and(
                eq(insertables.id, insertableId),
                eq(insertables.libraryId, libraryId)
            )
        )
        .get();
    if (!row) return undefined;

    const path = toElementPath(row);
    const parameters = row.parameters ?? [];
    const found: FoundPart = {
        insertableId,
        path,
        name: row.name,
        groupName: row.groupName,
        url: partUrl(path)
    };
    if (!requested || parameters.length === 0) {
        return found;
    }
    const selection = toSelection(requested, parameters);
    return {
        ...found,
        url: partUrl(path, onshapeOverrides(selection, parameters)),
        configuration: describeSelection(selection, parameters)
    };
}
