import { useIsFetching } from "@tanstack/react-query";
import { renderQueryPrefix } from "../../lib/query-keys";

/**
 * Whether a render the insert preview asked for is still being waited on. The
 * polling is one fetch retrying, so this stays true across the gaps between
 * polls rather than flickering with each one.
 */
export function useIsThumbnailRendering(): boolean {
    return useIsFetching({ queryKey: renderQueryPrefix() }) > 0;
}
