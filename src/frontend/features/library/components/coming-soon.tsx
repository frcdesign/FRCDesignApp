import { Box } from "@mantine/core";
import { HammerIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, PrimaryColor } from "../../../lib/style-constants";
import { PageMessage } from "../../../components/app-zero-state";
import { getLibraryName, useLibraryId } from "../library-path";

/** Stands in for a library that is announced but has nothing to show yet. */
export function ComingSoon(): ReactNode {
    const libraryId = useLibraryId();
    return (
        <PageMessage
            icon={
                <Box
                    component={HammerIcon}
                    size={IconSize.PAGE}
                    c={PrimaryColor.FILLED}
                />
            }
            title={`${getLibraryName(libraryId)} is coming soon`}
            description="It is still being put together. Check back soon!"
        />
    );
}
