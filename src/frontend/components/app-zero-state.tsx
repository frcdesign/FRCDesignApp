import { Center, EmptyState, Loader } from "@mantine/core";
import { XIcon } from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../lib/style-constants";
import { type JSX, ReactNode } from "react";
import { AppIcon } from "./app-icon";

const DEFAULT_ERROR_ICON = (
    <AppIcon icon={XIcon} size={IconSize.PAGE} color={StatusColor.ERROR} />
);

interface ZeroStateProps {
    icon?: ReactNode;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}

/** The centered block every empty, loading and error state is built from. */
function ZeroState(props: ZeroStateProps): ReactNode {
    const { icon, title, description, action, className } = props;

    return (
        <EmptyState
            icon={icon}
            title={title}
            description={description}
            size="sm"
            className={className}
            pt={24}
            pb={24}
        >
            <EmptyState.Actions>{action}</EmptyState.Actions>
        </EmptyState>
    );
}

interface SectionLoadingProps {
    /** Takes the form "Loading {thing}...". */
    title: string;
}

export function SectionLoading(props: SectionLoadingProps): ReactNode {
    return <ZeroState title={props.title} icon={<Loader />} />;
}

interface ErrorProps {
    /** Ends with a period whenever there is a description. */
    title: string;
    /** Null for none at all; omitted falls back to the contact-us line. */
    description?: string | null | JSX.Element;
    className?: string;
    /** @default a danger-colored cross */
    icon?: ReactNode;
    action?: JSX.Element;
}

function resolveDescription(description: ErrorProps["description"]): ReactNode {
    if (description === undefined) {
        return "If the problem persists, contact the FRCDesignApp developers.";
    }
    return description;
}

export function SectionError(props: ErrorProps): ReactNode {
    const { title, action, className, icon = DEFAULT_ERROR_ICON } = props;
    return (
        <ZeroState
            className={className}
            title={title}
            icon={icon}
            description={resolveDescription(props.description)}
            action={action}
        />
    );
}

interface PageMessageProps extends ZeroStateProps {
    /** Keeps the message nearer the top of the page. @default false */
    justifyUp?: boolean;
}

/** A page-level zero state that is not an error, so it carries no fallback. */
export function PageMessage(props: PageMessageProps): ReactNode {
    const { justifyUp, ...zeroState } = props;
    const message = <ZeroState {...zeroState} />;
    return justifyUp ? message : <Center mih="80vh">{message}</Center>;
}

interface PageErrorProps extends ErrorProps {
    /** Keeps the error nearer the top of the page. @default false */
    justifyUp?: boolean;
}

export function PageError(props: PageErrorProps): ReactNode {
    const {
        title,
        action,
        className,
        icon = DEFAULT_ERROR_ICON,
        justifyUp = false
    } = props;

    const error = (
        <ZeroState
            className={className}
            title={title}
            icon={icon}
            description={resolveDescription(props.description)}
            action={action}
        />
    );

    if (justifyUp) {
        return error;
    }

    return <Center mih="80vh">{error}</Center>;
}
