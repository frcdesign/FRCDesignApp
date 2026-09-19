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

interface AddLinkInputProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
}

/**
 * Links a workspace by its Onshape url, which is the one handle on a document
 * everybody already has: copy the link, paste it here.
 *
 * The last row of the list it adds to, on the same grid as the links above it:
 * a card of its own sat inside the table and left both it and the row above at
 * a different height from the rest.
 */
export function AddLinkInput(props: AddLinkInputProps): ReactNode {
    const { workspace, direction } = props;
    const [url, setUrl] = useState("");
    const addLink = useAddLinkMutation(workspace);

    const submit = () => {
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
        <Table.Tr>
            <Table.Td>
                <Group gap="xs" wrap="nowrap">
                    <TextInput
                        flex={1}
                        size="sm"
                        variant="unstyled"
                        leftSection={<LinkIcon size={IconSize.SMALL} />}
                        placeholder="Onshape document link..."
                        value={url}
                        onChange={(event) => setUrl(event.currentTarget.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") submit();
                        }}
                    />
                    <Button
                        size="compact-sm"
                        variant="subtle"
                        rightSection={<PlusIcon size={IconSize.SMALL} />}
                        loading={addLink.isPending}
                        disabled={url.trim() === ""}
                        onClick={submit}
                    >
                        Add
                    </Button>
                </Group>
            </Table.Td>
        </Table.Tr>
    );
}
