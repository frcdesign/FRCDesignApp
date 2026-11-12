import {
    ActionIcon,
    Checkbox,
    Collapse,
    Group,
    Text,
    Title,
    UnstyledButton
} from "@mantine/core";
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { FontWeight, IconSize, StatusColor } from "../lib/style-constants";
import classes from "./parameter-group.module.css";

interface ParameterGroupProps {
    title: string;
    /** A checkbox in its header: ticked, the group opens, and folds from its title. */
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children?: ReactNode;
}

/**
 * A titled group of rows in a `ParameterGrid`. A part's group is an accordion
 * headed by its checkbox: ticking it opens the group, and its title folds it.
 */
export function ParameterGroup(props: ParameterGroupProps): ReactNode {
    const { title, checked, onCheckedChange, children } = props;
    const [isOpen, setIsOpen] = useState(true);

    if (checked === undefined) {
        return (
            <>
                <div className={classes.header}>
                    <Title order={5}>{title}</Title>
                </div>
                {children && <div className={classes.body}>{children}</div>}
            </>
        );
    }

    return (
        <>
            <Group gap="sm" wrap="nowrap" className={classes.header}>
                <Checkbox
                    aria-label={title}
                    checked={checked}
                    onChange={(event) => {
                        setIsOpen(true);
                        onCheckedChange?.(event.currentTarget.checked);
                    }}
                />
                <UnstyledButton
                    flex={1}
                    disabled={!checked}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <Text fw={FontWeight.SEMI_BOLD}>{title}</Text>
                </UnstyledButton>
                {checked && (
                    <ActionIcon
                        variant="subtle"
                        color={StatusColor.NEUTRAL}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? (
                            <CaretDownIcon size={IconSize.SMALL} />
                        ) : (
                            <CaretRightIcon size={IconSize.SMALL} />
                        )}
                    </ActionIcon>
                )}
            </Group>
            {checked && children && (
                // Hidden by display alone: a folded query list still takes picks, which needs its effects.
                <Collapse
                    expanded={isOpen}
                    keepMountedMode="display-none"
                    transitionDuration={0}
                    className={classes.full}
                >
                    <div className={classes.body}>{children}</div>
                </Collapse>
            )}
        </>
    );
}

interface FullWidthRowProps {
    children: ReactNode;
}

/** A row across both columns of a `ParameterGrid`, for what has no name beside it. */
export function FullWidthRow(props: FullWidthRowProps): ReactNode {
    return <div className={classes.full}>{props.children}</div>;
}
