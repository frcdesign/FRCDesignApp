import { Checkbox, Text, Title } from "@mantine/core";
import { type ReactNode } from "react";
import { FontWeight } from "../../../lib/style-constants";
import classes from "./parameter-group.module.css";

interface ParameterGroupProps {
    title: string;
    /** A checkbox in its header, which shows its rows while ticked. */
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children?: ReactNode;
}

/**
 * A titled group of rows in a `ParameterGrid`. A part's group is headed by
 * its checkbox, and shows its rows while ticked.
 */
export function ParameterGroup(props: ParameterGroupProps): ReactNode {
    const { title, checked, onCheckedChange, children } = props;
    const isDriven = checked !== undefined;
    const shown = isDriven ? checked : true;

    return (
        <>
            <div className={classes.header}>
                {isDriven ? (
                    <Checkbox
                        label={<Text fw={FontWeight.SEMI_BOLD}>{title}</Text>}
                        checked={checked}
                        onChange={(event) =>
                            onCheckedChange?.(event.currentTarget.checked)
                        }
                    />
                ) : (
                    <Title order={5}>{title}</Title>
                )}
            </div>
            {shown && children && (
                <div className={classes.body}>{children}</div>
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
