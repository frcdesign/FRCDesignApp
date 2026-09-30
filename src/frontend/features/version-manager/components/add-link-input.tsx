import { Button, Group, Table, TextInput } from "@mantine/core";
import { LinkIcon, PlusIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    isSameWorkspace,
    type LinkDirection,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { IconSize } from "../../../lib/style-constants";
import { showErrorToast } from "../../../lib/notifications";
import {
    INVALID_WORKSPACE_URL,
    parseOnshapeWorkspace
} from "../../../lib/onshape-url";
import { useAddLinkMutation } from "../queries";
import classes from "./add-link-input.module.css";

interface AddLinkInputProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    /** Unbordered, as the last row of a list rather than the page's one field. */
    compact?: boolean;
}

/**
 * Links a workspace by its Onshape url, which is the one handle on a document
 * everybody already has: copy the link, paste it here.
 */
export function AddLinkInput(props: AddLinkInputProps): ReactNode {
    const { workspace, direction, compact = false } = props;
    const [url, setUrl] = useState("");
    const addLink = useAddLinkMutation(workspace);
    const isEmpty = url.trim() === "";

    const submit = () => {
        if (isEmpty) {
            return;
        }
        const linked = parseOnshapeWorkspace(url);
        if (!linked) {
            showErrorToast(INVALID_WORKSPACE_URL);
            return;
        }
        if (isSameWorkspace(linked, workspace)) {
            showErrorToast("A workspace cannot be linked to itself.");
            return;
        }
        addLink.mutate({ linked, direction }, { onSuccess: () => setUrl("") });
    };

    return (
        <Group gap={compact ? "xs" : "sm"}>
            <TextInput
                flex={1}
                variant={compact ? "unstyled" : undefined}
                leftSection={<LinkIcon size={IconSize.SMALL} />}
                placeholder="Onshape document link..."
                value={url}
                onChange={(event) => setUrl(event.currentTarget.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") submit();
                }}
            />
            <Button
                size={compact ? "compact-sm" : undefined}
                variant="outline"
                className={classes.addButton}
                rightSection={<PlusIcon size={IconSize.SMALL} />}
                loading={addLink.isPending}
                disabled={isEmpty}
                onClick={submit}
            >
                {compact ? "Add" : "Add document"}
            </Button>
        </Group>
    );
}

interface AddLinkRowProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
}

/** The last row of the list it adds to, on the same grid as the links above it. */
export function AddLinkRow(props: AddLinkRowProps): ReactNode {
    return (
        <Table.Tr>
            <Table.Td>
                <AddLinkInput {...props} compact />
            </Table.Td>
        </Table.Tr>
    );
}
