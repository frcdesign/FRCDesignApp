import { useSearch } from "@tanstack/react-router";
import {
    Dispatch,
    ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
import {
    BooleanParameterObj,
    ConfigurationResult,
    ElementObj,
    ElementType,
    EnumParameterObj,
    evaluateCondition,
    ParameterObj,
    ConfigurationParameterType,
    QuantityParameterObj,
    StringParameterObj,
    Configuration,
    OptionVisibilityConditionType,
    EnumOption,
    Unit,
    QuantityType
} from "../api/backend-types";
import {
    Alignment,
    Button,
    Card,
    Checkbox,
    Dialog,
    DialogBody,
    DialogFooter,
    FormGroup,
    Icon,
    InputGroup,
    Intent,
    MenuItem,
    NonIdealState,
    NonIdealStateIconSize,
    NumericInput,
    Spinner
} from "@blueprintjs/core";
import {
    useIsFetching,
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query";
import { apiGet, apiPost } from "../api/api";
import { toElementApiPath } from "../api/path";
import { Select } from "@blueprintjs/select";
import { handleBooleanChange } from "../common/utils";
import { ContextData, useElementsQuery, useFavoritesQuery } from "../queries";
import {
    AppMenu,
    InsertMenuParams,
    MenuDialogProps,
    useHandleCloseDialog
} from "../api/menu-params";
import { PreviewImage } from "../app/thumbnail";
import { FavoriteButton } from "../app/favorite";
import {
    showErrorToast,
    showLoadingToast,
    showSuccessToast
} from "../common/toaster";
import { cleanDefault, evaluateExpression, EvaluateOptions } from "./parser";

export function InsertMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== AppMenu.INSERT_MENU) {
        return null;
    }
    return <InsertMenuDialog activeElementId={search.activeElementId} />;
}

function InsertMenuDialog(props: MenuDialogProps<InsertMenuParams>): ReactNode {
    const elementId = props.activeElementId;

    const elements = useElementsQuery().data;
    const search = useSearch({ from: "/app" });
    const favorites = useFavoritesQuery(search).data;

    const closeDialog = useHandleCloseDialog();

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(undefined);

    if (!elements || !favorites) {
        return null;
    }

    const element = elements[elementId];
    const isFavorite = favorites[elementId] !== undefined;

    let parameters = null;
    if (element.configurationId) {
        parameters = (
            <ConfigurationWrapper
                configurationId={element.configurationId}
                configuration={configuration}
                setConfiguration={setConfiguration}
            />
        );
    }

    const previewThumbnail = (
        <PreviewImage elementPath={element} configuration={configuration} />
    );

    const actions = (
        <InsertButton
            element={element}
            configuration={configuration}
            isFavorite={isFavorite}
        />
    );

    return (
        <Dialog
            isOpen
            title={element.name}
            onClose={closeDialog}
            style={{ maxHeight: "90vh", maxWidth: "400px" }}
        >
            <Card className="center preview-image-card">
                {previewThumbnail}
            </Card>
            <DialogBody>{parameters}</DialogBody>
            <DialogFooter actions={actions}>
                <FavoriteButton isFavorite={isFavorite} element={element} />
            </DialogFooter>
        </Dialog>
    );
}

interface ConfigurationWrapperProps {
    configurationId: string;
    configuration?: Configuration;
    setConfiguration: Dispatch<Configuration>;
}

function ConfigurationWrapper(props: ConfigurationWrapperProps) {
    const { configurationId, configuration, setConfiguration } = props;

    const query = useQuery<ConfigurationResult>({
        queryKey: ["configuration", configurationId],
        queryFn: async () => {
            const result = apiGet("/configuration/" + configurationId);
            return result.then((result: ConfigurationResult) => {
                return result;
            });
        },
        // Don't refetch query automatically so we don't reset user inputs
        refetchInterval: false
    });

    useEffect(() => {
        if (!query.data || configuration) {
            return;
        }
        const defaultConfiguration = query.data.parameters.reduce(
            (configuration, parameter) => {
                configuration[parameter.id] = parameter.default;
                return configuration;
            },
            {} as Configuration
        );
        setConfiguration(defaultConfiguration);
    }, [query.data, configuration, setConfiguration]);

    if (query.isPending || !configuration) {
        return <Spinner intent={Intent.PRIMARY} />;
    } else if (query.isError) {
        return (
            <NonIdealState
                icon={
                    <Icon
                        intent="danger"
                        icon="cross"
                        size={NonIdealStateIconSize.STANDARD}
                    />
                }
                title="Failed to load configuration"
                description="If the problem persists, contact the FRCDesignApp developers."
            />
        );
    }

    return (
        <ConfigurationParameters
            configurationResult={query.data}
            configuration={configuration}
            setConfiguration={setConfiguration}
        />
    );
}

interface ConfigurationParameterProps {
    configurationResult: ConfigurationResult;
    configuration: Configuration;
    setConfiguration: Dispatch<Configuration>;
}

function ConfigurationParameters(props: ConfigurationParameterProps) {
    const { configurationResult, configuration, setConfiguration } = props;

    const parameters = configurationResult.parameters.map((parameter) => {
        const handleValueChange = (newValue: string | undefined) => {
            let newConfiguration;
            if (newValue == undefined) {
                newConfiguration = { ...configuration };
                delete newConfiguration[parameter.id];
            } else {
                newConfiguration = {
                    ...configuration,
                    [parameter.id]: newValue
                };
            }
            setConfiguration(newConfiguration);
        };

        return (
            <ConfigurationParameter
                key={parameter.id}
                parameter={parameter}
                value={configuration[parameter.id]}
                configuration={configuration}
                parameters={configurationResult.parameters}
                onValueChange={handleValueChange}
            />
        );
    });
    return <div style={{ width: "100%" }}>{parameters}</div>;
}

interface ParameterProps<T extends ParameterObj> {
    parameter: T;
    value: string;
    onValueChange: (newValue: string | undefined) => void;
    configuration: Configuration;
    parameters: ParameterObj[];
}

function ConfigurationParameter(
    props: ParameterProps<ParameterObj>
): ReactNode {
    const { parameter } = props;

    useEffect(() => {
        if (
            !evaluateCondition(
                parameter.condition,
                props.configuration,
                props.parameters
            )
        ) {
            props.onValueChange(undefined);
        }
    }, [parameter.condition, props]);

    if (
        !evaluateCondition(
            parameter.condition,
            props.configuration,
            props.parameters
        )
    ) {
        return null;
    }

    // Need to expose and use parameter directly to get type narrowing
    if (parameter.type === ConfigurationParameterType.ENUM) {
        return <EnumParameter {...props} parameter={parameter} />;
    } else if (parameter.type === ConfigurationParameterType.BOOLEAN) {
        return <BooleanParameter {...props} parameter={parameter} />;
    } else if (parameter.type === ConfigurationParameterType.STRING) {
        return <StringParameter {...props} parameter={parameter} />;
    } else if (parameter.type === ConfigurationParameterType.QUANTITY) {
        return <QuantityParameter {...props} parameter={parameter} />;
    }
}

function getOption(
    options: EnumOption[],
    optionId: string
): EnumOption | undefined {
    return options.find((option) => option.id == optionId);
}

function getVisibleOptions(
    enumParameter: EnumParameterObj,
    configuration: Configuration,
    parameters: ParameterObj[]
): EnumOption[] {
    // No conditions means everything is shown
    if (enumParameter.optionConditions.length === 0) {
        return enumParameter.options;
    }

    const optionIds = enumParameter.options.map((option) => option.id);

    const validOptionIds = enumParameter.optionConditions
        .filter((optionCondition) =>
            evaluateCondition(
                optionCondition.condition,
                configuration,
                parameters
            )
        )
        .flatMap((optionCondition) => {
            if (optionCondition.type == OptionVisibilityConditionType.LIST) {
                return optionCondition.controlledOptions;
            } else if (
                optionCondition.type == OptionVisibilityConditionType.RANGE
            ) {
                return optionIds.slice(
                    optionIds.indexOf(optionCondition.start),
                    optionIds.indexOf(optionCondition.end) + 1
                );
            }
            throw new Error("Unhandled option condition type");
        });

    const validOptionsSet = new Set(validOptionIds);
    return enumParameter.options.filter((option) =>
        validOptionsSet.has(option.id)
    );
}

function EnumParameter(props: ParameterProps<EnumParameterObj>): ReactNode {
    const { parameter, value, onValueChange, configuration, parameters } =
        props;

    // The active option is the option currently focused by the user
    // const [activeOption, setActiveOption] = useState<EnumOption | null>(null);

    const visibleOptions = getVisibleOptions(
        parameter,
        configuration,
        parameters
    );

    // useMemo to stabilize options across re-renders so, e.g., active item changes work
    // const visibleOptions = useMemo(
    //     () => getVisibleOptions(parameter, configuration, parameters),
    //     [configuration, parameter, parameters]
    // );

    useEffect(() => {
        if (visibleOptions.length === 0) {
            onValueChange(undefined);
            return;
        }
        // Logic to set value to the first visible option or default when a parameter is shown
        if (!getOption(visibleOptions, value)) {
            if (getOption(visibleOptions, parameter.default)) {
                onValueChange(parameter.default);
            } else {
                onValueChange(visibleOptions[0].id);
            }
        }
    }, [onValueChange, parameter.default, value, visibleOptions]);

    if (visibleOptions.length === 0) {
        return null;
    }

    // Same logic as the useEffect
    let currentOption = getOption(visibleOptions, value);
    if (!currentOption) {
        currentOption = getOption(visibleOptions, parameter.default);
        if (!currentOption) {
            currentOption = visibleOptions[0];
        }
    }

    return (
        <FormGroup
            label={parameter.name}
            labelFor={parameter.id}
            inline
            className="full-width"
        >
            <Select<EnumOption>
                items={visibleOptions}
                activeItem={currentOption}
                onItemSelect={(option) => {
                    onValueChange(option.id);
                }}
                itemsEqual="id"
                fill
                popoverProps={{
                    minimal: true,
                    popoverClassName: "enum-menu"
                }}
                filterable={false}
                itemRenderer={(
                    currentOption,
                    { handleClick, handleFocus, modifiers, ref }
                ) => {
                    const selected = value === currentOption.id;
                    return (
                        <MenuItem
                            key={currentOption.id}
                            ref={ref}
                            onClick={handleClick}
                            onFocus={handleFocus}
                            active={modifiers.active}
                            text={currentOption.name}
                            roleStructure="listoption"
                            selected={selected}
                            intent={selected ? Intent.PRIMARY : Intent.NONE}
                        />
                    );
                }}
            >
                <Button
                    id={parameter.id}
                    alignText="start"
                    endIcon="caret-down"
                    text={currentOption.name}
                    fill
                />
            </Select>
        </FormGroup>
    );
}

function BooleanParameter(
    props: ParameterProps<BooleanParameterObj>
): ReactNode {
    const { parameter, value, onValueChange } = props;
    // Add a 100% width div to eat up space to the right of the checkbox
    // Otherwise multiple checkboxes in a row can fold onto the same line
    return (
        <div style={{ width: "100%" }}>
            <Checkbox
                label={parameter.name}
                alignIndicator={Alignment.END}
                inline
                checked={value === "true"}
                onChange={handleBooleanChange((checked) =>
                    onValueChange(checked ? "true" : "false")
                )}
            />
        </div>
    );
}

function StringParameter(props: ParameterProps<StringParameterObj>): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <FormGroup
            label={parameter.name}
            inline
            labelFor={parameter.id}
            className="full-width"
        >
            <InputGroup
                id={parameter.id}
                value={value}
                onValueChange={onValueChange}
            />
        </FormGroup>
    );
}

function getEvaluateOptions(
    quantityType: QuantityType,
    contextData: ContextData
): EvaluateOptions {
    if (quantityType === QuantityType.LENGTH) {
        return {
            quantityType,
            displayPrecision: contextData.lengthPrecision,
            displayUnit: contextData.lengthUnit
        };
    } else if (quantityType === QuantityType.ANGLE) {
        return {
            quantityType,
            displayPrecision: contextData.anglePrecision,
            displayUnit: contextData.angleUnit
        };
    } else if (quantityType == QuantityType.REAL) {
        return {
            quantityType,
            displayPrecision: contextData.realPrecision,
            displayUnit: Unit.UNITLESS
        };
    }
    return {
        quantityType: QuantityType.INTEGER,
        displayPrecision: 0,
        displayUnit: Unit.UNITLESS
    };
}

function QuantityParameter(
    props: ParameterProps<QuantityParameterObj>
): ReactNode {
    // This parameter doesn't actually use value since it manages it's state internally
    const { parameter, onValueChange } = props;

    const contextData = useSearch({ from: "/app" });

    const evaluateOptions = getEvaluateOptions(
        parameter.quantityType,
        contextData
    );

    const ref = useRef<HTMLInputElement>(null);
    const [focused, setFocused] = useState(false);
    // The user's raw expression.
    const [expression, setExpression] = useState(
        cleanDefault(parameter.default, evaluateOptions).expression
    );
    // The pretty print value to display. Only shown when the input isn't focused.
    const [display, setDisplay] = useState(
        cleanDefault(parameter.default, evaluateOptions).displayExpression
    );
    const [errorMessage, setErrorMessage] = useState<string | undefined>(
        undefined
    );

    const handleSubmit = useCallback(() => {
        setFocused(false);
        const result = evaluateExpression(expression, evaluateOptions);
        setExpression(result.expression);
        if (result.hasError) {
            setErrorMessage(result.errorMessage);
            // Don't change the value so the thumbnail is still okay
            setDisplay(result.expression);
        } else {
            setErrorMessage(undefined);
            onValueChange(result.expression);
            setDisplay(result.displayExpression);
        }
    }, [evaluateOptions, expression, onValueChange]);

    const intent = errorMessage ? "danger" : undefined;

    return (
        <FormGroup
            label={parameter.name}
            inline
            labelFor={parameter.id}
            className="full-width"
            helperText={errorMessage}
            intent={intent}
        >
            <NumericInput
                id={parameter.id}
                value={focused ? expression : display}
                fill
                intent={intent}
                inputRef={ref}
                selectAllOnFocus
                onFocus={() => {
                    setFocused(true);
                }}
                onBlur={handleSubmit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        ref.current?.blur();
                        handleSubmit();
                    }
                }}
                allowNumericCharactersOnly={false}
                onValueChange={(_, expression) => {
                    setExpression(expression);
                }}
                buttonPosition="none"
            />
        </FormGroup>
    );
}

interface SubmitButtonProps {
    element: ElementObj;
    configuration?: Configuration;
    isFavorite: boolean;
}

function InsertButton(props: SubmitButtonProps): ReactNode {
    const { element, configuration, isFavorite } = props;

    const search = useSearch({ from: "/app" });
    const closeDialog = useHandleCloseDialog();
    const queryClient = useQueryClient();

    const toastId = "insert" + element.id;

    const isLoadingConfiguration =
        useIsFetching({
            queryKey: ["configuration", element.configurationId]
        }) > 0;

    const insertMutation = useMutation({
        mutationKey: ["insert", element.id],
        mutationFn: async () => {
            let endpoint;
            const body: Record<string, any> = {
                documentId: element.documentId,
                instanceType: element.instanceType,
                instanceId: element.instanceId,
                elementId: element.id,
                configuration,
                name: element.name,
                isFavorite,
                userId: search.userId
            };
            if (search.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly";
                body.elementType = element.elementType;
            } else {
                // Part studio derive also needs name and microversion id
                endpoint = "/add-to-part-studio";
                body.microversionId = element.microversionId;
            }
            // Cancel any outstanding thumbnail queries
            queryClient.cancelQueries({
                predicate: (query) =>
                    query.queryKey[0] === "thumbnail-id" ||
                    query.queryKey[0] === "thumbnail"
            });
            showLoadingToast(`Inserting ${element.name}...`, toastId);
            closeDialog();
            return apiPost(endpoint + toElementApiPath(search), {
                body
            });
        },
        onError: () => {
            showErrorToast(`Failed to insert ${element.name}.`, toastId);
        },
        onSuccess: () => {
            showSuccessToast(`Successfully inserted ${element.name}.`, toastId);
        }
    });

    return (
        <Button
            text={
                search.elementType === ElementType.ASSEMBLY
                    ? "Insert"
                    : "Derive"
            }
            icon="plus"
            intent={Intent.SUCCESS}
            loading={isLoadingConfiguration || insertMutation.isPending}
            onClick={() => insertMutation.mutate()}
        />
    );
}
