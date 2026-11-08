import {
    Alert,
    Button,
    Checkbox,
    Code,
    CopyButton,
    Group,
    NumberInput,
    Select,
    SimpleGrid,
    Stack,
    Table,
    Text,
    Textarea,
    TextInput
} from "@mantine/core";
import { type ReactNode, useRef, useState } from "react";
import type { OnshapeCallBody } from "@backend/features/testbench/contract";
import type { ElementPath } from "@backend/lib/onshape/path";
import { m } from "../../../paraglide/messages";
import { parseOnshapeUrl } from "../../../lib/onshape-url";
import {
    BurstPhase,
    isLimitHeader,
    runBurst,
    summarizeBurst,
    type BurstOptions,
    type BurstSample,
    type BurstSummary
} from "../burst";
import { DEFAULT_SCRIPT, PRESET_IDS, PresetId, presetCall } from "../presets";
import { callOnshape } from "../queries";
import { StatusBadge } from "./call-result";
import { toCallBody, type CallDraft } from "../call-draft";

/** The raw request tab's call, as a burst target beside the presets. */
const RAW_TARGET = "raw";

type Target = PresetId | typeof RAW_TARGET;

const TARGETS: Target[] = [...PRESET_IDS, RAW_TARGET];

const DEFAULT_OPTIONS: BurstOptions = {
    total: 200,
    concurrency: 5,
    stopOnLimit: true,
    pollSeconds: 10,
    maxWaitSeconds: 900
};

const SHOWN_SAMPLES = 200;

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

interface RateLimitPanelProps {
    rawDraft: CallDraft;
}

/** Repeats one call until Onshape answers 429, then waits out the limit. */
export function RateLimitPanel(props: RateLimitPanelProps): ReactNode {
    const { rawDraft } = props;
    const [target, setTarget] = useState<Target>(
        PresetId.EVALUATE_FEATURESCRIPT
    );
    const [url, setUrl] = useState("");
    const [script, setScript] = useState(DEFAULT_SCRIPT);
    const [options, setOptions] = useState(DEFAULT_OPTIONS);
    const [samples, setSamples] = useState<BurstSample[]>([]);
    const [running, setRunning] = useState(false);
    const [ranCall, setRanCall] = useState<OnshapeCallBody>();
    const controller = useRef<AbortController>(undefined);

    const element = toElementPath(url);
    const call =
        target === RAW_TARGET
            ? rawCall(rawDraft)
            : presetCall(target, element, script);
    const summary = samples.length > 0 ? summarizeBurst(samples) : undefined;

    const start = async () => {
        if (!call) {
            return;
        }
        const abort = new AbortController();
        controller.current = abort;
        setSamples([]);
        setRanCall(call);
        setRunning(true);
        try {
            await runBurst(
                () => callOnshape(call, abort.signal),
                options,
                (sample) => setSamples((all) => [...all, sample]),
                abort.signal
            );
        } finally {
            setRunning(false);
        }
    };

    const setOption = <K extends keyof BurstOptions>(
        key: K,
        value: BurstOptions[K]
    ) => setOptions((all) => ({ ...all, [key]: value }));

    return (
        <Stack>
            <Alert color="orange">{m.testbenchRateLimitWarning()}</Alert>
            <Select
                label={m.testbenchTarget()}
                data={TARGETS.map((value) => ({
                    value,
                    label: targetLabel(value)
                }))}
                value={target}
                allowDeselect={false}
                onChange={(value) => value && setTarget(value)}
            />
            {target !== RAW_TARGET && target !== PresetId.SESSION_INFO && (
                <TextInput
                    label={m.testbenchElementUrl()}
                    description={m.testbenchElementUrlDescription()}
                    value={url}
                    onChange={(event) => setUrl(event.currentTarget.value)}
                    error={
                        url && !element
                            ? m.testbenchElementUrlInvalid()
                            : undefined
                    }
                />
            )}
            {target === PresetId.EVALUATE_FEATURESCRIPT && (
                <Textarea
                    label={m.testbenchScript()}
                    value={script}
                    onChange={(event) => setScript(event.currentTarget.value)}
                    autosize
                    minRows={2}
                    styles={{ input: { fontFamily: "monospace" } }}
                />
            )}
            {call && (
                <Code
                    block
                >{`${call.method} /api/v${call.version}${call.path}`}</Code>
            )}
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
                <NumberInput
                    label={m.testbenchTotal()}
                    value={options.total}
                    min={1}
                    max={5000}
                    onChange={(value) => setOption("total", Number(value))}
                />
                <NumberInput
                    label={m.testbenchConcurrency()}
                    value={options.concurrency}
                    min={1}
                    max={50}
                    onChange={(value) =>
                        setOption("concurrency", Number(value))
                    }
                />
                <NumberInput
                    label={m.testbenchPollSeconds()}
                    value={options.pollSeconds}
                    min={1}
                    onChange={(value) =>
                        setOption("pollSeconds", Number(value))
                    }
                />
                <NumberInput
                    label={m.testbenchMaxWaitSeconds()}
                    value={options.maxWaitSeconds}
                    min={0}
                    onChange={(value) =>
                        setOption("maxWaitSeconds", Number(value))
                    }
                />
            </SimpleGrid>
            <Checkbox
                label={m.testbenchStopOnLimit()}
                checked={options.stopOnLimit}
                onChange={(event) =>
                    setOption("stopOnLimit", event.currentTarget.checked)
                }
            />
            <Group>
                <Button
                    onClick={() => void start()}
                    disabled={!call || running}
                >
                    {m.testbenchStart()}
                </Button>
                <Button
                    variant="default"
                    disabled={!running}
                    onClick={() => controller.current?.abort()}
                >
                    {m.testbenchStop()}
                </Button>
                {summary && (
                    <CopyButton
                        value={JSON.stringify(
                            { call: ranCall, options, summary, samples },
                            null,
                            2
                        )}
                    >
                        {({ copied, copy }) => (
                            <Button variant="default" onClick={copy}>
                                {copied
                                    ? m.testbenchCopied()
                                    : m.testbenchCopyResults()}
                            </Button>
                        )}
                    </CopyButton>
                )}
                {running && <Text size="sm">{m.testbenchRunning()}</Text>}
            </Group>
            {summary && <BurstSummaryView summary={summary} />}
            {samples.length > 0 && <SampleTable samples={samples} />}
        </Stack>
    );
}

function rawCall(draft: CallDraft): OnshapeCallBody | undefined {
    const body = toCallBody(draft);
    return body && { ...body, includeBody: false };
}

interface BurstSummaryViewProps {
    summary: BurstSummary;
}

function BurstSummaryView(props: BurstSummaryViewProps): ReactNode {
    const { summary } = props;
    const seconds = (ms: number) => (ms / 1000).toFixed(1);
    return (
        <Stack gap="xs">
            <Text size="sm">
                {m.testbenchSummaryCounts({
                    sent: summary.sent,
                    ok: summary.ok,
                    limited: summary.limited,
                    failed: summary.failed,
                    seconds: seconds(summary.elapsedMs),
                    rate: summary.requestsPerSecond.toFixed(1)
                })}
            </Text>
            <Text size="sm">
                {m.testbenchSummaryLatency({
                    p50: summary.roundTripP50 ?? 0,
                    p95: summary.roundTripP95 ?? 0,
                    onshape: summary.onshapeP50 ?? 0
                })}
            </Text>
            <Text size="sm" fw={600}>
                {summary.firstLimit
                    ? m.testbenchSummaryFirstLimit({
                          index: summary.firstLimit.index + 1,
                          okBefore: summary.firstLimit.okBefore,
                          seconds: seconds(summary.firstLimit.startedAtMs)
                      })
                    : m.testbenchSummaryNoLimit()}
            </Text>
            {summary.firstLimit && (
                <Text size="sm" fw={600}>
                    {summary.recoveredAfterMs === undefined
                        ? m.testbenchSummaryNotRecovered()
                        : m.testbenchSummaryRecovered({
                              seconds: seconds(summary.recoveredAfterMs)
                          })}
                </Text>
            )}
            <Code block>{JSON.stringify(summary.statuses)}</Code>
            {summary.limitHeaders.length > 0 && (
                <Code block>
                    {summary.limitHeaders
                        .map(
                            (header) =>
                                `${header.name}: ${header.first} → ${header.last} (${header.values.length})`
                        )
                        .join("\n")}
                </Code>
            )}
        </Stack>
    );
}

interface SampleTableProps {
    samples: BurstSample[];
}

/** The newest calls first. */
function SampleTable(props: SampleTableProps): ReactNode {
    const shown = [...props.samples]
        .sort((a, b) => b.index - a.index)
        .slice(0, SHOWN_SAMPLES);
    return (
        <Table striped fz="xs">
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>{m.testbenchSampleAt()}</Table.Th>
                    <Table.Th>{m.testbenchSampleStatus()}</Table.Th>
                    <Table.Th>{m.testbenchSampleRoundTrip()}</Table.Th>
                    <Table.Th>{m.testbenchSampleLimitHeaders()}</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {shown.map((sample) => (
                    <Table.Tr key={sample.index}>
                        <Table.Td>
                            {sample.index + 1}
                            {sample.phase === BurstPhase.RECOVERY && " ⟳"}
                        </Table.Td>
                        <Table.Td>
                            {(sample.startedAtMs / 1000).toFixed(2)}
                        </Table.Td>
                        <Table.Td>
                            <StatusBadge status={sample.status} />
                        </Table.Td>
                        <Table.Td>{sample.roundTripMs}</Table.Td>
                        <Table.Td style={{ wordBreak: "break-all" }}>
                            {sample.error ?? limitHeaderText(sample)}
                        </Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );
}

function limitHeaderText(sample: BurstSample): string {
    return Object.entries(sample.headers)
        .filter(([name]) => isLimitHeader(name))
        .map(([name, value]) => `${name}: ${value}`)
        .join(", ");
}
