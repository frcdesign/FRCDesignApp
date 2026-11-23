import { Stack } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { type ElementPath } from "@backend/lib/onshape/path";
import { PageError, PageLoading } from "../../../components/app-notice";
import { RefreshButton } from "../../../components/refresh-button";
import { SectionCard } from "../../../components/section";
import { m } from "../../../paraglide/messages";
import { Unit } from "@backend/features/configurations/enums";
import { useUnitInfo } from "../../../lib/unit-info";
import { DEFAULT_QUANTITY_PRECISION } from "@backend/features/configurations/utils";
import {
    findLevel,
    formatMass,
    type MassDisplay,
    missingParts,
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
    const unitInfo = useUnitInfo();
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
    // Kilograms, Onshape's base unit, until the document's units load.
    const display: MassDisplay = {
        unit: unitInfo?.massUnit ?? Unit.KILOGRAM,
        precision: unitInfo?.massPrecision ?? DEFAULT_QUANTITY_PRECISION
    };

    return (
        <Stack gap="md" p="md">
            <SectionCard
                title={m.massAnalysisChartTitle()}
                caption={formatMass(sumMass(level.children), display)}
                aside={
                    <RefreshButton
                        loading={report.isFetching}
                        onClick={() => void report.refetch()}
                    />
                }
            >
                <MassTreemap level={level} display={display} onOpen={setPath} />
            </SectionCard>
            <MissingMassList missing={missingParts(level.children)} />
        </Stack>
    );
}
