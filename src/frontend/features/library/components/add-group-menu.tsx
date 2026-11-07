import { useAddGroupMutation } from "../queries";
import { ActionIcon, Button, TextInput, Tooltip } from "@mantine/core";
import { openAppModal } from "../../../components/open-app-modal";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { PlusIcon } from "@phosphor-icons/react";
import { ReactNode, useState } from "react";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";

function openAddGroupMenu() {
    openAppModal({
        title: m.libraryAddGroup(),
        children: <AddGroupMenuContent />
    });
}

function AddGroupMenuContent(): ReactNode {
    const [url, setUrl] = useState("");

    const mutation = useAddGroupMutation();

    return (
        <>
            <AppModalBody>
                <TextInput
                    data-autofocus
                    placeholder={m.libraryAddGroupPlaceholder()}
                    value={url}
                    onChange={(event) => setUrl(event.currentTarget.value)}
                    error={mutation.isError}
                />
            </AppModalBody>
            <AppModalFooter>
                <Button
                    ml="auto"
                    leftSection={<PlusIcon />}
                    onClick={() => mutation.mutate(url)}
                    loading={mutation.isPending}
                >
                    {m.libraryAddGroupSubmit()}
                </Button>
            </AppModalFooter>
        </>
    );
}

/** The empty library's call to action. */
export function AddGroupButton(): ReactNode {
    return (
        <Button leftSection={<PlusIcon />} onClick={openAddGroupMenu}>
            {m.libraryAddGroup()}
        </Button>
    );
}

/** In the library section's header, beside its chevron. */
export function AddGroupIconButton(): ReactNode {
    return (
        <Tooltip label={m.libraryAddGroup()}>
            <ActionIcon variant="subtle" onClick={openAddGroupMenu}>
                <PlusIcon size={IconSize.SMALL} />
            </ActionIcon>
        </Tooltip>
    );
}
