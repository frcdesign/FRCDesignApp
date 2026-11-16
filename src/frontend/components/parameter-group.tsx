import {
    Accordion,
    Checkbox,
    Group,
    Text,
    UnstyledButton
} from "@mantine/core";
import { type ReactNode, useState } from "react";
import { IconSize } from "../lib/style-constants";
import { SectionChevron } from "./app-section";
import classes from "./parameter-group.module.css";

interface ParameterGroupProps {
    title: string;
    /** A checkbox titling it, as an Onshape feature's: unticked, its rows are gone. */
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children?: ReactNode;
}

const ITEM = "group";

/**
 * A titled group of rows in a `ParameterGrid`, folded from its header as an
 * Onshape feature dialog's groups are. A group driven by a checkbox has its
 * title as the checkbox's label, and folds from a chevron of its own beside it.
 */
export function ParameterGroup(props: ParameterGroupProps): ReactNode {
    const { title, checked, onCheckedChange, children } = props;
    const [isOpen, setIsOpen] = useState(true);
    const hasCheckbox = checked !== undefined;
    const isFoldable = !hasCheckbox || checked;
    const isExpanded = isOpen && isFoldable;

    return (
        <Accordion
            variant="unstyled"
            value={isExpanded ? ITEM : null}
            // Hidden by display alone: a folded query list still takes picks, which needs its effects
            keepMounted
            keepMountedMode="display-none"
            transitionDuration={0}
            className={classes.full}
            classNames={{ content: classes.content }}
        >
            <Accordion.Item value={ITEM}>
                {hasCheckbox ? (
                    <Group gap="xs" wrap="nowrap" justify="space-between">
                        <Checkbox
                            label={title}
                            checked={checked}
                            classNames={{ label: classes.title }}
                            onChange={(event) => {
                                setIsOpen(true);
                                onCheckedChange?.(event.currentTarget.checked);
                            }}
                        />
                        {isFoldable && (
                            <UnstyledButton
                                className={`${classes.control} ${classes.chevronOnly} interactive`}
                                onClick={() => setIsOpen(!isOpen)}
                                data-group-header
                            >
                                <SectionChevron
                                    opened={isExpanded}
                                    size={IconSize.SMALL}
                                />
                            </UnstyledButton>
                        )}
                    </Group>
                ) : (
                    <UnstyledButton
                        className={`${classes.control} interactive`}
                        onClick={() => setIsOpen(!isOpen)}
                        data-group-header
                    >
                        <Text className={classes.title}>{title}</Text>
                        <SectionChevron
                            opened={isExpanded}
                            size={IconSize.SMALL}
                        />
                    </UnstyledButton>
                )}
                {children && isFoldable && (
                    <Accordion.Panel>
                        <div className={classes.body}>{children}</div>
                    </Accordion.Panel>
                )}
            </Accordion.Item>
        </Accordion>
    );
}

interface FullWidthRowProps {
    children: ReactNode;
}

/** A row across both columns of a `ParameterGrid`, for what has no name beside it. */
export function FullWidthRow(props: FullWidthRowProps): ReactNode {
    return <div className={classes.full}>{props.children}</div>;
}
