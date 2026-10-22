import { Checkbox, Group, Text, UnstyledButton } from "@mantine/core";
import { CaretDownIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { FontWeight, IconSize } from "../../../lib/style-constants";
import classes from "./parameter-group.module.css";

interface ParameterGroupProps {
    title: string;
    /**
     * A checkbox in its header, which shows its rows while ticked, as
     * Onshape's boolean-driven groups do; without one, it opens and closes.
     */
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children?: ReactNode;
}

/** A group of rows in a `ParameterGrid`, as Onshape's feature dialogs group parameters. */
export function ParameterGroup(props: ParameterGroupProps): ReactNode {
    const { title, checked, onCheckedChange, children } = props;
    const [open, setOpen] = useState(true);

    const isDriven = checked !== undefined;
    const shown = isDriven ? checked : open;

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
                    <UnstyledButton onClick={() => setOpen(!open)}>
                        <Group gap={6}>
                            <CaretDownIcon
                                size={IconSize.SMALL}
                                style={{
                                    transform: open
                                        ? undefined
                                        : "rotate(-90deg)",
                                    transition: "transform 200ms ease"
                                }}
                            />
                            <Text fw={FontWeight.SEMI_BOLD}>{title}</Text>
                        </Group>
                    </UnstyledButton>
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
