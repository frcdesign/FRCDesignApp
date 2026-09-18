import { Button, Group, TextInput } from "@mantine/core";
import { LinkIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    isSameWorkspace,
    type LinkDirection,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { IconSize } from "../../../lib/style-constants";
import { showErrorToast } from "../../../lib/notifications";
import { parseOnshapeWorkspace } from "../../../lib/url";
import { useAddLinkMutation } from "../queries";

interface AddLinkInputProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    /** What linking in this direction means, e.g. "a workspace to push to". */
    placeholder: string;
}

/**
 * Links a workspace by its Onshape url, which is the one handle on a document
 * everybody already has: copy the link, paste it here.
 */
export function AddLinkInput(props: AddLinkInputProps): ReactNode {
    const { workspace, direction, placeholder } = props;
    const [url, setUrl] = useState("");
    const addLink = useAddLinkMutation(workspace);

    const submit = () => {
        const linked = parseOnshapeWorkspace(url);
        if (!linked) {
            showErrorToast(
                "That does not look like a link to an Onshape workspace. Copy the url from the document's address bar."
            );
            return;
        }
        if (isSameWorkspace(linked, workspace)) {
            showErrorToast("A workspace cannot be linked to itself.");
            return;
        }
        addLink.mutate({ linked, direction }, { onSuccess: () => setUrl("") });
    };

    return (
        <Group gap="xs" wrap="nowrap" align="flex-start">
            <TextInput
                flex={1}
                size="sm"
                leftSection={<LinkIcon size={IconSize.SMALL} />}
                placeholder={placeholder}
                value={url}
                onChange={(event) => setUrl(event.currentTarget.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") submit();
                }}
            />
            <Button
                size="sm"
                variant="light"
                loading={addLink.isPending}
                disabled={url.trim() === ""}
                onClick={submit}
            >
                Link
            </Button>
        </Group>
    );
}
