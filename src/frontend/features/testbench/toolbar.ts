/**
 * Onshape's custom toolbar, through the internal endpoints its web client calls
 * (see docs/ONSHAPE.md, Toolbar). Shapes are as observed, nothing documented.
 */
import type { OnshapeCallBody } from "@backend/features/testbench/contract";

/** A tool as `GET /toolbar/tools` lists it; Onshape sends more. */
export interface ToolbarTool {
    id: string;
    name: string;
    command: string;
    namespace?: string;
    signature?: string;
    commandDetails?: string;
    /** 0 for the user's own, 2 for Onshape's built-in tools. */
    ownerType: number;
    ownerId: string;
}

export interface ToolbarToolList {
    items: ToolbarTool[];
}

export const USER_OWNER_TYPE = 0;

export function listToolsCall(version: number): OnshapeCallBody {
    return { method: "GET", version, path: "/toolbar/tools" };
}

export function createToolsCall(
    version: number,
    userId: string,
    body: unknown
): OnshapeCallBody {
    return {
        method: "POST",
        version,
        path: `/toolbar/tools/u/${userId}/create`,
        body
    };
}

export function deleteToolsCall(
    version: number,
    userId: string,
    ids: string[]
): OnshapeCallBody {
    return {
        method: "DELETE",
        version,
        path: `/toolbar/tools/u/${userId}/delete`,
        body: { remove: ids }
    };
}

/** A captured create from Onshape's web client: Assembly mirror, from a released version. */
export const SAMPLE_CREATE_BODY = {
    parentId: "5eace9159a3e06100d1208e0",
    specsExist: false,
    tools: [
        {
            insertableId: "6adb66eb1d292ad9e33035f6",
            tool: {
                command: "assemblyMirror",
                commandDetails:
                    "d9cffa92db8b62219498f89af::v38daeb3cf073855121a45135::e08d979fd160c98ce2a5dfad6::maa0f1fea276d08c7e82aefc2",
                context: 0,
                featureSpecName: "Assembly mirror",
                fsVersion: 2615,
                iconInitials: "Am",
                iconUri:
                    "/d/00dd11dabe44da2db458f898/w/workspaceId/e/233760ca14ddd2085de9c219/em/f7c25b250b6b31d37d4e95ff",
                isComputedPropertyTable: false,
                isTable: false,
                name: "Assembly mirror",
                namespace: "CREATE_FEATURE",
                nodeType: 4,
                ownerType: 0,
                signature:
                    "d9cffa92db8b62219498f89af::v38daeb3cf073855121a45135::e08d979fd160c98ce2a5dfad6::maa0f1fea276d08c7e82aefc2::assemblyMirror",
                tooltipKey: "Assembly mirror"
            }
        }
    ]
};

/** A listed tool as a create would send it: without what Onshape assigns. */
export function toCreatedTool(tool: ToolbarTool): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(tool).filter(
            ([key]) => key !== "id" && key !== "ownerId"
        )
    );
}
