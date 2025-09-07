import { useSearch } from "@tanstack/react-router";
import { Dispatch, ReactNode, useEffect, useState } from "react";
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
    QuantityType,
    OptionVisibilityConditionType,
    EnumOption
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api/api";
import { toElementApiPath } from "../api/path";
import { Select } from "@blueprintjs/select";
import { handleBooleanChange } from "../common/utils";
import { OpenUrlButton } from "../common/open-url-button";
import { makeUrl } from "../common/url";
import { useElementsQuery, useFavoritesQuery } from "../queries";
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
        <PreviewImage
            isDialogPreview
            elementPath={element}
            configuration={configuration}
        />
    );

    const actions = (
        <>
            <OpenUrlButton url={makeUrl(element, configuration)} text="Open" />
            <InsertButton
                element={element}
                configuration={configuration}
                isFavorite={isFavorite}
            />
        </>
    );

    console.log(configuration);

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
        // Disable refetch to avoid resetting defaults
        refetchInterval: false
    });

    useEffect(() => {
        if (!query.data) {
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
    }, [query.data, setConfiguration]);

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

    return (
        <FormGroup
            label={parameter.name}
            labelFor={parameter.id}
            inline
            className="full-width"
        >
            <Select<EnumOption>
                items={visibleOptions}
                activeItem={getOption(visibleOptions, value) ?? null}
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
                    text={getOption(parameter.options, value)?.name}
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

function isNumeric(str: string): boolean {
    return !isNaN(Number(str));
}

function isInteger(str: string): boolean {
    return Number.isInteger(Number(str));
}

function QuantityParameter(
    props: ParameterProps<QuantityParameterObj>
): ReactNode {
    const { parameter, value, onValueChange } = props;

    const requiresUnits =
        parameter.quantityType === QuantityType.LENGTH ||
        parameter.quantityType === QuantityType.ANGLE;

    const mustBeInteger = parameter.quantityType === QuantityType.INTEGER;

    const isEmpty = value.trim() == "";

    let helperText = undefined;
    if (isEmpty) {
        helperText = "Enter a valid expression";
    } else if (requiresUnits && isNumeric(value)) {
        helperText = "Expression must include units";
    } else if (mustBeInteger && !isInteger(value)) {
        helperText = "Expression must be a whole number";
    }
    const intent = helperText !== undefined ? "danger" : undefined;

    return (
        <FormGroup
            label={parameter.name}
            inline
            labelFor={parameter.id}
            className="full-width"
            helperText={helperText}
            intent={intent}
        >
            <NumericInput
                id={parameter.id}
                value={value}
                fill
                intent={intent}
                allowNumericCharactersOnly={
                    parameter.quantityType == QuantityType.REAL ||
                    parameter.quantityType == QuantityType.INTEGER
                }
                onValueChange={(_, value) => onValueChange(value)}
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

    const toastId = "insert" + element.id;

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
            text="Insert"
            icon="plus"
            intent={Intent.SUCCESS}
            loading={insertMutation.isPending}
            onClick={() => insertMutation.mutate()}
        />
    );
}
