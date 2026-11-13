/** What the design check can change in a document, made as the caller so Onshape refuses anyone who can't edit it. */
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { type OnshapeApi } from "../../lib/onshape/client";
import {
    addAssemblyFeature,
    deleteInstance,
    getAssembly
} from "../../lib/onshape/endpoints/assemblies";
import {
    getFeatures,
    moveRollbackBar
} from "../../lib/onshape/endpoints/part-studios";
import {
    fastenMateToOrigin,
    partStudioMateConnectorQuery
} from "../../lib/onshape/objects/assembly-features";
import { type ElementPath } from "../../lib/onshape/path";
import { type OnshapeAssemblyInstance } from "../../lib/onshape/types";
import { isOriginCube } from "./checks";
import { type DesignFixIn, DesignIssueFix } from "./contract";

/** What the fasten is called in the Assembly's list. */
const ORIGIN_CUBE_FASTEN_NAME = "Origin Cube";

export async function applyFix(
    client: OnshapeApi,
    fix: DesignFixIn
): Promise<void> {
    const path: ElementPath = {
        documentId: fix.documentId,
        instanceType: "w",
        instanceId: fix.instanceId,
        elementId: fix.elementId
    };
    switch (fix.fix) {
        case DesignIssueFix.MOVE_ROLLBACK_TO_END:
            return moveRollbackBar(client, path, -1);
        case DesignIssueFix.DELETE_INSTANCE:
            return deleteInstance(client, path, requireInstanceId(fix));
        case DesignIssueFix.FASTEN_ORIGIN_CUBE:
            return fastenOriginCube(client, path, requireInstanceId(fix));
    }
}

function requireInstanceId(fix: DesignFixIn): string {
    if (!fix.assemblyInstanceId) {
        throw handledError("Name the instance to fix.", HttpStatus.BAD_REQUEST);
    }
    return fix.assemblyInstanceId;
}

/**
 * Fastens the cube to the origin by the mate connector the Origin Cube makes,
 * `{featureId}.mateConnector1` in its Part Studio, read at the version or
 * microversion the instance came from.
 */
async function fastenOriginCube(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    instanceId: string
): Promise<void> {
    const definition = await getAssembly(client, assemblyPath);
    const instance = definition.rootAssembly.instances.find(
        (each) => each.id === instanceId
    );
    const source = instance && sourcePath(instance);
    if (!source) {
        throw handledError(
            "That instance is no longer in the Assembly.",
            HttpStatus.NOT_FOUND
        );
    }
    const cube = (await getFeatures(client, source)).features.find(
        isOriginCube
    );
    if (!cube) {
        throw handledError(
            "The Origin Cube's Part Studio no longer has the Origin Cube.",
            HttpStatus.NOT_FOUND
        );
    }
    await addAssemblyFeature(
        client,
        assemblyPath,
        fastenMateToOrigin(
            ORIGIN_CUBE_FASTEN_NAME,
            partStudioMateConnectorQuery(`${cube.featureId}.mateConnector1`, [
                instanceId
            ])
        )
    );
}

/** The Part Studio an instance came from, as it was when inserted or last updated. */
function sourcePath(
    instance: OnshapeAssemblyInstance
): ElementPath | undefined {
    const { documentId, elementId, documentVersion, documentMicroversion } =
        instance;
    if (!documentId || !elementId) {
        return undefined;
    }
    if (documentVersion) {
        return {
            documentId,
            instanceType: "v",
            instanceId: documentVersion,
            elementId
        };
    }
    if (documentMicroversion) {
        return {
            documentId,
            instanceType: "m",
            instanceId: documentMicroversion,
            elementId
        };
    }
    return undefined;
}
