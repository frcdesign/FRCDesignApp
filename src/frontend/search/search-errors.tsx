import { Alert, Button, Group } from "@mantine/core";
import { IconHeartBroken, IconSearch } from "@tabler/icons-react";
import { ReactNode } from "react";
import { ClearFiltersButton } from "../navbar/vendor-filters";
import { FilterResult, ObjectLabel, plural } from "./search";
import { useNavigate } from "@tanstack/react-router";
import { SectionError } from "../common/app-zero-state";

function getDocumentString(filtered: FilterResult, objectLabel: ObjectLabel) {
    if (filtered.byDocument > 1) {
        return `${filtered.byDocument} ${plural(
            objectLabel
        )} are in other documents.`;
    }
    return `1 ${objectLabel} is in another document.`;
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
 * A callout which renders whenever there are items hidden by filters.
 */
export function SearchCallout(props: FilterCalloutProps): ReactNode {
    const { filtered, objectLabel } = props;
    if (filtered.byDocument === 0 && filtered.byVendor === 0) {
        return null;
    }

    if (filtered.byDocument > 0) {
        return (
            <Alert p="xs">
                <Group justify="space-between" wrap="nowrap">
                    {getDocumentString(filtered, objectLabel)}
                    <SearchAllButton small />
                </Group>
            </Alert>
        );
    }
    return (
        <Alert p="xs">
            <Group justify="space-between" wrap="nowrap">
                {getVendorString(filtered, objectLabel)}
                <ClearFiltersButton small />
            </Group>
        </Alert>
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
            <IconSearch size={36} color="var(--mantine-color-blue-6)" />
        ) : (
            <IconHeartBroken size={36} color="var(--mantine-color-red-6)" />
        );

    if (filtered.byDocument > 0) {
        // User is in a subdocument
        return (
            <SectionError
                icon={icon}
                title={`No ${plural(objectLabel)}.`}
                description={getDocumentString(filtered, objectLabel)}
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
    const small = props.small ?? false;
    return (
        <Button
            leftSection={<IconSearch size={16} />}
            size={small ? "xs" : undefined}
            onClick={() => {
                void navigate({ to: "/app/documents" });
            }}
        >
            Search all documents
        </Button>
    );
}
