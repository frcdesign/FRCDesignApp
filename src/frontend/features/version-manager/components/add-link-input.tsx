import { Button, Card, Group, TextInput } from "@mantine/core";
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
 * A card with the field and its button on one row, the way the app this came
 * from had it, under the list it adds to — so the links read first and the way
 * to add one is where the list ends.
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
        <Card withBorder padding="xs" radius="md">
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
        </Card>
    );
}
