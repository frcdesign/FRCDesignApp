import { Alert, Box, Button, Group, Text } from "@mantine/core";
import { HeartBreak, Info, MagnifyingGlass } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode } from "react";
import { ClearFiltersButton } from "../../settings/components/vendor-filters";
import { FilterResult, ObjectLabel, plural } from "../search";
import { useNavigate } from "@tanstack/react-router";
import { SectionError } from "../../../components/app-zero-state";
import { useLibraryId } from "../../library/library-path";

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

/**
 * Blue rather than the library accent: the strip reports on the results, so it
 * should read as a note beside them rather than as part of the library.
 */
function Callout(props: { text: string; action: ReactNode }): ReactNode {
    return (
        <Alert
            color="blue"
            p="xs"
            icon={<Info size={IconSize.MEDIUM} />}
            styles={{ body: { minWidth: 0 } }}
        >
            <Group justify="space-between" wrap="nowrap" gap="sm">
                <Text size="sm">{props.text}</Text>
                {props.action}
            </Group>
        </Alert>
    );
}

/**
 * A callout which renders whenever there are items hidden by filters.
 */
export function SearchCallout(props: FilterCalloutProps): ReactNode {
    const { filtered, objectLabel } = props;
    if (filtered.byGroup === 0 && filtered.byVendor === 0) {
        return null;
    }

    if (filtered.byGroup > 0) {
        return (
            <Callout
                text={getGroupString(filtered, objectLabel)}
                action={<SearchAllButton small />}
            />
        );
    }
    return (
        <Callout
            text={getVendorString(filtered, objectLabel)}
            action={<ClearFiltersButton small />}
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
            <Box
                component={MagnifyingGlass}
                size={IconSize.SECTION}
                c="yellow"
            />
        ) : (
            <Box component={HeartBreak} size={IconSize.SECTION} c="red" />
        );

    if (filtered.byGroup > 0) {
        // User is in a subgroup
        return (
            <SectionError
                icon={icon}
                title={`No ${plural(objectLabel)}.`}
                description={getGroupString(filtered, objectLabel)}
                action={<SearchAllButton />}
            />
        );
    } else if (filtered.byVendor > 0) {
        // User has vendor filters selected
        return (
            <SectionError
                icon={icon}
                title={`No ${plural(objectLabel)}.`}
                description={getVendorString(filtered, objectLabel)}
                action={<ClearFiltersButton />}
            />
        );
    }
    // User has a bad search query
    return (
        <SectionError
            icon={icon}
            title={`No ${plural(objectLabel)}`}
            description={null}
        />
    );
}

interface SearchAllButtonProps {
    /**
     * @default false
     */
    small?: boolean;
}

function SearchAllButton(props: SearchAllButtonProps): ReactNode {
    const navigate = useNavigate();
    const libraryId = useLibraryId();
    const small = props.small ?? false;
    return (
        <Button
            leftSection={<MagnifyingGlass size={IconSize.SMALL} />}
            // Small means inside the callout, where a filled button would
            // shout over the note it sits in.
            variant={small ? "default" : undefined}
            size={small ? "xs" : undefined}
            onClick={() => {
                void navigate({
                    to: "/app/library/$libraryId",
                    params: { libraryId }
                });
            }}
        >
            Search all documents
        </Button>
    );
}
