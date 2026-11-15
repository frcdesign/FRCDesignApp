import {
    ActionIcon,
    Checkbox,
    Collapse,
    Group,
    Title,
    UnstyledButton
} from "@mantine/core";
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { IconSize, StatusColor } from "../lib/style-constants";
import classes from "./parameter-group.module.css";

interface ParameterGroupProps {
    title: string;
    /** A checkbox in its header, as an Onshape feature's: unticked, its rows are gone. */
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children?: ReactNode;
}

/**
 * A titled group of rows in a `ParameterGrid`, folded by its chevron or title
 * as an Onshape feature dialog's groups are. A group driven by a checkbox has
 * its rows only while ticked, and opens when ticked.
 */
export function ParameterGroup(props: ParameterGroupProps): ReactNode {
    const { title, checked, onCheckedChange, children } = props;
    const [isOpen, setIsOpen] = useState(true);
    const hasCheckbox = checked !== undefined;
    const isFoldable = !hasCheckbox || checked;
    const isExpanded = isOpen && isFoldable;
    const toggle = () => {
        if (isFoldable) {
            setIsOpen(!isOpen);
        }
    };

    return (
        <>
            <Group gap="xs" wrap="nowrap" className={classes.header}>
                <ActionIcon
                    variant="subtle"
                    color={StatusColor.NEUTRAL}
                    size="sm"
                    disabled={!isFoldable}
                    onClick={toggle}
                >
                    {isExpanded ? (
                        <CaretDownIcon size={IconSize.SMALL} />
                    ) : (
                        <CaretRightIcon size={IconSize.SMALL} />
                    )}
                </ActionIcon>
                {hasCheckbox && (
                    <Checkbox
                        aria-label={title}
                        checked={checked}
                        onChange={(event) => {
                            setIsOpen(true);
                            onCheckedChange?.(event.currentTarget.checked);
                        }}
                    />
                )}
                <UnstyledButton flex={1} onClick={toggle}>
                    <Title order={5}>{title}</Title>
                </UnstyledButton>
            </Group>
            {children && isFoldable && (
                // Hidden by display alone: a folded query list still takes picks, which needs its effects.
                <Collapse
                    expanded={isExpanded}
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
