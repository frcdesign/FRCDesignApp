/** The configuration dialog's inputs, for any `ConfigurationParameter`: the insert menu's, and Auto Assembly's. */
import { Checkbox, type ComboboxProps, Select, TextInput } from "@mantine/core";
import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    type BooleanParameter,
    type ConfigurationParameter,
    type EnumParameter,
    ParameterType,
    type QuantityParameter,
    type Selection,
    type StringParameter
} from "@backend/features/configurations/contract";
import {
    evaluateCondition,
    getEvaluateOptions,
    getVisibleOptions,
    resolveSelectedOption
} from "@backend/features/configurations/utils";
import { isDerivationVariable } from "@backend/features/configurations/roles";
import { evaluateExpression } from "@backend/features/configurations/input-parser";
import { useUnitInfo } from "../lib/unit-info";
import { InfoTooltip } from "./info-tooltip";
import classes from "./parameter-input.module.css";

interface ParameterGridProps {
    children: ReactNode;
}

/** What parameter inputs sit in: a row each, its name as wide as its text, then its control. */
export function ParameterGrid(props: ParameterGridProps): ReactNode {
    return <div className={classes.grid}>{props.children}</div>;
}

interface ParameterCellsProps {
    parameter: ConfigurationParameter;
    inputId: string;
    children: ReactNode;
}

/** A row of the grid: the parameter's name, then its control. */
function ParameterCells(props: ParameterCellsProps): ReactNode {
    const { parameter, inputId, children } = props;
    return (
        <div className={classes.row}>
            <label className={classes.label} htmlFor={inputId}>
                {parameter.name}
            </label>
            {children}
        </div>
    );
}

// Lets a long option sit on one line where there is room.
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

export interface ParameterInputProps<
    T extends ConfigurationParameter = ConfigurationParameter
> {
    parameter: T;
    /** Absent when the selection omits it, which means the default. */
    value: string | undefined;
    onValueChange: (newValue: string | undefined) => void;
    /** What its condition and its options' conditions are read against. */
    selection: Selection;
    parameters: ConfigurationParameter[];
    /** Its control's id, unique on the page; the parameter's own by default. */
    inputId?: string;
}

function inputIdOf(props: ParameterInputProps): string {
    return props.inputId ?? props.parameter.id;
}

/**
 * One parameter's row, as Onshape's configuration panel shows it: nothing
 * while its condition doesn't hold, and an enum's options as their conditions
 * allow.
 */
export function ParameterInput(props: ParameterInputProps): ReactNode {
    const { parameter, selection, parameters } = props;

    if (!evaluateCondition(parameter.condition, selection, parameters)) {
        return null;
    }

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

function EnumInput(props: ParameterInputProps<EnumParameter>): ReactNode {
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
        <ParameterCells parameter={parameter} inputId={inputIdOf(props)}>
            <Select
                id={inputIdOf(props)}
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

function BooleanInput(props: ParameterInputProps<BooleanParameter>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <ParameterCells parameter={parameter} inputId={inputIdOf(props)}>
            <Checkbox
                id={inputIdOf(props)}
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

const DERIVATION_VARIABLE_NOTE =
    "Filled with a unique value, so each derive is its own configuration.";

function StringInput(props: ParameterInputProps<StringParameter>): ReactNode {
    const { parameter, value, onValueChange } = props;
    if (isDerivationVariable(parameter)) {
        return (
            <ParameterCells parameter={parameter} inputId={inputIdOf(props)}>
                <TextInput
                    id={inputIdOf(props)}
                    value={value ?? parameter.default}
                    readOnly
                    rightSection={
                        <InfoTooltip label={DERIVATION_VARIABLE_NOTE} />
                    }
                />
            </ParameterCells>
        );
    }
    return (
        <ParameterCells parameter={parameter} inputId={inputIdOf(props)}>
            <TextInput
                id={inputIdOf(props)}
                value={value ?? parameter.default}
                onChange={(event) => onValueChange(event.currentTarget.value)}
            />
        </ParameterCells>
    );
}

function QuantityInput(
    props: ParameterInputProps<QuantityParameter>
): ReactNode {
    // Keeps what was typed; `value` re-seeds it only when it changes elsewhere.
    const { parameter, value, onValueChange } = props;
    // Doesn't hold up the panel: the box shows its own unit until these arrive.
    const unitInfo = useUnitInfo();

    const evaluateOptions = useMemo(
        () => getEvaluateOptions(parameter, unitInfo),
        [parameter, unitInfo]
    );

    const inputRef = useRef<HTMLInputElement>(null);
    const [focused, setFocused] = useState(false);
    // Some browsers drop the focus selection on the click's mouseup, so reselect.
    const selectOnMouseUp = useRef(false);

    const [box, setBox] = useState(() =>
        evaluateExpression(value ?? parameter.default, evaluateOptions)
    );

    // After focus swaps the display for the expression, since changing the
    // value drops a selection made before it.
    useLayoutEffect(() => {
        if (focused) {
            inputRef.current?.select();
        }
    }, [focused]);

    // A value this box didn't submit came from elsewhere, such as a favorite.
    const [emitted, setEmitted] = useState(value);
    if (value !== emitted) {
        setEmitted(value);
        setBox(evaluateExpression(value ?? parameter.default, evaluateOptions));
    }

    const handleSubmit = () => {
        setFocused(false);
        const result = evaluateExpression(box.expression, evaluateOptions);
        setBox(result);
        // An error keeps the last good value, so the thumbnail still matches it.
        if (result.errorMessage) {
            return;
        }
        // The expression, so the derived feature shows what was typed.
        setEmitted(result.expression);
        onValueChange(result.expression);
    };

    return (
        <ParameterCells parameter={parameter} inputId={inputIdOf(props)}>
            <TextInput
                id={inputIdOf(props)}
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
                onFocus={() => setFocused(true)}
                onBlur={handleSubmit}
                onKeyDown={(event) => {
                    // blur() submits; calling handleSubmit too ran it twice.
                    if (event.key === "Enter") {
                        inputRef.current?.blur();
                    }
                }}
                onChange={(event) => {
                    // React clears `currentTarget` before the updater runs.
                    const expression = event.currentTarget.value;
                    setBox((current) => ({ ...current, expression }));
                }}
            />
        </ParameterCells>
    );
}
