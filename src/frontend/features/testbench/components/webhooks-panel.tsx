import {
    Button,
    Checkbox,
    Code,
    Group,
    JsonInput,
    Paper,
    SimpleGrid,
    Stack,
    Text,
    TextInput
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
    SUGGESTED_EVENTS,
    type WebhookProbeOut
} from "@backend/features/testbench/contract";
import { m } from "../../../paraglide/messages";
import { showErrorToast } from "../../../lib/notifications";
import {
    useDeleteProbeMutation,
    useRegisterProbeMutation,
    webhookProbesQuery
} from "../queries";
import { CallError } from "./onshape-call-form";

const SCOPE_KEYS = ["documentId", "workspaceId", "companyId"] as const;

type Scope = Record<(typeof SCOPE_KEYS)[number], string>;

interface WebhooksPanelProps {
    active: boolean;
}

/** Registers a webhook pointed back at the app, and lists what Onshape sends it. */
export function WebhooksPanel(props: WebhooksPanelProps): ReactNode {
    const { active } = props;
    const [events, setEvents] = useState<string[]>([]);
    const [other, setOther] = useState("");
    const [scope, setScope] = useState<Scope>({
        documentId: "",
        workspaceId: "",
        companyId: ""
    });
    const [params, setParams] = useState("{}");
    const probes = useQuery({ ...webhookProbesQuery, enabled: active });
    const register = useRegisterProbeMutation();

    const submit = () => {
        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(params || "{}") as Record<string, unknown>;
        } catch {
            showErrorToast(m.testbenchInvalidJson());
            return;
        }
        for (const key of SCOPE_KEYS) {
            const value = scope[key].trim();
            if (value) {
                parsed[key] = value;
            }
        }
        const all = events.concat(
            other
                .split(",")
                .map((each) => each.trim())
                .filter(Boolean)
        );
        register.mutate({ events: all, params: parsed });
    };

    return (
        <Stack>
            <Text size="sm" c="dimmed">
                {m.testbenchWebhooksDescription()}
            </Text>
            <Checkbox.Group value={events} onChange={setEvents}>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={4}>
                    {SUGGESTED_EVENTS.map((event) => (
                        <Checkbox key={event} value={event} label={event} />
                    ))}
                </SimpleGrid>
            </Checkbox.Group>
            <TextInput
                label={m.testbenchOtherEvents()}
                value={other}
                onChange={(event) => setOther(event.currentTarget.value)}
            />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                {SCOPE_KEYS.map((key) => (
                    <TextInput
                        key={key}
                        label={key}
                        value={scope[key]}
                        onChange={(event) =>
                            setScope({
                                ...scope,
                                [key]: event.currentTarget.value
                            })
                        }
                    />
                ))}
            </SimpleGrid>
            <JsonInput
                label={m.testbenchOtherParams()}
                value={params}
                onChange={setParams}
                autosize
                minRows={1}
            />
            <Group>
                <Button onClick={submit} loading={register.isPending}>
                    {m.testbenchRegister()}
                </Button>
                {register.data && (
                    <Text size="sm" c={register.data.error ? "red" : undefined}>
                        {register.data.error
                            ? m.testbenchOnshapeRefused({
                                  error: register.data.error
                              })
                            : m.testbenchRegistered({
                                  webhookId: register.data.webhookId ?? ""
                              })}
                    </Text>
                )}
            </Group>
            {register.error && <CallError error={register.error} />}
            {probes.error && <CallError error={probes.error} />}
            {probes.data?.map((probe) => (
                <ProbeCard key={probe.id} probe={probe} />
            ))}
        </Stack>
    );
}

interface ProbeCardProps {
    probe: WebhookProbeOut;
}

function ProbeCard(props: ProbeCardProps): ReactNode {
    const { probe } = props;
    const remove = useDeleteProbeMutation();
    return (
        <Paper withBorder p="sm">
            <Stack gap="xs">
                <Group justify="space-between">
                    <Text size="sm">
                        {probe.webhookId
                            ? m.testbenchProbeRegistered({
                                  createdAt: probe.createdAt,
                                  webhookId: probe.webhookId
                              })
                            : m.testbenchProbeNotRegistered({
                                  createdAt: probe.createdAt
                              })}
                    </Text>
                    <Button
                        size="compact-sm"
                        color="red"
                        variant="light"
                        loading={remove.isPending}
                        onClick={() => remove.mutate(probe.id)}
                    >
                        {m.testbenchProbeDelete()}
                    </Button>
                </Group>
                {probe.error && (
                    <Text size="sm" c="red">
                        {m.testbenchOnshapeRefused({ error: probe.error })}
                    </Text>
                )}
                <Code block>{JSON.stringify(probe.params, null, 2)}</Code>
                <Text size="sm" c="dimmed">
                    {m.testbenchDeliveries({ count: probe.deliveries.length })}
                </Text>
                {probe.deliveries.map((delivery) => (
                    <Code block key={delivery.receivedAt}>
                        {`${delivery.receivedAt}\n${JSON.stringify(delivery.body, null, 2)}`}
                    </Code>
                ))}
            </Stack>
        </Paper>
    );
}
