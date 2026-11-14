import { Code, Stack, Text } from "@mantine/core";
import { ListBulletsIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    FeatureScriptsLoadState,
    type FeatureScriptsLoadStatus
} from "@backend/features/featurescripts/contract";
import { AppModalBody } from "../../../components/app-modal";
import { Callout, CalloutButton } from "../../../components/callout";
import { InputRow } from "../../../components/input-row";
import { openAppModal } from "../../../components/open-app-modal";
import { formatTimeAgo } from "../../../lib/format-time";
import { Status } from "../../../lib/status";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { useFeatureScriptsLoadStatusQuery } from "../queries";

/** The owner's: how the last load of the frontend document is going, or how it went. */
export function FeatureScriptsLoadCallout(): ReactNode {
    const { data } = useFeatureScriptsLoadStatusQuery();
    if (!data) {
        return null;
    }
    const { status } = data;
    if (!status) {
        return <Callout text={m.featureScriptsLastLoadNone()} />;
    }
    const calloutStatus = toCalloutStatus(status);
    return (
        <Callout
            text={calloutText(status)}
            status={calloutStatus}
            loading={status.state === FeatureScriptsLoadState.RUNNING}
            action={
                status.error && (
                    <CalloutButton
                        status={calloutStatus}
                        icon={<ListBulletsIcon size={IconSize.SMALL} />}
                        onClick={() => openLoadDetails(status)}
                    >
                        {m.featureScriptsLastLoadDetails()}
                    </CalloutButton>
                )
            }
        />
    );
}

function toCalloutStatus(status: FeatureScriptsLoadStatus): Status {
    switch (status.state) {
        case FeatureScriptsLoadState.RUNNING:
            return Status.INFO;
        case FeatureScriptsLoadState.LOADED:
            return (status.failedCount ?? 0) > 0
                ? Status.WARNING
                : Status.SUCCESS;
        case FeatureScriptsLoadState.UP_TO_DATE:
            return Status.SUCCESS;
        case FeatureScriptsLoadState.FAILED:
            return Status.ERROR;
    }
}

function calloutText(status: FeatureScriptsLoadStatus): string {
    const when = formatTimeAgo(status.finishedAt ?? status.startedAt);
    const version = status.versionName ?? "";
    const count = status.featureCount ?? 0;
    const failed = status.failedCount ?? 0;
    switch (status.state) {
        case FeatureScriptsLoadState.RUNNING:
            return m.featureScriptsLastLoadRunning();
        case FeatureScriptsLoadState.LOADED:
            return failed > 0
                ? m.featureScriptsLastLoadLoadedWithFailures({
                      version,
                      when,
                      failed,
                      count
                  })
                : m.featureScriptsLastLoadLoaded({ version, when, count });
        case FeatureScriptsLoadState.UP_TO_DATE:
            return m.featureScriptsLastLoadUpToDate({ version, when });
        case FeatureScriptsLoadState.FAILED:
            return status.versionName
                ? m.featureScriptsLastLoadFailed({ version, when })
                : m.featureScriptsLastLoadFailedEarly({ when });
    }
}

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

function openLoadDetails(status: FeatureScriptsLoadStatus): void {
    openAppModal({
        title: m.featureScriptsLastLoadDetailsTitle(),
        children: (
            <AppModalBody>
                <LoadDetails status={status} />
            </AppModalBody>
        )
    });
}

interface LoadDetailsProps {
    status: FeatureScriptsLoadStatus;
}

/** The error as the load raised it, which is for the owner to read, not a user. */
function LoadDetails(props: LoadDetailsProps): ReactNode {
    const { status } = props;
    return (
        <Stack gap="sm">
            {status.versionName && (
                <InputRow label={m.featureScriptsLastLoadDetailsVersion()}>
                    <Text c={StatusColor.DIMMED}>{status.versionName}</Text>
                </InputRow>
            )}
            <InputRow label={m.featureScriptsLastLoadDetailsStarted()}>
                <Text c={StatusColor.DIMMED}>
                    {formatTime(status.startedAt)}
                </Text>
            </InputRow>
            {status.finishedAt !== undefined && (
                <InputRow label={m.featureScriptsLastLoadDetailsFinished()}>
                    <Text c={StatusColor.DIMMED}>
                        {formatTime(status.finishedAt)}
                    </Text>
                </InputRow>
            )}
            <Text fw={500}>{m.featureScriptsLastLoadDetailsError()}</Text>
            <Code block style={{ whiteSpace: "pre-wrap" }}>
                {status.error}
            </Code>
        </Stack>
    );
}
