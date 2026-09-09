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

interface NoticeProps {
    /** Ends with a period whenever there is a description. */
    title: string;
    /** Null for none at all; omitted falls back to the contact-us line. */
    description?: string | null | JSX.Element;
    className?: string;
    /** @default a danger-colored cross */
    icon?: ReactNode;
    action?: JSX.Element;
}

function resolveDescription(
    description: NoticeProps["description"]
): ReactNode {
    if (description === undefined) {
        return "If the problem persists, contact the FRCDesignApp developers.";
    }
    return description;
}

/**
 * Whatever a section has to say in place of its content: a failure, but an
 * empty result or a prompt just as well. Reads as a failure only by default —
 * an `icon` and a `description` of its own are what make it something else.
 */
export function SectionNotice(props: NoticeProps): ReactNode {
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

interface PageNoticeProps extends NoticeProps {
    /** Keeps the notice nearer the top of the page. @default false */
    justifyUp?: boolean;
}

/** The same, standing in for a whole page rather than one section of one. */
export function PageNotice(props: PageNoticeProps): ReactNode {
    const {
        title,
        action,
        className,
        icon = DEFAULT_ERROR_ICON,
        justifyUp = false
    } = props;

    const notice = (
        <ZeroState
            className={className}
            title={title}
            icon={icon}
            description={resolveDescription(props.description)}
            action={action}
        />
    );

    if (justifyUp) {
        return notice;
    }

    return <Center mih="80vh">{notice}</Center>;
}
