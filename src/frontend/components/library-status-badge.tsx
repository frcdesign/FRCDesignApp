import { Badge, type MantineSize } from "@mantine/core";
import { ReactNode } from "react";
import { getLibraryStatus } from "../lib/library";

interface LibraryStatusBadgeProps {
    libraryId: string;
    /** Beside a page title rather than in a menu row. @default xs */
    size?: MantineSize;
}

/**
 * Where a library is in its life — beta, deprecated — and nothing at all for one
 * that is simply supported.
 */
export function LibraryStatusBadge(props: LibraryStatusBadgeProps): ReactNode {
    const status = getLibraryStatus(props.libraryId);
    if (!status) {
        return null;
    }
    return (
        <Badge size={props.size ?? "xs"} variant="light">
            {status}
        </Badge>
    );
}
