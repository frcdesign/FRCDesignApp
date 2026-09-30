import { Center, EmptyState, Loader } from "@mantine/core";
import { Status } from "../lib/status";
import { IconSize } from "../lib/style-constants";
import { ReactNode } from "react";
import { StatusIcon } from "./status-icon";

const ERROR_ICON = (
    <StatusIcon status={Status.ERROR} size={IconSize.PAGE} raised={false} />
);

const CONTACT_DEVELOPERS =
    "If the problem persists, contact the FRCDesignApp developers.";

interface NoticeProps {
    /** Ends with a period whenever there is a description. */
    title: string;
    description?: ReactNode;
    /** @default a red cross */
    icon?: ReactNode;
    action?: ReactNode;
    className?: string;
    /** Left puts the icon beside the text rather than above it. @default center */
    align?: "center" | "left";
    /** Room above and below; tighter inside a card than on a page. @default 24 */
    py?: number;
}

/** What content is replaced by when it is empty, loading or failed. */
export function SectionNotice(props: NoticeProps): ReactNode {
    const {
        title,
        description,
        icon = ERROR_ICON,
        action,
        className,
        align,
        py = 24
    } = props;
    return (
        <EmptyState
            icon={icon}
            title={title}
            description={description}
            size="sm"
            align={align}
            className={className}
            pt={py}
            pb={py}
            // What a sticky section header checks for, to not stick over one.
            data-notice
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
    return <SectionNotice title={props.title} icon={<Loader />} />;
}

type ErrorProps = Omit<NoticeProps, "description">;

/** A failure with nothing more specific to say. */
export function SectionError(props: ErrorProps): ReactNode {
    return <SectionNotice {...props} description={CONTACT_DEVELOPERS} />;
}

interface PageNoticeProps extends NoticeProps {
    /** Keeps the notice nearer the top of the page. @default false */
    justifyUp?: boolean;
}

/** A notice standing in for a whole page. */
export function PageNotice(props: PageNoticeProps): ReactNode {
    const { justifyUp = false, ...notice } = props;
    if (justifyUp) {
        return <SectionNotice {...notice} />;
    }
    return (
        <Center mih="80vh">
            <SectionNotice {...notice} />
        </Center>
    );
}

/** {@link SectionError} for a whole page. */
export function PageError(
    props: Omit<PageNoticeProps, "description">
): ReactNode {
    return <PageNotice {...props} description={CONTACT_DEVELOPERS} />;
}
