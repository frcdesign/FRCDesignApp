import {
    Button,
    Callout,
    Colors,
    IconName,
    Intent,
    Size
} from "@blueprintjs/core";
import { ClearFiltersButton } from "../navbar/vendor-filters";
import { FilterResult, ObjectLabel, plural } from "./search";
import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppErrorState } from "../common/app-zero-state";

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
            <Callout intent="primary" className="split">
                {getDocumentString(filtered, objectLabel)}
                <SearchAllButton small />
            </Callout>
        );
    }
    return (
        <Callout intent="primary" className="split">
            {getVendorString(filtered, objectLabel)}
            <ClearFiltersButton small />
        </Callout>
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

    let icon: IconName;
    let iconIntent: Intent | undefined = undefined;
    let iconColor = undefined;

    if (objectLabel === "search result") {
        icon = "search";
        iconIntent = Intent.PRIMARY;
    } else {
        icon = "heart-broken";
        iconColor = Colors.RED3;
    }

    if (filtered.byDocument > 0) {
        return (
            <AppErrorState
                icon={icon}
                iconIntent={iconIntent}
                iconColor={iconColor}
                title={`No ${plural(objectLabel)}.`}
                description={getDocumentString(filtered, objectLabel)}
                action={<SearchAllButton />}
            />
        );
    } else if (filtered.byVendor > 0) {
        return (
            <AppErrorState
                icon={icon}
                iconIntent={iconIntent}
                iconColor={iconColor}
                title={`No ${plural(objectLabel)}.`}
                description={getVendorString(filtered, objectLabel)}
                action={<ClearFiltersButton />}
            />
        );
    }
    return (
        <AppErrorState
            icon={icon}
            iconIntent={iconIntent}
            iconColor={iconColor}
            title={`No ${plural(objectLabel)}`}
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
            intent="primary"
            text="Search all documents"
            icon="search"
            size={small ? Size.SMALL : Size.MEDIUM}
            onClick={() => navigate({ to: "/app/documents" })}
        />
    );
}
