import { Button } from "@mantine/core";
import { BroadcastIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { useRegisterWebhooksMutation } from "../queries";

/**
 * Registers again from scratch, replacing whatever this deployment had: safe
 * to press whenever reloads stop following new versions.
 */
export function RegisterWebhooksButton(): ReactNode {
    const mutation = useRegisterWebhooksMutation();
    return (
        <Button
            variant="light"
            color={StatusColor.INFO}
            leftSection={<BroadcastIcon size={IconSize.SMALL} />}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
        >
            Register webhooks
        </Button>
    );
}
