import { useAddGroupMutation } from "../queries";
import { Button, Menu, TextInput } from "@mantine/core";
import { openAppModal } from "../../../components/open-app-modal";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { PlusIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode, useState } from "react";

function openAddGroupMenu(selectedGroupId?: string) {
    openAppModal({
        title: "Add group",
        children: <AddGroupMenuContent selectedGroupId={selectedGroupId} />
    });
}

interface AddGroupMenuContentProps {
    selectedGroupId?: string;
}

function AddGroupMenuContent(props: AddGroupMenuContentProps): ReactNode {
    const { selectedGroupId } = props;
    const [url, setUrl] = useState("");

    const mutation = useAddGroupMutation(selectedGroupId);

    return (
        <>
            <AppModalBody>
                <TextInput
                    placeholder="Document url..."
                    value={url}
                    onChange={(event) => setUrl(event.currentTarget.value)}
                    error={mutation.isError}
                />
            </AppModalBody>
            <AppModalFooter>
                <Button
                    variant="light"
                    ml="auto"
                    leftSection={<PlusIcon size={IconSize.SMALL} />}
                    onClick={() => mutation.mutate(url)}
                    loading={mutation.isPending}
                >
                    Add
                </Button>
            </AppModalFooter>
        </>
    );
}

export function AddGroupButton(): ReactNode {
    return (
        <Button
            variant="light"
            leftSection={<PlusIcon size={IconSize.SMALL} />}
            onClick={() => openAddGroupMenu()}
        >
            Add group
        </Button>
    );
}

interface AddGroupItemProps {
    selectedGroupId?: string;
}

export function AddGroupItem(props: AddGroupItemProps): ReactNode {
    return (
        <Menu.Item
            leftSection={<PlusIcon size={IconSize.SMALL} />}
            onClick={() => openAddGroupMenu(props.selectedGroupId)}
        >
            Add group
        </Menu.Item>
    );
}
