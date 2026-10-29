import { useReloadMutation } from "../queries";
import { Button, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowsClockwiseIcon, WarningIcon } from "@phosphor-icons/react";
import { AppIcon } from "../../../components/app-icon";
import { AppTitle } from "../../../components/app-title";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { ReactNode } from "react";

interface ReloadButtonProps {
    /** Every document, not just the outdated ones. @default false */
    all?: boolean;
}

export function ReloadButton(props: ReloadButtonProps): ReactNode {
    const { all = false } = props;
    // Reloading everything spends the account's Onshape allocation.
    const color = all ? StatusColor.ERROR : StatusColor.INFO;
    const mutation = useReloadMutation(all);

    const handleClick = () => {
        modals.openConfirmModal({
            title: (
                <AppTitle
                    icon={
                        <AppIcon
                            icon={all ? WarningIcon : ArrowsClockwiseIcon}
                            size={IconSize.MEDIUM}
                            color={color}
                        />
                    }
                    title={
                        all
                            ? "Reload all documents"
                            : "Reload outdated documents"
                    }
                />
            ),
            children: (
                <Text>
                    {all
                        ? "Are you sure you want to reload every document in this library? This is an expensive operation."
                        : "Reload the documents in this library with a new version or a failed load?"}
                </Text>
            ),
            labels: { confirm: "Reload documents", cancel: "Cancel" },
            confirmProps: { color },
            onConfirm: () => mutation.mutate()
        });
    };

    return (
        <Button
            color={color}
            leftSection={<ArrowsClockwiseIcon />}
            onClick={handleClick}
            loading={mutation.isPending}
        >
            Reload
        </Button>
    );
}
