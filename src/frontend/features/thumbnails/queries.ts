import { useIsFetching } from "@tanstack/react-query";
import { renderQueryPrefix } from "../../lib/query-keys";
import type { ConfigurationKey } from "@backend/features/configurations/contract";
import type {
    RenderOut,
    RenderStatus
} from "@backend/features/thumbnails/contract";
import { apiPost } from "../../lib/api-client";
import { toInsertablePath } from "../../lib/api-paths";

/** One fetch waits out the whole render, so this doesn't flicker. */
export function useIsThumbnailRendering(): boolean {
    return useIsFetching({ queryKey: renderQueryPrefix() }) > 0;
}

/** Asks the server to render a configuration the stored route missed. */
export async function startRender(
    insertableId: string,
    configurationKey: ConfigurationKey
): Promise<RenderStatus> {
    const out = await apiPost<RenderOut>(
        "/render-thumbnail" + toInsertablePath(insertableId),
        { body: { configurationKey } }
    );
    return out.status;
}
