import { Center, Loader } from "@mantine/core";
import {
    type Dispatch,
    ReactNode,
    useCallback,
    useEffect,
    useMemo
} from "react";
import {
    type PartialSelection,
    Selection,
    type ConfigurationKey,
    ConfigurationResult,
    ConfigurationParameter,
    SearchRecord
} from "@backend/features/configurations/contract";
import {
    findRecord,
    normalizeSelection,
    onshapeOverrides,
    sameSelection,
    toKey,
    toSelection,
    toStoredSelection,
    fillDerivationValues
} from "@backend/features/configurations/selection";
import { useConfigurationQuery } from "../queries";
import { SectionError } from "../../../components/app-notice";
import {
    ParameterGrid,
    ParameterInput
} from "../../../components/parameter-input";
import { withParameterValue } from "../parameter-value";

/** Reported by the panel, since only it has the parameters. */
export interface SelectionReport {
    /** Whole, and settled against the parameters' conditions. */
    selection: Selection;
    /** What the url keeps. */
    overrides: PartialSelection;
    /** What a favorite keeps: the whole selection, less its derivation variables. */
    stored: PartialSelection;
    /** Names the selection's thumbnail. */
    configurationKey: ConfigurationKey;
    /** The part the selection produces, for the menu's header. */
    record: SearchRecord | undefined;
}

interface ConfigurationWrapperProps {
    insertableId: string;
    microversionId: string;
    /** Partial until the parameters load: a search hit names only its own. */
    selection?: PartialSelection;
    setSelection: Dispatch<Selection>;
    onReport?: (report: SelectionReport) => void;
    /** A person changed a row, as opposed to the panel settling on load. */
    onEdit?: () => void;
}

function useReportSelection(
    result: ConfigurationResult | undefined,
    selection: Selection | undefined,
    onReport?: (report: SelectionReport) => void
) {
    useEffect(() => {
        if (!result || !selection) {
            return;
        }
        onReport?.({
            selection,
            overrides: toStoredSelection(
                onshapeOverrides(selection, result.parameters),
                result.parameters
            ),
            stored: toStoredSelection(selection, result.parameters),
            configurationKey: toKey(selection, result.parameters),
            record: findRecord(selection, result.records)
        });
    }, [result, selection, onReport]);
}

export function ConfigurationWrapper(
    props: ConfigurationWrapperProps
): ReactNode {
    const {
        insertableId,
        microversionId,
        selection,
        setSelection,
        onReport,
        onEdit
    } = props;

    const query = useConfigurationQuery(insertableId, microversionId);

    const parameters = query.data?.parameters;
    // A search hit names only its overrides, so fill in the rest and apply the
    // conditions here, rather than each row writing back its own value.
    const whole = useMemo(
        () =>
            parameters
                ? fillDerivationValues(
                      normalizeSelection(
                          toSelection(selection ?? {}, parameters),
                          parameters
                      ),
                      parameters
                  )
                : undefined,
        [parameters, selection]
    );

    // The menu inserts the selection it holds, so settling has to reach it.
    // `sameSelection` stops the loop once normalizeSelection reaches a fixed point.
    useEffect(() => {
        if (whole && !sameSelection(selection, whole)) {
            setSelection(whole);
        }
    }, [whole, selection, setSelection]);

    useReportSelection(query.data, whole, onReport);

    const editSelection = useCallback(
        (newSelection: Selection) => {
            onEdit?.();
            setSelection(newSelection);
        },
        [onEdit, setSelection]
    );

    // A failed fetch also leaves `whole` undefined, so check this first.
    if (query.isError) {
        return <SectionError title="Failed to load selection." />;
    }
    if (query.isPending || !whole) {
        return (
            <Center my="md">
                <Loader />
            </Center>
        );
    }

    return (
        <ConfigurationParameters
            configurationResult={query.data}
            selection={whole}
            setSelection={editSelection}
        />
    );
}

interface ConfigurationParametersProps {
    configurationResult: ConfigurationResult;
    selection: Selection;
    setSelection: Dispatch<Selection>;
}

function ConfigurationParameters(
    props: ConfigurationParametersProps
): ReactNode {
    const { configurationResult, selection, setSelection } = props;

    return (
        <ParameterGrid>
            {configurationResult.parameters.map((parameter) => (
                <ParameterRow
                    key={parameter.id}
                    parameter={parameter}
                    selection={selection}
                    setSelection={setSelection}
                    parameters={configurationResult.parameters}
                />
            ))}
        </ParameterGrid>
    );
}

interface ParameterRowProps {
    parameter: ConfigurationParameter;
    selection: Selection;
    setSelection: Dispatch<Selection>;
    parameters: ConfigurationParameter[];
}

/** Its own component so its handler keeps a stable identity. */
function ParameterRow(props: ParameterRowProps): ReactNode {
    const { parameter, selection, setSelection, parameters } = props;

    const handleValueChange = useCallback(
        (newValue: string | undefined) => {
            setSelection(withParameterValue(selection, parameter, newValue));
        },
        [parameter, selection, setSelection]
    );

    return (
        <ParameterInput
            parameter={parameter}
            value={selection[parameter.id]}
            selection={selection}
            parameters={parameters}
            onValueChange={handleValueChange}
        />
    );
}
