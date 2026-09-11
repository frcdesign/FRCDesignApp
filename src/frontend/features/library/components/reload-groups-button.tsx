import { useReloadGroupsMutation } from "../queries";
import { Button, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowsClockwiseIcon, WarningIcon } from "@phosphor-icons/react";
import { AppIcon } from "../../../components/app-icon";
import { AppTitle } from "../../../components/app-title";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { ReactNode } from "react";

interface ReloadGroupsButtonProps {
    reloadAll?: boolean;
}

export function ReloadGroupsButton(props: ReloadGroupsButtonProps): ReactNode {
    const { reloadAll = false } = props;

    // Reloading everything spends the account's Onshape allocation, so it is
    // spoken in the same red as anything else that cannot be taken back.
    const color = reloadAll ? StatusColor.ERROR : StatusColor.INFO;

    const mutation = useReloadGroupsMutation(reloadAll);

    const handleClick = () => {
        modals.openConfirmModal({
            title: (
                <AppTitle
                    icon={
                        <AppIcon
                            icon={reloadAll ? WarningIcon : ArrowsClockwiseIcon}
                            size={IconSize.MEDIUM}
                            color={color}
                        />
                    }
                    title={
                        reloadAll
                            ? "Reload all documents"
                            : "Reload outdated documents"
                    }
                />
            ),
            children: (
                <Text size="sm">
                    {reloadAll
                        ? "Are you sure you want to reload all documents? This is an expensive operation and should only be done after checking with Alex."
                        : "Are you sure you want to reload outdated documents?"}
                </Text>
            ),
            labels: { confirm: "Reload documents", cancel: "Cancel" },
            centered: true,
            confirmProps: { variant: "light", color },
            onConfirm: () => mutation.mutate()
        });
    };

    return (
        <Button
            variant="light"
            color={color}
            leftSection={<ArrowsClockwiseIcon size={IconSize.SMALL} />}
            onClick={handleClick}
            loading={mutation.isPending}
        >
            Reload documents
        </Button>
    );
}
