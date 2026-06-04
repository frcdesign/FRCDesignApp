import { Center, Loader, Stack, Text, Title } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { type JSX, ReactNode } from "react";

const ZERO_STATE_ICON_SIZE = 48;

const DEFAULT_ERROR_ICON = (
    <IconX size={ZERO_STATE_ICON_SIZE} color="var(--mantine-color-red-6)" />
);

interface ZeroStateProps {
    icon?: ReactNode;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}

/**
 * A centered icon/title/description/action block used to indicate empty,
 * loading, or error states.
 */
function ZeroState(props: ZeroStateProps): ReactNode {
    const { icon, title, description, action, className } = props;
    return (
        <Stack
            align="center"
            justify="center"
            gap="xs"
            ta="center"
            py="xl"
            className={className}
        >
            {icon}
            <Title order={5} fw={600}>
                {title}
            </Title>
            {description != null && (
                <Text c="dimmed" size="sm" maw={400}>
                    {description}
                </Text>
            )}
            {action}
        </Stack>
    );
}

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
    return <ZeroState title={props.title} icon={<Loader />} />;
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
     * Defaults to a danger-colored cross icon.
     */
    icon?: ReactNode;
    action?: JSX.Element;
}

function resolveDescription(description: ErrorProps["description"]): ReactNode {
    if (description === undefined) {
        return "If the problem persists, contact the FRCDesignApp developers.";
    }
    return description;
}

/**
 * Indicates an error with a section of the UI.
 */
export function SectionError(props: ErrorProps): ReactNode {
    const { title, action, className } = props;
    return (
        <ZeroState
            className={className}
            title={title}
            icon={props.icon ?? DEFAULT_ERROR_ICON}
            description={resolveDescription(props.description)}
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
    const justifyUp = props.justifyUp ?? false;

    const error = (
        <ZeroState
            className={className}
            title={title}
            icon={props.icon ?? DEFAULT_ERROR_ICON}
            description={resolveDescription(props.description)}
            action={action}
        />
    );

    if (justifyUp) {
        return error;
    }

    return <Center mih="80vh">{error}</Center>;
}
