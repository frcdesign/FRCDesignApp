import { Button } from "@mantine/core";
import {
    FunnelXIcon,
    HeartBreakIcon,
    MagnifyingGlassIcon
} from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { ReactNode } from "react";
import { Callout, CalloutButton } from "../../../components/callout";
import {
    ClearFiltersButton,
    useClearVendorFilters
} from "../../settings/components/vendor-filters";
import { FilterResult } from "../search";

/** What a narrowed-down list is called to the user. */
type ObjectLabel = "element" | "favorite" | "search result";

function plural(objectLabel: ObjectLabel): string {
    return objectLabel + "s";
}
import { useNavigate } from "@tanstack/react-router";
import { SectionNotice } from "../../../components/app-notice";
import { useLibraryId } from "../../../lib/library";
import { AppIcon } from "../../../components/app-icon";

function getGroupString(filtered: FilterResult, objectLabel: ObjectLabel) {
    if (filtered.byGroup > 1) {
        return `${filtered.byGroup} ${plural(
            objectLabel
        )} are in other groups.`;
    }
    return `1 ${objectLabel} is in another group.`;
}

function getVendorString(filtered: FilterResult, objectLabel: ObjectLabel) {
    if (filtered.byVendor > 1) {
        return `${filtered.byVendor} ${plural(
            objectLabel
        )} are currently hidden by filters.`;
    }
    return `1 ${objectLabel} is hidden by filters.`;
}

interface FilterCalloutProps {
    objectLabel: ObjectLabel;
    filtered: FilterResult;
}

export function SearchCallout(props: FilterCalloutProps): ReactNode {
    const { filtered, objectLabel } = props;
    const searchAllDocuments = useSearchAllDocuments();
    const clearVendorFilters = useClearVendorFilters();

    if (filtered.byGroup === 0 && filtered.byVendor === 0) {
        return null;
    }

    if (filtered.byGroup > 0) {
        return (
            <Callout
                text={getGroupString(filtered, objectLabel)}
                action={
                    <CalloutButton
                        icon={<MagnifyingGlassIcon size={IconSize.SMALL} />}
                        onClick={searchAllDocuments}
                    >
                        Search all
                    </CalloutButton>
                }
            />
        );
    }
    return (
        <Callout
            text={getVendorString(filtered, objectLabel)}
            action={
                <CalloutButton
                    icon={<FunnelXIcon size={IconSize.SMALL} />}
                    onClick={clearVendorFilters}
                >
                    Clear filters
                </CalloutButton>
            }
        />
    );
}

interface NoSearchResultErrorProps {
    objectLabel: Extract<ObjectLabel, "search result" | "favorite">;
    filtered: FilterResult;
}

export function NoSearchResultError(
    props: NoSearchResultErrorProps
): ReactNode {
    const { objectLabel, filtered } = props;

    const icon =
        objectLabel === "search result" ? (
            <AppIcon
                icon={MagnifyingGlassIcon}
                size={IconSize.SECTION}
                color={StatusColor.WARNING}
            />
        ) : (
            <AppIcon
                icon={HeartBreakIcon}
                size={IconSize.SECTION}
                color={StatusColor.ERROR}
            />
        );

    if (filtered.byGroup > 0) {
        return (
            <SectionNotice
                icon={icon}
                title={`No ${plural(objectLabel)}.`}
                description={getGroupString(filtered, objectLabel)}
                action={<SearchAllButton />}
            />
        );
    } else if (filtered.byVendor > 0) {
        return (
            <SectionNotice
                icon={icon}
                title={`No ${plural(objectLabel)}.`}
                description={getVendorString(filtered, objectLabel)}
                action={<ClearFiltersButton />}
            />
        );
    }
    return <SectionNotice icon={icon} title={`No ${plural(objectLabel)}`} />;
}

/** Leaves a group's search for the one across the whole library. */
function useSearchAllDocuments(): () => void {
    const navigate = useNavigate();
    const libraryId = useLibraryId();
    return () =>
        void navigate({
            to: "/app/library/$libraryId",
            params: { libraryId }
        });
}

function SearchAllButton(): ReactNode {
    const searchAllDocuments = useSearchAllDocuments();
    return (
        <Button
            leftSection={<MagnifyingGlassIcon />}
            onClick={searchAllDocuments}
        >
            Search all documents
        </Button>
    );
}
