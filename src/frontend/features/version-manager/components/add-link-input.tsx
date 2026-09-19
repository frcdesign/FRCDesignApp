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

/** What the two fields below are, minus how they are laid out. */
interface AddLinkForm {
    url: string;
    setUrl: (url: string) => void;
    submit: () => void;
    isPending: boolean;
    /** Nothing typed yet, which is what leaves the button disabled. */
    isEmpty: boolean;
}

/**
 * Links a workspace by its Onshape url, which is the one handle on a document
 * everybody already has: copy the link, paste it here.
 */
function useAddLinkForm(
    workspace: WorkspacePath,
    direction: LinkDirection
): AddLinkForm {
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

    return {
        url,
        setUrl,
        submit,
        isPending: addLink.isPending,
        isEmpty: url.trim() === ""
    };
}

interface AddLinkProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
}

/**
 * The last row of the list it adds to, on the same grid as the links above it:
 * a card of its own sat inside the table and left both it and the row above at
 * a different height from the rest.
 */
export function AddLinkRow(props: AddLinkProps): ReactNode {
    const { workspace, direction } = props;
    const form = useAddLinkForm(workspace, direction);

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
                        value={form.url}
                        onChange={(event) =>
                            form.setUrl(event.currentTarget.value)
                        }
                        onKeyDown={(event) => {
                            if (event.key === "Enter") form.submit();
                        }}
                    />
                    <Button
                        size="compact-sm"
                        variant="subtle"
                        rightSection={<PlusIcon size={IconSize.SMALL} />}
                        loading={form.isPending}
                        disabled={form.isEmpty}
                        onClick={form.submit}
                    >
                        Add
                    </Button>
                </Group>
            </Table.Td>
        </Table.Tr>
    );
}

/**
 * The same field where it is the page's one instruction rather than a list's
 * last row: labelled, bordered, and with a button that says what it adds.
 */
export function AddLinkField(props: AddLinkProps): ReactNode {
    const { workspace, direction } = props;
    const form = useAddLinkForm(workspace, direction);

    return (
        // Bottom-aligned, so the button sits on the input rather than on its
        // label.
        <Group gap="sm" wrap="nowrap" align="flex-end">
            <TextInput
                flex={1}
                label="Onshape document link"
                leftSection={<LinkIcon size={IconSize.SMALL} />}
                placeholder="https://cad.onshape.com/documents/..."
                value={form.url}
                onChange={(event) => form.setUrl(event.currentTarget.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") form.submit();
                }}
            />
            <Button
                rightSection={<PlusIcon size={IconSize.SMALL} />}
                loading={form.isPending}
                disabled={form.isEmpty}
                onClick={form.submit}
            >
                Add document
            </Button>
        </Group>
    );
}
