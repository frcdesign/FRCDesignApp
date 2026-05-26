import { Configuration } from "../../shared/configuration-models";

export function encodeConfigurationForQuery(
    configuration?: Configuration
): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}
