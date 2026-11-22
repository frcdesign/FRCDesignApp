import { Stack } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { type ElementPath } from "@backend/lib/onshape/path";
import { PageError, PageLoading } from "../../../components/app-notice";
import { RefreshButton } from "../../../components/refresh-button";
import { SectionCard } from "../../../components/section";
import { m } from "../../../paraglide/messages";
import {
    findLevel,
    missingParts,
    POUNDS_PER_KILOGRAM,
    sumMass
} from "../mass-data";
import { useMassReportQuery } from "../queries";
import { MassTreemap } from "./mass-treemap";
import { MissingMassList } from "./missing-mass-list";

interface MassAnalysisPanelProps {
    assembly: ElementPath;
}

/** The assembly's mass by item, then what has none, both at the level opened. */
export function MassAnalysisPanel({
    assembly
}: MassAnalysisPanelProps): ReactNode {
    const report = useMassReportQuery(assembly);
    const [path, setPath] = useState<string[]>([]);

    if (report.isPending) {
        return <PageLoading title={m.massAnalysisLoading()} />;
    }
    if (report.isError) {
        return (
            <PageError
                title={m.massAnalysisLoadFailed()}
                error={report.error}
            />
        );
    }

    const level = findLevel(report.data, path);
    const pounds = sumMass(level.children) * POUNDS_PER_KILOGRAM;

    return (
        <Stack gap="md" p="md">
            <SectionCard
                title={m.massAnalysisChartTitle()}
                caption={m.massAnalysisPounds({ mass: pounds })}
                aside={
                    <RefreshButton
                        loading={report.isFetching}
                        onClick={() => void report.refetch()}
                    />
                }
            >
                <MassTreemap level={level} onOpen={setPath} />
            </SectionCard>
            <MissingMassList
                assembly={assembly}
                missing={missingParts(level.children)}
            />
        </Stack>
    );
}
