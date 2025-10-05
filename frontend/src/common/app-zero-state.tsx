import {
    Icon,
    Intent,
    NonIdealState,
    NonIdealStateIconSize,
    Spinner
} from "@blueprintjs/core";
import { IconName } from "@blueprintjs/icons";
import { ReactNode } from "react";

interface AppNonIdealStateProps {
    title: string;
    description?: string | JSX.Element;
    className?: string;
    /**
     * Whether the state should be displayed using smaller styles.
     * @default true
     */
    inline?: boolean;
}

interface AppErrorStateProps extends AppNonIdealStateProps {
    /**
     * This should end with a period if there is a description.
     */
    title: string;
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
 * A wrapper around Blueprint's NonIdealState component.
 */
export function AppErrorState(props: AppErrorStateProps): ReactNode {
    const { title, description, action, className } = props;
    const icon = props.icon ?? "cross";
    const iconIntent = props.iconIntent ?? "danger";
    const inline = props.inline ?? true;

    return (
        <NonIdealState
            className={className + (inline ? " inline-app-error-state" : "")}
            title={title}
            icon={
                <Icon
                    icon={icon}
                    intent={iconIntent}
                    color={props.iconColor}
                    size={
                        inline
                            ? NonIdealStateIconSize.SMALL
                            : NonIdealStateIconSize.STANDARD
                    }
                />
            }
            description={description}
            action={action}
        />
    );
}

interface AppLoadingStateProps extends AppNonIdealStateProps {
    /**
     * This should take the form "Loading {thing}...".
     */
    title: string;
    action?: JSX.Element;
}

/**
 * A wrapper around Blueprint's NonIdealState component.
 */
export function AppLoadingState(props: AppLoadingStateProps): ReactNode {
    const { title, description, action, className } = props;
    const inline = props.inline ?? false;

    return (
        <NonIdealState
            className={className + (inline ? " inline-app-loading-state" : "")}
            title={title}
            icon={<Spinner intent="primary" />}
            description={description}
            action={action}
        />
    );
}

interface AppInternalErrorStateProps
    extends Omit<AppErrorStateProps, "description" | "title"> {
    /**
     * If provided, this should end with a period.
     */
    title?: string;
}

/**
 * An error state for internal errors that should never happen.
 */
export function AppInternalErrorState(props: AppInternalErrorStateProps) {
    const { action, title, icon, iconIntent, iconColor } = props;
    return (
        <AppErrorState
            title={title ?? "The app has crashed due to an unexpected error."}
            icon={icon}
            iconIntent={iconIntent}
            iconColor={iconColor}
            description="If the problem persists, contact the FRCDesignApp developers."
            action={action}
            inline={props.inline}
        />
    );
}
