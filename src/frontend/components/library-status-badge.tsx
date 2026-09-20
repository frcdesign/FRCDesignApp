import { Badge, type MantineSize } from "@mantine/core";
import { ReactNode } from "react";
import { getLibraryStatus } from "../lib/library";
import { StatusColor } from "../lib/style-constants";

interface LibraryStatusBadgeProps {
    libraryId: string;
    /** Beside a page title rather than in a menu row. @default xs */
    size?: MantineSize;
}

/**
 * Where a library is in its life — beta, deprecated — wherever it is named
 * outside its own page, and nothing at all for one that is simply supported.
 *
 * Gray rather than the app's accent: in a list of libraries the accent is the
 * current library's, not the row's, and blue is what marks a page as new.
 */
export function LibraryStatusBadge(props: LibraryStatusBadgeProps): ReactNode {
    const status = getLibraryStatus(props.libraryId);
    if (!status) {
        return null;
    }
    return (
        <Badge
            size={props.size ?? "xs"}
            variant="light"
            color={StatusColor.NEUTRAL}
        >
            {status}
        </Badge>
    );
}
