import { useReloadAllMutation } from "../queries";
import { Button, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowsClockwiseIcon, WarningIcon } from "@phosphor-icons/react";
import { AppIcon } from "../../../components/app-icon";
import { AppTitle } from "../../../components/app-title";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { ReactNode } from "react";

/**
 * Force reloads every document in every library. New versions reload
 * themselves, so this is for a change in how documents are read. Spoken in
 * red: it spends a great deal of the account's Onshape allocation.
 */
export function ReloadAllButton(): ReactNode {
    const mutation = useReloadAllMutation();

    const handleClick = () => {
        modals.openConfirmModal({
            title: (
                <AppTitle
                    icon={
                        <AppIcon
                            icon={WarningIcon}
                            size={IconSize.MEDIUM}
                            color={StatusColor.ERROR}
                        />
                    }
                    title="Reload every library"
                />
            ),
            children: (
                <Text size="sm">
                    Are you sure you want to reload every document in every
                    library? This is an expensive operation. New versions of
                    documents are already reloaded on their own.
                </Text>
            ),
            labels: { confirm: "Reload everything", cancel: "Cancel" },
            centered: true,
            confirmProps: { variant: "light", color: StatusColor.ERROR },
            onConfirm: () => mutation.mutate()
        });
    };

    return (
        <Button
            variant="light"
            color={StatusColor.ERROR}
            leftSection={<ArrowsClockwiseIcon size={IconSize.SMALL} />}
            onClick={handleClick}
            loading={mutation.isPending}
        >
            Reload everything
        </Button>
    );
}
