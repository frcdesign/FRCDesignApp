import {
    Button,
    Card,
    Group,
    NumberInput,
    Select,
    Stack,
    Text
} from "@mantine/core";
import { type ReactNode, useState } from "react";
import { MATERIALS } from "@backend/features/mass-analysis/materials";
import { type ElementPath } from "@backend/lib/onshape/path";
import { Section } from "../../../components/section";
import { SectionNotice } from "../../../components/app-notice";
import { m } from "../../../paraglide/messages";
import { type MissingPart, POUNDS_PER_KILOGRAM } from "../mass-data";
import { useSetPartPropertiesMutation } from "../queries";

const MATERIAL_NAMES = MATERIALS.map((material) => material.name);

interface MissingMassListProps {
    assembly: ElementPath;
    missing: MissingPart[];
}

export function MissingMassList({
    assembly,
    missing
}: MissingMassListProps): ReactNode {
    return (
        <Section
            title={m.massAnalysisMissingTitle()}
            caption={
                missing.length > 0
                    ? m.massAnalysisMissingCaption({ count: missing.length })
                    : undefined
            }
        >
            {missing.length === 0 ? (
                <SectionNotice title={m.massAnalysisMissingNone()} />
            ) : (
                missing.map((entry) => (
                    <MissingPartRow
                        key={entry.part.id}
                        assembly={assembly}
                        missing={entry}
                    />
                ))
            )}
        </Section>
    );
}

interface MissingPartRowProps {
    assembly: ElementPath;
    missing: MissingPart;
}

function MissingPartRow({ assembly, missing }: MissingPartRowProps): ReactNode {
    const save = useSetPartPropertiesMutation(assembly);
    const [material, setMaterial] = useState<string | undefined>(undefined);
    const [pounds, setPounds] = useState<number | undefined>(undefined);

    const { part, count, within } = missing;
    const hasChange = material !== undefined || pounds !== undefined;

    const submit = (): void => {
        save.mutate({
            assembly,
            part: part.source,
            material,
            mass:
                pounds === undefined ? undefined : pounds / POUNDS_PER_KILOGRAM
        });
    };

    return (
        <Card>
            <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                    <Text fw={500} truncate>
                        {part.name}
                    </Text>
                    <Text c="dimmed">{m.massAnalysisQuantity({ count })}</Text>
                </Group>
                {within && (
                    <Text size="sm" c="dimmed">
                        {m.massAnalysisWithin({ assembly: within })}
                    </Text>
                )}
                {part.canSetMass ? (
                    <>
                        <Select
                            label={m.massAnalysisMaterial()}
                            data={MATERIAL_NAMES}
                            value={material ?? null}
                            onChange={(value) =>
                                setMaterial(value ?? undefined)
                            }
                            disabled={!part.canSetMaterial}
                            description={
                                part.canSetMaterial
                                    ? undefined
                                    : m.massAnalysisMaterialOtherDocument()
                            }
                            clearable
                        />
                        <Group align="end" gap="xs" wrap="nowrap">
                            <NumberInput
                                label={m.massAnalysisMassOverride()}
                                flex={1}
                                min={0}
                                decimalScale={3}
                                value={pounds ?? ""}
                                onChange={(value) =>
                                    setPounds(
                                        typeof value === "number" && value > 0
                                            ? value
                                            : undefined
                                    )
                                }
                            />
                            <Button
                                disabled={!hasChange}
                                loading={save.isPending}
                                onClick={submit}
                            >
                                {m.massAnalysisSave()}
                            </Button>
                        </Group>
                    </>
                ) : (
                    <Text size="sm" c="dimmed">
                        {m.massAnalysisLibraryPart()}
                    </Text>
                )}
            </Stack>
        </Card>
    );
}
