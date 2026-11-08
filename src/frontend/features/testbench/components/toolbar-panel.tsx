import {
    Button,
    Group,
    JsonInput,
    NumberInput,
    Stack,
    Table,
    Text
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ONSHAPE_API_VERSION } from "@backend/lib/onshape/client";
import type { OnshapeCallBody } from "@backend/features/testbench/contract";
import { m } from "../../../paraglide/messages";
import { showErrorToast } from "../../../lib/notifications";
import { callOnshape } from "../queries";
import {
    createToolsCall,
    deleteToolsCall,
    listToolsCall,
    SAMPLE_CREATE_BODY,
    toCreatedTool,
    USER_OWNER_TYPE,
    type ToolbarTool,
    type ToolbarToolList
} from "../toolbar";
import { CallResult, StatusBadge } from "./call-result";
import { CallError } from "./onshape-call-form";

const INTERNAL_VERSION = 14;

interface SessionInfo {
    id: string;
}

/** Whether a custom toolbar can be read, added to and pruned from outside Onshape's web client. */
export function ToolbarPanel(): ReactNode {
    const [version, setVersion] = useState(ONSHAPE_API_VERSION);
    const [createBody, setCreateBody] = useState(
        JSON.stringify(SAMPLE_CREATE_BODY, null, 2)
    );
    // Only on a click: each is a call against the owner's limit.
    const tools = useMutation({
        mutationFn: async () => {
            const session = await callOnshape({
                method: "GET",
                version: ONSHAPE_API_VERSION,
                path: "/users/sessioninfo"
            });
            return {
                userId: (session.body as SessionInfo | undefined)?.id,
                list: await callOnshape(listToolsCall(version))
            };
        }
    });
    const write = useMutation({
        mutationFn: (body: OnshapeCallBody) => callOnshape(body)
    });

    const userId = tools.data?.userId;
    const listed = (tools.data?.list.body as ToolbarToolList | undefined)
        ?.items;
    const own = listed?.filter((tool) => tool.ownerType === USER_OWNER_TYPE);

    const create = () => {
        if (!userId) {
            return;
        }
        try {
            write.mutate(
                createToolsCall(version, userId, JSON.parse(createBody))
            );
        } catch {
            showErrorToast(m.testbenchInvalidJson());
        }
    };
    const remove = (tool: ToolbarTool) => {
        if (userId) {
            write.mutate(deleteToolsCall(version, userId, [tool.id]));
        }
    };
    const copy = (tool: ToolbarTool) => {
        const draft = parseOr(createBody, SAMPLE_CREATE_BODY);
        const insertableId = draft.tools?.[0]?.insertableId;
        setCreateBody(
            JSON.stringify(
                {
                    ...draft,
                    tools: [{ insertableId, tool: toCreatedTool(tool) }]
                },
                null,
                2
            )
        );
    };

    return (
        <Stack>
            <Text size="sm" c="dimmed">
                {m.testbenchToolbarDescription()}
            </Text>
            <Group align="end">
                <NumberInput
                    label={m.testbenchVersion()}
                    value={version}
                    min={1}
                    max={99}
                    onChange={(value) => setVersion(Number(value))}
                    w={90}
                />
                <Button
                    variant="default"
                    onClick={() => setVersion(INTERNAL_VERSION)}
                >
                    {m.testbenchUseVersion({ version: INTERNAL_VERSION })}
                </Button>
                <Button
                    variant="default"
                    onClick={() => setVersion(ONSHAPE_API_VERSION)}
                >
                    {m.testbenchUseVersion({ version: ONSHAPE_API_VERSION })}
                </Button>
                <Text size="sm">
                    {m.testbenchUserId({ userId: userId ?? "…" })}
                </Text>
            </Group>

            <Group gap="xs">
                <Button
                    variant="default"
                    loading={tools.isPending}
                    onClick={() => tools.mutate()}
                >
                    {m.testbenchToolbarList()}
                </Button>
                {tools.data && <StatusBadge status={tools.data.list.status} />}
                {listed && (
                    <Text size="sm" c="dimmed">
                        {m.testbenchToolbarCounts({
                            total: listed.length,
                            own: own?.length ?? 0
                        })}
                    </Text>
                )}
            </Group>
            {tools.error && <CallError error={tools.error} />}
            {tools.data && !listed && <CallResult result={tools.data.list} />}
            {own && own.length > 0 && (
                <Table striped>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>{m.testbenchToolName()}</Table.Th>
                            <Table.Th>{m.testbenchToolCommand()}</Table.Th>
                            <Table.Th>{m.testbenchToolId()}</Table.Th>
                            <Table.Th />
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {own.map((tool) => (
                            <Table.Tr key={tool.id}>
                                <Table.Td>{tool.name}</Table.Td>
                                <Table.Td>{tool.command}</Table.Td>
                                <Table.Td>
                                    <Text size="xs" ff="monospace">
                                        {tool.id}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Group gap="xs" wrap="nowrap">
                                        <Button
                                            size="compact-sm"
                                            variant="default"
                                            onClick={() => copy(tool)}
                                        >
                                            {m.testbenchToolCopy()}
                                        </Button>
                                        <Button
                                            size="compact-sm"
                                            color="red"
                                            variant="light"
                                            disabled={!userId}
                                            onClick={() => remove(tool)}
                                        >
                                            {m.testbenchToolRemove()}
                                        </Button>
                                    </Group>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}

            <Text fw={600}>
                {m.testbenchToolbarCreate({ userId: userId ?? "…" })}
            </Text>
            <JsonInput
                value={createBody}
                onChange={setCreateBody}
                autosize
                minRows={6}
                maxRows={30}
            />
            <Group>
                <Button
                    onClick={create}
                    disabled={!userId}
                    loading={write.isPending}
                >
                    {m.testbenchToolbarCreateButton()}
                </Button>
            </Group>
            {write.data && <CallResult result={write.data} />}
            {write.error && <CallError error={write.error} />}
        </Stack>
    );
}

interface CreateDraft {
    tools?: { insertableId?: string }[];
}

function parseOr(text: string, fallback: CreateDraft): CreateDraft {
    try {
        return JSON.parse(text) as CreateDraft;
    } catch {
        return fallback;
    }
}
