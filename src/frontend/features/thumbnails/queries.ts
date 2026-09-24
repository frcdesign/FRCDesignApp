import { useIsFetching } from "@tanstack/react-query";
import { renderQueryPrefix } from "../../lib/query-keys";

/** One fetch waits out the whole render, so this doesn't flicker. */
export function useIsThumbnailRendering(): boolean {
    return useIsFetching({ queryKey: renderQueryPrefix() }) > 0;
}
