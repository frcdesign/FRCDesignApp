import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";

/** A blob element's (a file tab's) file, as text. */
export async function getBlobText(
    client: OnshapeApi,
    elementPath: ElementPath
): Promise<string> {
    const res = await client.getRaw(
        `/blobelements${toElementApiPath(elementPath)}`,
        { accept: "*/*" }
    );
    return res.text();
}
