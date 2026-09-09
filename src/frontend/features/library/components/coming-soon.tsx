import { HammerIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { IconSize, PrimaryColor } from "../../../lib/style-constants";
import { PageNotice } from "../../../components/app-zero-state";
import { getLibraryName, useLibraryId } from "../library-path";
import { AppIcon } from "../../../components/app-icon";

/** Stands in for a library that is announced but has nothing to show yet. */
export function ComingSoon(): ReactNode {
    const libraryId = useLibraryId();
    return (
        <PageNotice
            icon={
                <AppIcon
                    icon={HammerIcon}
                    size={IconSize.PAGE}
                    color={PrimaryColor.FILLED}
                />
            }
            title="Under construction"
            description={`${getLibraryName(libraryId)} is coming soon!`}
        />
    );
}
