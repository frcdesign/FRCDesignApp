import { ReloadScope, useReloadMutation } from "../queries";
import { Button, Group, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowsClockwiseIcon, WarningIcon } from "@phosphor-icons/react";
import { AppIcon } from "../../../components/app-icon";
import { AppTitle } from "../../../components/app-title";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { ReactNode } from "react";

interface ReloadButtonsProps {
    scope: ReloadScope;
}

/**
 * A reload picks up versions a webhook missed and reruns failed loads. A
 * forced one rereads every document, which spends a lot of the account's
 * Onshape allocation, so it asks first.
 */
export function ReloadButtons(props: ReloadButtonsProps): ReactNode {
    const { scope } = props;
    const mutation = useReloadMutation(scope);
    const what =
        scope === ReloadScope.ALL
            ? "every document in every library"
            : "every document in this library";

    const confirmForce = () => {
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
                    title="Force reload"
                />
            ),
            children: (
                <Text>
                    Force reload {what}, whether or not it changed? This is an
                    expensive operation.
                </Text>
            ),
            labels: { confirm: "Force reload", cancel: "Cancel" },
            confirmProps: { color: StatusColor.ERROR },
            onConfirm: () => mutation.mutate(true)
        });
    };

    return (
        <Group gap="xs">
            <Button
                leftSection={<ArrowsClockwiseIcon />}
                onClick={() => mutation.mutate(false)}
                loading={mutation.isPending && mutation.variables === false}
            >
                Reload
            </Button>
            <Button
                color={StatusColor.ERROR}
                onClick={confirmForce}
                loading={mutation.isPending && mutation.variables === true}
            >
                Force reload
            </Button>
        </Group>
    );
}
