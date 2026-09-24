import {
    Center,
    Checkbox,
    type ComboboxProps,
    Loader,
    Select,
    TextInput,
    Tooltip
} from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { AppIcon } from "../../../components/app-icon";
import { StatusColor } from "../../../lib/style-constants";
import {
    type Dispatch,
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    type PartialSelection,
    Selection,
    type ConfigurationKey,
    ConfigurationResult,
    ConfigurationParameter,
    ParameterType,
    EnumParameter,
    BooleanParameter,
    StringParameter,
    QuantityParameter,
    SearchRecord
} from "@backend/features/configurations/contract";
import {
    evaluateCondition,
    getEvaluateOptions,
    getVisibleOptions
} from "@backend/features/configurations/utils";
import {
    findRecord,
    onshapeOverrides,
    toKey,
    toSelection,
    toStoredSelection,
    withDerivationValues
} from "@backend/features/configurations/selection";
import { isDerivationVariable } from "@backend/features/configurations/roles";
import { evaluateExpression } from "@backend/features/configurations/input-parser";
import { useConfigurationQuery, useUnitInfo } from "../queries";
import { SectionNotice } from "../../../components/app-zero-state";
import classes from "./configurations.module.css";
import {
    normalizeSelection,
    resolveSelectedOption,
    sameSelection,
    withParameterValue
} from "../parameter-value";
import { seedFrom } from "../quantity-box";

/**
 * What the panel settled a selection into, reported because only the panel
 * has the parameters each of these is measured against.
 */
export interface SelectionReport {
    /** Whole, and settled against the parameters' conditions. */
    selection: Selection;
    /**
     * Only what differs from the element's defaults, as entered, and without
     * derivation variables: this is what the url keeps.
     */
    overrides: PartialSelection;
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
    /**
     * A row was moved, as against the panel settling the selection on load.
     * Any interaction counts, including picking what was already picked.
     */
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
    // Whole the moment the parameters are known, since a search hit names only
    // its overrides, and settled against the conditions so a row never has to
    // write its own value back through an effect.
    const whole = useMemo(
        () =>
            parameters
                ? withDerivationValues(
                      normalizeSelection(
                          toSelection(selection ?? {}, parameters),
                          parameters
                      ),
                      parameters,
                      true
                  )
                : undefined,
        [parameters, selection]
    );

    // The one place the panel writes back: the menu inserts the selection it
    // holds, so settling has to reach it. `sameSelection` is what stops the
    // loop, and it stops after one write only while normalizeSelection reaches
    // a fixed point — see the cap it can bail out at.
    useEffect(() => {
        if (whole && !sameSelection(selection, whole)) {
            setSelection(whole);
        }
    }, [whole, selection, setSelection]);

    useReportSelection(query.data, whole, onReport);

    // The rows' own writes, as against the settle above: same selection, but
    // only this one is somebody configuring the part.
    const editSelection = useCallback(
        (newSelection: Selection) => {
            onEdit?.();
            setSelection(newSelection);
        },
        [onEdit, setSelection]
    );

    // Before the spinner: a failed fetch leaves `whole` undefined too, so
    // testing that first would spin forever instead of reporting the failure.
    if (query.isError) {
        return <SectionNotice title="Failed to load selection." />;
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
        <div className={classes.grid}>
            {configurationResult.parameters.map((parameter) => (
                <ParameterRow
                    key={parameter.id}
                    parameter={parameter}
                    selection={selection}
                    setSelection={setSelection}
                    parameters={configurationResult.parameters}
                />
            ))}
        </div>
    );
}

interface ParameterCellsProps {
    parameter: ConfigurationParameter;
    children: ReactNode;
}

/** A row of the grid: the parameter's name, then its control. */
function ParameterCells(props: ParameterCellsProps): ReactNode {
    const { parameter, children } = props;
    return (
        <>
            <label className={classes.label} htmlFor={parameter.id}>
                {parameter.name}
            </label>
            {children}
        </>
    );
}

/**
 * At least as wide as the input and at most as wide as the screen, so a long
 * option reads on one line where there is room and wraps where there is not,
 * rather than wrapping inside a dropdown as narrow as a squeezed input.
 */
const DROPDOWN_PROPS: ComboboxProps = {
    width: "max-content",
    position: "bottom-end",
    middlewares: {
        shift: { padding: 8 },
        size: {
            padding: 8,
            apply: ({ rects, availableWidth, elements }) => {
                Object.assign(elements.floating.style, {
                    minWidth: `${rects.reference.width}px`,
                    maxWidth: `${availableWidth}px`
                });
            }
        }
    }
};

interface ParameterRowProps {
    parameter: ConfigurationParameter;
    selection: Selection;
    setSelection: Dispatch<Selection>;
    parameters: ConfigurationParameter[];
}

/**
 * One row, given its own component so its handler is a stable value. Built inside
 * the `.map` it replaces, it changed identity every render — and effects name it.
 */
function ParameterRow(props: ParameterRowProps): ReactNode {
    const { parameter, selection, setSelection, parameters } = props;

    const handleValueChange = useCallback(
        (newValue: string | undefined) => {
            // Hands back the same selection when nothing moves, which React
            // treats as no change at all.
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

interface ParameterProps<T extends ConfigurationParameter> {
    parameter: T;
    /** Absent when the selection omits it, which means the default. */
    value: string | undefined;
    onValueChange: (newValue: string | undefined) => void;
    selection: Selection;
    parameters: ConfigurationParameter[];
}

function ParameterInput(
    props: ParameterProps<ConfigurationParameter>
): ReactNode {
    const { parameter, selection, parameters } = props;

    if (!evaluateCondition(parameter.condition, selection, parameters)) {
        return null;
    }

    // Narrowed on `parameter` rather than `props`, which carries the union.
    switch (parameter.type) {
        case ParameterType.ENUM:
            return <EnumInput {...props} parameter={parameter} />;
        case ParameterType.BOOLEAN:
            return <BooleanInput {...props} parameter={parameter} />;
        case ParameterType.STRING:
            return <StringInput {...props} parameter={parameter} />;
        case ParameterType.QUANTITY:
            return <QuantityInput {...props} parameter={parameter} />;
    }
}

function EnumInput(props: ParameterProps<EnumParameter>): ReactNode {
    const { parameter, value, onValueChange, selection, parameters } = props;

    const visibleOptions = getVisibleOptions(parameter, selection, parameters);
    // Already settled by normalizeSelection; nothing visible means nothing to show.
    const currentOption = resolveSelectedOption(
        visibleOptions,
        value,
        parameter.default
    );
    if (!currentOption) {
        return null;
    }

    return (
        <ParameterCells parameter={parameter}>
            <Select
                id={parameter.id}
                data={visibleOptions.map((option) => ({
                    value: option.id,
                    label: option.name
                }))}
                value={currentOption.id}
                allowDeselect={false}
                checkIconPosition="right"
                maxDropdownHeight={250}
                comboboxProps={DROPDOWN_PROPS}
                onChange={(newValue) => {
                    if (newValue !== null) {
                        onValueChange(newValue);
                    }
                }}
            />
        </ParameterCells>
    );
}

function BooleanInput(props: ParameterProps<BooleanParameter>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <ParameterCells parameter={parameter}>
            <Checkbox
                id={parameter.id}
                className={classes.checkbox}
                checked={(value ?? parameter.default) === "true"}
                onChange={(event) =>
                    onValueChange(
                        event.currentTarget.checked ? "true" : "false"
                    )
                }
            />
        </ParameterCells>
    );
}

/**
 * Why the field is filled in and fixed, beside it where somebody wondering
 * will look.
 */
const DERIVATION_VARIABLE_NOTE =
    "Onshape does not allow deriving the same part with the same configuration multiple times into a part studio. To avoid this limitation, Derivation Variable has been populated with a unique value.";

function StringInput(props: ParameterProps<StringParameter>): ReactNode {
    const { parameter, value, onValueChange } = props;
    if (isDerivationVariable(parameter)) {
        return (
            <ParameterCells parameter={parameter}>
                <TextInput
                    id={parameter.id}
                    value={value ?? parameter.default}
                    readOnly
                    rightSection={
                        <Tooltip label={DERIVATION_VARIABLE_NOTE}>
                            <AppIcon
                                icon={InfoIcon}
                                color={StatusColor.DIMMED}
                                label="Why this is filled in"
                            />
                        </Tooltip>
                    }
                />
            </ParameterCells>
        );
    }
    return (
        <ParameterCells parameter={parameter}>
            <TextInput
                id={parameter.id}
                value={value ?? parameter.default}
                onChange={(event) => onValueChange(event.currentTarget.value)}
            />
        </ParameterCells>
    );
}

function QuantityInput(props: ParameterProps<QuantityParameter>): ReactNode {
    // Alone among the inputs in holding its own state: the box keeps what was
    // typed, and `value` re-seeds it only when it changes somewhere else.
    const { parameter, value, onValueChange } = props;
    // Its own query per box: they all share the one cached answer, and a box
    // shows its own unit until the document's arrive rather than holding the
    // panel up for them.
    const unitInfo = useUnitInfo();

    const evaluateOptions = useMemo(
        () => getEvaluateOptions(parameter, unitInfo),
        [parameter, unitInfo]
    );

    const inputRef = useRef<HTMLInputElement>(null);
    const [focused, setFocused] = useState(false);
    // Set when a click is what focuses the box. That click's mouseup would
    // otherwise drop the selection focusing made — some browsers do, some do
    // not — so a click in reads the same everywhere: the whole expression.
    const selectOnMouseUp = useRef(false);

    const [box, setBox] = useState(() =>
        seedFrom(value, parameter, evaluateOptions)
    );

    // A value this box did not submit came from elsewhere — a favorite, a
    // search hit — so the typed expression it replaces is no longer the value.
    const [emitted, setEmitted] = useState(value);
    if (value !== emitted) {
        setEmitted(value);
        setBox(seedFrom(value, parameter, evaluateOptions));
    }

    const handleSubmit = () => {
        setFocused(false);
        const result = evaluateExpression(box.expression, evaluateOptions);
        if (result.hasError) {
            // Don't change the value so the thumbnail is still okay
            setBox({
                expression: result.expression,
                display: result.expression,
                errorMessage: result.errorMessage
            });
            return;
        }
        setBox({
            expression: result.expression,
            display: result.displayExpression
        });
        // The expression, not its value: it is what Onshape is sent, so a
        // typed "(2 + 3) in" reaches the derived feature as that.
        setEmitted(result.expression);
        onValueChange(result.expression);
    };

    return (
        <ParameterCells parameter={parameter}>
            <TextInput
                id={parameter.id}
                ref={inputRef}
                value={focused ? box.expression : box.display}
                error={box.errorMessage}
                onMouseDown={(event) => {
                    selectOnMouseUp.current =
                        document.activeElement !== event.currentTarget;
                }}
                onMouseUp={(event) => {
                    if (selectOnMouseUp.current) {
                        selectOnMouseUp.current = false;
                        event.preventDefault();
                    }
                }}
                onFocus={(event) => {
                    setFocused(true);
                    event.currentTarget.select();
                }}
                onBlur={handleSubmit}
                onKeyDown={(event) => {
                    // blur() submits; calling handleSubmit too ran it twice.
                    if (event.key === "Enter") {
                        inputRef.current?.blur();
                    }
                }}
                onChange={(event) => {
                    // Read before the updater runs: React nulls `currentTarget`
                    // once the handler returns, and an updater runs after that.
                    const expression = event.currentTarget.value;
                    setBox((current) => ({ ...current, expression }));
                }}
            />
        </ParameterCells>
    );
}
