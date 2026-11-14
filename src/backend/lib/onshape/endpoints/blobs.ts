import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementPath, toElementApiPath } from "../path";

/** The file an image-and-file (blob) tab holds, as uploaded. */
export function downloadBlob(
    client: OnshapeApi,
    elementPath: ElementPath
): Promise<Response> {
    assertInstanceType(elementPath, "w", "v");
    return client.getRaw(`/blobelements${toElementApiPath(elementPath)}`);
}
