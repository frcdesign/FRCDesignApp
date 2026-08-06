import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
    Button,
    Group,
    Stack,
    Table,
    Text,
    Title,
    Tooltip
} from "@mantine/core";
import {
    IconAlertTriangle,
    IconArrowLeft,
    IconCircleCheck,
    IconCircleX
} from "@tabler/icons-react";
import { Loader } from "@mantine/core";
import { ReactNode } from "react";
import { IconColor, IconSize } from "../../common/style-constants";
import {
    PageError,
    SectionError,
    SectionLoading
} from "../../app-common/app-zero-state";
import { useLibraryJobsQuery } from "../../queries";
import { hasEditorAccess } from "../../../shared/types";
import { useLoaderData } from "@tanstack/react-router";
import {
    type GroupResult,
    type LibraryJob
} from "../../../shared/library-job-models";

export const Route = createFileRoute("/app/library-jobs")({
    component: LibraryJobsPage
});

const TYPE_LABELS: Record<LibraryJob["type"], string> = {
    "load-library": "Reload",
    "add-group": "Add document"
};

function LibraryJobsPage(): ReactNode {
    const navigate = useNavigate();
    const maxAccessLevel = useLoaderData({ from: "/app" }).accessData
        .maxAccessLevel;
    const jobsQuery = useLibraryJobsQuery();

    const backButton = (
        <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={IconSize.SMALL} />}
            onClick={() => void navigate({ to: "/app/groups" })}
        >
            Back to library
        </Button>
    );

    if (!hasEditorAccess(maxAccessLevel)) {
        return (
            <PageError
                title="Library jobs are only visible to editors."
                description={null}
            />
        );
    }

    let body: ReactNode;
    if (jobsQuery.isPending) {
        body = <SectionLoading title="Loading library jobs..." />;
    } else if (jobsQuery.isError) {
        body = <SectionError title="Failed to load library jobs." />;
    } else if (jobsQuery.data.libraryJobs.length === 0) {
        body = (
            <SectionError
                title="No jobs yet"
                description="Reloading documents or adding a document will show up here."
            />
        );
    } else {
        body = <JobsTable jobs={jobsQuery.data.libraryJobs} />;
    }

    return (
        <Stack p="md" gap="sm">
            <Group justify="space-between" wrap="nowrap">
                <Title order={4}>Library Jobs</Title>
                {backButton}
            </Group>
            {body}
        </Stack>
    );
}

function JobsTable(props: { jobs: LibraryJob[] }): ReactNode {
    return (
        <Table.ScrollContainer minWidth={600}>
            <Table verticalSpacing="sm" striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Job</Table.Th>
                        <Table.Th>Started</Table.Th>
                        <Table.Th>Duration</Table.Th>
                        <Table.Th>Result</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {props.jobs.map((job) => (
                        <Table.Tr key={job.id}>
                            <Table.Td>
                                <StatusCell job={job} />
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm" fw={500}>
                                    {job.label}
                                </Text>
                                <Text size="xs" c="dimmed">
                                    {TYPE_LABELS[job.type]}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                <Tooltip
                                    label={new Date(
                                        job.createdAt
                                    ).toLocaleString()}
                                >
                                    <Text size="sm">
                                        {formatRelativeTime(job.createdAt)}
                                    </Text>
                                </Tooltip>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm">{formatDuration(job)}</Text>
                            </Table.Td>
                            <Table.Td>
                                <ResultCell job={job} />
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>
    );
}

function StatusCell(props: { job: LibraryJob }): ReactNode {
    const { status } = props.job;
    switch (status) {
        case "running":
            return (
                <Group gap={6} wrap="nowrap">
                    <Loader size={IconSize.SMALL} />
                    <Text size="sm">Running</Text>
                </Group>
            );
        case "complete":
            return (
                <Group gap={6} wrap="nowrap">
                    <IconCircleCheck
                        size={IconSize.MEDIUM}
                        color={IconColor.GREEN}
                    />
                    <Text size="sm">Complete</Text>
                </Group>
            );
        case "partial":
            return (
                <Group gap={6} wrap="nowrap">
                    <IconAlertTriangle
                        size={IconSize.MEDIUM}
                        color={IconColor.YELLOW}
                    />
                    <Text size="sm">Partial</Text>
                </Group>
            );
        case "errored":
            return (
                <Group gap={6} wrap="nowrap">
                    <IconCircleX size={IconSize.MEDIUM} color={IconColor.RED} />
                    <Text size="sm">Errored</Text>
                </Group>
            );
    }
}

/** Flattens a job's result into the list of per-group outcomes. */
function resultGroups(job: LibraryJob): GroupResult[] {
    if (Array.isArray(job.result)) return job.result;
    return job.result ? [job.result] : [];
}

function ResultCell(props: { job: LibraryJob }): ReactNode {
    const { job } = props;
    if (job.status === "running") {
        return (
            <Text size="sm" c="dimmed">
                —
            </Text>
        );
    }

    const groups = resultGroups(job);
    const loaded = groups.filter(
        (g) => g.status === "created" || g.status === "reloaded"
    ).length;
    const skipped = groups.filter((g) => g.status === "skipped").length;
    const failures = groups.filter((g) => g.status === "failed");

    const parts: string[] = [];
    if (loaded) parts.push(`${loaded} loaded`);
    if (skipped) parts.push(`${skipped} skipped`);
    if (failures.length) parts.push(`${failures.length} failed`);
    const summary = parts.length ? parts.join(", ") : (job.error ?? "—");

    return (
        <Stack gap={2}>
            <Text size="sm">{summary}</Text>
            {failures.map((failure) => (
                <Text key={failure.groupId} size="xs" c="red">
                    {(failure.name ?? failure.groupId) + ": "}
                    {"error" in failure ? failure.error : "Failed"}
                </Text>
            ))}
        </Stack>
    );
}

function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

function formatDuration(job: LibraryJob): string {
    if (job.status === "running" || job.finishedAt == null) return "—";
    const seconds = Math.max(
        0,
        Math.round((job.finishedAt - job.createdAt) / 1000)
    );
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remSeconds}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}
