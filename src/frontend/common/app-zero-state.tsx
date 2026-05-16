import {
    Icon,
    Intent,
    NonIdealState,
    NonIdealStateIconSize,
    Spinner
} from "@blueprintjs/core";
import { IconName } from "@blueprintjs/icons";
import { ReactNode } from "react";

interface SectionLoadingProps {
    /**
     * This should take the form "Loading {thing}...".
     */
    title: string;
}

/**
 * Used to indicate a section of the UI is loading.
 */
export function SectionLoading(props: SectionLoadingProps): ReactNode {
    const { title } = props;

    return (
        <NonIdealState
            className="inline-app-loading-state"
            title={title}
            icon={<Spinner intent="primary" />}
        />
    );
}

interface ErrorProps {
    /**
     * The title should always end with a period when there's a description.
     */
    title: string;
    /**
     * If omitted, will default to "If the problem persists, contact the FRCDesignApp developers."
     *
     * Pass in null to override the default.
     */
    description?: string | null | JSX.Element;
    className?: string;
    /**
     * @default "cross"
     */
    icon?: IconName | JSX.Element;
    iconColor?: string;
    /**
     * @default "danger"
     */
    iconIntent?: Intent;
    action?: JSX.Element;
}

/**
 * Indicates an error with a section of the UI.
 */
export function SectionError(props: ErrorProps): ReactNode {
    const { title, action, className } = props;
    const icon = props.icon ?? "cross";
    const iconIntent = props.iconIntent ?? "danger";

    let description = props.description;
    if (description === undefined) {
        description =
            "If the problem persists, contact the FRCDesignApp developers.";
    }

    return (
        <NonIdealState
            className={className + " inline-app-error-state"}
            title={title}
            icon={
                <Icon
                    icon={icon}
                    intent={iconIntent}
                    color={props.iconColor}
                    size={NonIdealStateIconSize.SMALL}
                />
            }
            description={description}
            action={action}
        />
    );
}

interface PageErrorProps extends ErrorProps {
    /**
     * Pass in true to keep the error closer to the top of the page.
     *
     * @default false
     */
    justifyUp?: boolean;
}

/**
 * Indicates an error with a page in the UI.
 */
export function PageError(props: PageErrorProps): ReactNode {
    const { title, action, className } = props;
    const icon = props.icon ?? "cross";
    const iconIntent = props.iconIntent ?? "danger";
    const justifyUp = props.justifyUp ?? false;

    let description = props.description;
    if (description === undefined) {
        description =
            "If the problem persists, contact the FRCDesignApp developers.";
    }

    const error = (
        <NonIdealState
            className={className}
            title={title}
            icon={
                <Icon
                    icon={icon}
                    intent={iconIntent}
                    color={props.iconColor}
                    size={NonIdealStateIconSize.STANDARD}
                />
            }
            description={description}
            action={action}
        />
    );

    if (justifyUp) {
        return error;
    }

    return <div style={{ height: "80vh" }}>{error}</div>;
}
