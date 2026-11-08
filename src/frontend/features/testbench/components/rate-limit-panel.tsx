import {
    Button,
    Code,
    Group,
    Stack,
    Table,
    Text,
    Textarea,
    TextInput
} from "@mantine/core";
import { type ReactNode, useState } from "react";
import type {
    OnshapeCallBody,
    OnshapeCallResult
} from "@backend/features/testbench/contract";
import type { ElementPath } from "@backend/lib/onshape/path";
import { m } from "../../../paraglide/messages";
import { parseOnshapeUrl } from "../../../lib/onshape-url";
import { toCallBody, type CallDraft } from "../call-draft";
import { DEFAULT_SCRIPT, PRESET_IDS, PresetId, presetCall } from "../presets";
import { callOnshape } from "../queries";
import { limitHeaderLines } from "../rate-limit";
import { StatusBadge } from "./call-result";

/** The raw request tab's call, checked beside the presets. */
const RAW_TARGET = "raw";

type Target = PresetId | typeof RAW_TARGET;

const TARGETS: Target[] = [...PRESET_IDS, RAW_TARGET];

function targetLabel(target: Target): string {
    switch (target) {
        case PresetId.EVALUATE_FEATURESCRIPT:
            return m.testbenchPresetEvaluateFeatureScript();
        case PresetId.PART_STUDIO_FEATURES:
            return m.testbenchPresetPartStudioFeatures();
        case PresetId.ASSEMBLY_DEFINITION:
            return m.testbenchPresetAssemblyDefinition();
        case PresetId.ASSEMBLY_FEATURES:
            return m.testbenchPresetAssemblyFeatures();
        case PresetId.DOCUMENT_ELEMENTS:
            return m.testbenchPresetDocumentElements();
        case PresetId.SESSION_INFO:
            return m.testbenchPresetSessionInfo();
        case RAW_TARGET:
            return m.testbenchPresetRaw();
    }
}

function toElementPath(url: string): ElementPath | undefined {
    const path = parseOnshapeUrl(url);
    if (!path?.instanceType || !path.instanceId || !path.elementId) {
        return undefined;
    }
    return {
        documentId: path.documentId,
        instanceType: path.instanceType,
        instanceId: path.instanceId,
        elementId: path.elementId
    };
}

/** What one target's check came to; absent until it has run. */
interface Check {
    call: OnshapeCallBody;
    result?: OnshapeCallResult;
    error?: string;
}

interface RateLimitPanelProps {
    rawDraft: CallDraft;
}

/** Makes each call once and shows the rate-limit headers Onshape answers with. */
export function RateLimitPanel(props: RateLimitPanelProps): ReactNode {
    const { rawDraft } = props;
    const [partStudioUrl, setPartStudioUrl] = useState("");
    const [assemblyUrl, setAssemblyUrl] = useState("");
    const [script, setScript] = useState(DEFAULT_SCRIPT);
    const [checks, setChecks] = useState<Partial<Record<Target, Check>>>({});
    const [checking, setChecking] = useState<Target>();

    const elements = {
        partStudio: toElementPath(partStudioUrl),
        assembly: toElementPath(assemblyUrl)
    };
    const callFor = (target: Target): OnshapeCallBody | undefined => {
        if (target !== RAW_TARGET) {
            return presetCall(target, elements, script);
        }
        const body = toCallBody(rawDraft);
        return body && { ...body, includeBody: false };
    };

    const check = async (target: Target) => {
        const call = callFor(target);
        if (!call) {
            return;
        }
        setChecking(target);
        try {
            const result = await callOnshape(call);
            setChecks((all) => ({ ...all, [target]: { call, result } }));
        } catch (error) {
            setChecks((all) => ({
                ...all,
                [target]: {
                    call,
                    error:
                        error instanceof Error ? error.message : String(error)
                }
            }));
        } finally {
            setChecking(undefined);
        }
    };

    // One after another, so each call's headers don't count the others in flight.
    const checkAll = async () => {
        for (const target of TARGETS) {
            await check(target);
        }
    };

    return (
        <Stack>
            <Text size="sm" c="dimmed">
                {m.testbenchRateLimitDescription()}
            </Text>
            <UrlInput
                label={m.testbenchPartStudioUrl()}
                value={partStudioUrl}
                onChange={setPartStudioUrl}
                valid={elements.partStudio !== undefined}
            />
            <UrlInput
                label={m.testbenchAssemblyUrl()}
                value={assemblyUrl}
                onChange={setAssemblyUrl}
                valid={elements.assembly !== undefined}
            />
            <Textarea
                label={m.testbenchScript()}
                value={script}
                onChange={(event) => setScript(event.currentTarget.value)}
                autosize
                minRows={2}
                styles={{ input: { fontFamily: "monospace" } }}
            />
            <Group>
                <Button
                    onClick={() => void checkAll()}
                    loading={checking !== undefined}
                >
                    {m.testbenchCheckAll()}
                </Button>
            </Group>
            <Table>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>{m.testbenchTarget()}</Table.Th>
                        <Table.Th>{m.testbenchSampleStatus()}</Table.Th>
                        <Table.Th>{m.testbenchSampleLimitHeaders()}</Table.Th>
                        <Table.Th />
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {TARGETS.map((target) => {
                        const call = callFor(target);
                        const done = checks[target];
                        return (
                            <Table.Tr key={target}>
                                <Table.Td>
                                    <Text size="sm">{targetLabel(target)}</Text>
                                    <Text
                                        size="xs"
                                        c="dimmed"
                                        style={{ wordBreak: "break-all" }}
                                    >
                                        {call
                                            ? `${call.method} /api/v${call.version}${call.path}`
                                            : m.testbenchNeedsElement()}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    {done?.result && (
                                        <StatusBadge
                                            status={done.result.status}
                                        />
                                    )}
                                </Table.Td>
                                <Table.Td>
                                    {done?.error ? (
                                        <Text size="xs" c="red">
                                            {done.error}
                                        </Text>
                                    ) : (
                                        done?.result && (
                                            <LimitHeaders
                                                result={done.result}
                                            />
                                        )
                                    )}
                                </Table.Td>
                                <Table.Td>
                                    <Button
                                        size="compact-sm"
                                        variant="default"
                                        disabled={!call}
                                        loading={checking === target}
                                        onClick={() => void check(target)}
                                    >
                                        {m.testbenchCheck()}
                                    </Button>
                                </Table.Td>
                            </Table.Tr>
                        );
                    })}
                </Table.Tbody>
            </Table>
        </Stack>
    );
}

interface UrlInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    valid: boolean;
}

function UrlInput(props: UrlInputProps): ReactNode {
    const { label, value, onChange, valid } = props;
    return (
        <TextInput
            label={label}
            description={m.testbenchElementUrlDescription()}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            error={value && !valid ? m.testbenchElementUrlInvalid() : undefined}
        />
    );
}

interface LimitHeadersProps {
    result: OnshapeCallResult;
}

/** Every header, when none looks like a limit's, so a differently named one isn't missed. */
function LimitHeaders(props: LimitHeadersProps): ReactNode {
    const { result } = props;
    const lines = limitHeaderLines(result.headers);
    if (lines.length > 0) {
        return <Code block>{lines.join("\n")}</Code>;
    }
    return (
        <details>
            <summary>{m.testbenchNoLimitHeaders()}</summary>
            <Code block>{JSON.stringify(result.headers, null, 2)}</Code>
        </details>
    );
}
