import { Button, Tooltip } from "@mantine/core";
import { type ReactNode } from "react";

interface RowActionButtonProps {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    /** Shown on hover of the disabled button; the button is enabled without one. */
    disabledReason?: string;
    loading?: boolean;
}

/** A row's one-click action, outlined so it reads as secondary to opening the row. */
export function RowActionButton(props: RowActionButtonProps): ReactNode {
    const { label, icon, onClick, disabledReason, loading } = props;
    const disabled = disabledReason !== undefined;
    return (
        <Tooltip label={disabledReason} disabled={!disabled}>
            {/* data-disabled, so the tip still gets a hover; Mantine reads its
                presence, so it is left off rather than false. */}
            <Button
                variant="outline"
                size="compact-sm"
                leftSection={icon}
                loading={loading}
                data-disabled={disabled || undefined}
                onClick={(event) => {
                    // Inside a row, whose own click opens it.
                    event.stopPropagation();
                    if (!disabled) onClick();
                }}
            >
                {label}
            </Button>
        </Tooltip>
    );
}
