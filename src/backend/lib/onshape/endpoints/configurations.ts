import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { OnshapeConfigurationResponse } from "../types";

export function getConfiguration(
    client: OnshapeApi,
    elementPath: ElementPath
): Promise<OnshapeConfigurationResponse> {
    return client.get(
        `/elements${toElementApiPath(elementPath)}/configuration`
    );
}
