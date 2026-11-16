import { Accordion, Box, Checkbox, Group, Text } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { IconSize } from "../lib/style-constants";
import { SectionChevron } from "./app-section";
import styles from "../lib/styles.module.css";
import classes from "./parameter-group.module.css";

interface ParameterGroupProps {
    title: string;
    /** A checkbox in its header, as an Onshape feature's: unticked, its rows are gone. */
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children?: ReactNode;
}

const ITEM = "group";

/**
 * A titled group of rows in a `ParameterGrid`, folded from its header as an
 * Onshape feature dialog's groups are. A group driven by a checkbox has its
 * rows only while ticked, and opens when ticked; its title ticks it.
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
                {/* The whole row folds; a checkbox can't sit in Accordion.Control's button */}
                <Group
                    gap="xs"
                    wrap="nowrap"
                    className={`${classes.header} ${styles.dividerBottom} ${isFoldable ? "interactive" : ""}`}
                    onClick={toggle}
                    data-group-header
                >
                    {hasCheckbox ? (
                        // Ticking it, by box or title, doesn't fold the row too
                        <Box onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                                size="xs"
                                label={title}
                                checked={checked}
                                classNames={{ label: classes.title }}
                                onChange={(event) => {
                                    setIsOpen(true);
                                    onCheckedChange?.(
                                        event.currentTarget.checked
                                    );
                                }}
                            />
                        </Box>
                    ) : (
                        <Text className={classes.title}>{title}</Text>
                    )}
                    <Box flex={1} />
                    {isFoldable && (
                        <SectionChevron
                            opened={isExpanded}
                            size={IconSize.SMALL}
                        />
                    )}
                </Group>
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
