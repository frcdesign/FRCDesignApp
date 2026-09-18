import { Alert, Group, Loader, Text } from "@mantine/core";
import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    VersionJobState,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { describeJobResult, useVersionJobQuery } from "../queries";

interface VersionJobStatusProps {
    workspace: WorkspacePath;
}

/**
 * What the last push or pull from this workspace is doing, or did. Shown on the
 * page rather than as a toast: a run outlives the panel, so its result has to
 * be somewhere it can be come back to.
 */
export function VersionJobStatus(props: VersionJobStatusProps): ReactNode {
    const { data } = useVersionJobQuery(props.workspace);

    if (!data || data.state === VersionJobState.NONE) {
        return null;
    }

    if (data.state === VersionJobState.RUNNING) {
        return (
            <Alert color={StatusColor.INFO} py="xs" px="sm">
                <Group gap="sm" wrap="nowrap">
                    <Loader size={IconSize.MEDIUM} />
                    <Text size="sm">
                        Updating Onshape. This keeps going if you close the
                        panel.
                    </Text>
                </Group>
            </Alert>
        );
    }

    if (data.state === VersionJobState.FAILED) {
        return (
            <Alert
                color={StatusColor.ERROR}
                py="xs"
                px="sm"
                icon={<WarningIcon size={IconSize.MEDIUM} />}
            >
                <Text size="sm">
                    {data.error ??
                        "The last run failed. If it keeps happening, contact the FRCDesignApp developers."}
                </Text>
            </Alert>
        );
    }

    return (
        <Alert
            color={
                data.result && data.result.failedElements > 0
                    ? StatusColor.WARNING
                    : StatusColor.SUCCESS
            }
            py="xs"
            px="sm"
            icon={<CheckCircleIcon size={IconSize.MEDIUM} />}
        >
            <Text size="sm">
                {data.result
                    ? describeJobResult(data.result)
                    : "The last run finished."}
            </Text>
        </Alert>
    );
}
