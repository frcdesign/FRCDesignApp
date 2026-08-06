import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
    Button,
    Group,
    Loader,
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
import { ReactNode } from "react";
import { IconColor, IconSize } from "../../common/style-constants";
import { formatDuration, formatRelativeTime } from "../../common/format-time";
import {
    PageError,
    SectionError,
    SectionLoading
} from "../../app-common/app-zero-state";
import { useLibraryJobsQuery } from "../../queries";
import { hasEditorAccess } from "../../../shared/types";
import { useLoaderData } from "@tanstack/react-router";
import { type LibraryJob } from "../../../shared/library-job-models";

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
        <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing="sm" striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Job</Table.Th>
                        <Table.Th>Triggered by</Table.Th>
                        <Table.Th>Started</Table.Th>
                        <Table.Th>Duration</Table.Th>
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
                                <Text size="sm" c="dimmed">
                                    {job.triggeredBy ?? "—"}
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
                                <Text size="sm">{durationLabel(job)}</Text>
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
                <StatusLabel
                    icon={
                        <IconCircleCheck
                            size={IconSize.MEDIUM}
                            color={IconColor.GREEN}
                        />
                    }
                    label="Complete"
                />
            );
        case "partial":
            return (
                <StatusLabel
                    icon={
                        <IconAlertTriangle
                            size={IconSize.MEDIUM}
                            color={IconColor.YELLOW}
                        />
                    }
                    label={props.job.error ?? "Partial"}
                />
            );
        case "errored":
            return (
                <StatusLabel
                    icon={
                        <IconCircleX
                            size={IconSize.MEDIUM}
                            color={IconColor.RED}
                        />
                    }
                    label={props.job.error ?? "Errored"}
                />
            );
    }
}

function StatusLabel(props: { icon: ReactNode; label: string }): ReactNode {
    return (
        <Group gap={6} wrap="nowrap">
            {props.icon}
            <Text size="sm">{props.label}</Text>
        </Group>
    );
}

function durationLabel(job: LibraryJob): string {
    if (job.status === "running" || job.finishedAt === null) return "—";
    return formatDuration(job.createdAt, job.finishedAt);
}
