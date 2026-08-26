import { Alert, Anchor, Stack } from "@mantine/core";
import { Warning } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { IconSize } from "../../lib/style-constants";

/** Shown for a library id that isn't one of the known libraries. */
export function UnknownLibrary(): ReactNode {
    return (
        <Stack>
            <Alert
                color="red"
                icon={<Warning size={IconSize.MEDIUM} />}
                title="Unknown library"
            >
                That library doesn&apos;t exist.
            </Alert>
            <Anchor component={Link} to="/dashboard">
                Back to all libraries
            </Anchor>
        </Stack>
    );
}
