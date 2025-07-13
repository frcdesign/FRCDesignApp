import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { Dispatch, ReactNode, useState } from "react";
import {
    BooleanParameterObj,
    ConfigurationResult,
    ElementObj,
    ElementType,
    EnumOption,
    EnumParameterObj,
    ParameterObj,
    ParameterType,
    QuantityParameterObj,
    StringParameterObj
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
    InputGroup,
    Intent,
    MenuItem,
    NumericInput
} from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { apiDelete, apiPost } from "../api/api";
import { toUserApiPath, toElementApiPath } from "../api/path";
import { Select } from "@blueprintjs/select";
import { handleBooleanChange } from "../common/handlers";
import { useOnshapeData } from "../api/onshape-data";
import { PreviewImage } from "./thumbnail";
import { OpenUrlButton } from "../common/open-url-button";
import { makeUrl } from "../common/url";
import { queryClient } from "../query-client";
import { router } from "../router";

export function ConfigurationDialog(): ReactNode {
    const data = useLoaderData({
        from: "/app/documents"
    });
    const configurationResult = useLoaderData({
        from: "/app/documents/$documentId/elements/$elementId"
    });
    const elementId = useParams({
        from: "/app/documents/$documentId/elements/$elementId"
    }).elementId;

    const [configuration, setConfiguration] = useState<Record<string, string>>(
        () => {
            const configuration: Record<string, string> = {};
            configurationResult?.parameters.forEach((parameter) => {
                configuration[parameter.id] = parameter.default;
            });
            return configuration;
        }
    );

    const navigate = useNavigate();

    const element = data.elements[elementId];
    const isFavorite = data.favorites[elementId] !== undefined;

    let parameters = null;
    if (configurationResult) {
        parameters = (
            <ConfigurationParameters
                configurationResult={configurationResult}
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
            <InsertButton element={element} configuration={configuration} />
        </>
    );

    return (
        <Dialog
            isOpen
            title={element.name}
            onClose={() =>
                navigate({
                    from: "/app/documents/$documentId/elements/$elementId",
                    to: "../.."
                })
            }
            style={{ maxHeight: "90vh", maxWidth: "400px" }}
        >
            <Card className="center preview-image-card">
                {previewThumbnail}
            </Card>
            <DialogBody>{parameters}</DialogBody>
            <DialogFooter actions={actions}>
                <FavoriteButton isFavorite={isFavorite} elementId={elementId} />
            </DialogFooter>
        </Dialog>
    );
}

interface ConfigurationParameterProps {
    configurationResult: ConfigurationResult;
    configuration: Record<string, string>;
    setConfiguration: Dispatch<Record<string, string>>;
}

function ConfigurationParameters(props: ConfigurationParameterProps) {
    const { configurationResult, configuration, setConfiguration } = props;

    const parameters = configurationResult.parameters.map((parameter) => (
        <ConfigurationParameter
            key={parameter.id}
            parameter={parameter}
            value={configuration[parameter.id]}
            onValueChange={(newValue) => {
                const newConfiguration = {
                    ...configuration,
                    [parameter.id]: newValue
                };
                setConfiguration(newConfiguration);
            }}
        />
    ));
    return <div style={{ width: "100%" }}>{parameters}</div>;
}

interface ParameterProps<T extends ParameterObj> {
    parameter: T;
    value: string;
    onValueChange: (newValue: string) => void;
}

function ConfigurationParameter(
    props: ParameterProps<ParameterObj>
): ReactNode {
    // Need to expose parameter directly to get type narrowing
    const { parameter, value, onValueChange } = props;
    if (parameter.type === ParameterType.ENUM) {
        return (
            <EnumParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ParameterType.BOOLEAN) {
        return (
            <BooleanParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ParameterType.STRING) {
        return (
            <StringParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    } else if (parameter.type === ParameterType.QUANTITY) {
        return (
            <QuantityParameter
                parameter={parameter}
                value={value}
                onValueChange={onValueChange}
            />
        );
    }
}

function EnumParameter(props: ParameterProps<EnumParameterObj>): ReactNode {
    const { parameter, value, onValueChange } = props;
    const selectedItem = parameter.options.find(
        (enumOption) => enumOption.id === value
    );
    return (
        <FormGroup
            label={parameter.name}
            labelFor={parameter.id}
            inline
            className="full-width"
            intent={Intent.SUCCESS}
        >
            <Select<EnumOption>
                items={parameter.options}
                filterable={false}
                popoverProps={{
                    minimal: true,
                    popoverClassName: "enum-menu"
                }}
                itemRenderer={(
                    enumOption,
                    { handleClick, handleFocus, modifiers }
                ) => {
                    const selected = value === enumOption.id;
                    return (
                        <MenuItem
                            key={enumOption.id}
                            onClick={handleClick}
                            onFocus={handleFocus}
                            active={modifiers.active}
                            text={enumOption.name}
                            roleStructure="listoption"
                            selected={selected}
                            intent={selected ? Intent.PRIMARY : Intent.NONE}
                        />
                    );
                }}
                onItemSelect={(enumOption) => {
                    onValueChange(enumOption.id);
                }}
            >
                <Button
                    id={parameter.id}
                    alignText="start"
                    endIcon="caret-down"
                    text={selectedItem?.name}
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

function QuantityParameter(
    props: ParameterProps<QuantityParameterObj>
): ReactNode {
    const { parameter, value, onValueChange } = props;
    return (
        <FormGroup
            label={parameter.name}
            inline
            labelFor={parameter.id}
            className="full-width"
        >
            <NumericInput
                id={parameter.id}
                value={value}
                fill
                allowNumericCharactersOnly={false}
                onValueChange={(_, value) => onValueChange(value)}
                buttonPosition="none"
            />
        </FormGroup>
    );
}

interface SubmitButtonProps {
    element: ElementObj;
    configuration?: Record<string, string>;
}

function InsertButton(props: SubmitButtonProps): ReactNode {
    const { element, configuration } = props;

    const onshapeData = useOnshapeData();
    const navigate = useNavigate();

    const insertMutation = useMutation({
        mutationKey: ["insert", element.id],
        mutationFn: async () => {
            let endpoint;
            if (onshapeData.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly";
            } else {
                endpoint = "/add-to-part-studio";
            }
            return apiPost(endpoint + toElementApiPath(onshapeData), {
                body: {
                    ...element,
                    configuration
                }
            });
        },
        onSuccess: () => {
            navigate({
                from: "/app/documents/$documentId/elements/$elementId",
                to: "../.."
            });
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

interface FavoriteButtonProps {
    isFavorite: boolean;
    elementId: string;
}

function FavoriteButton(props: FavoriteButtonProps): ReactNode {
    const { isFavorite, elementId } = props;
    const onshapeData = useOnshapeData();
    const mutation = useMutation({
        mutationKey: ["toggle-favorite", isFavorite],
        mutationFn: () => {
            const query = { elementId };
            if (isFavorite) {
                return apiDelete(
                    "/favorites" + toUserApiPath(onshapeData),
                    query
                );
            } else {
                return apiPost("/favorites" + toUserApiPath(onshapeData), {
                    query
                });
            }
        },
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: ["favorites"] });
            router.invalidate();
        }
    });
    return (
        <Button
            icon="heart"
            text="Favorite"
            intent={Intent.SUCCESS}
            onClick={() => mutation.mutate()}
        />
    );
}
