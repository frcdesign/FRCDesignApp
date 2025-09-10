import {
    Alert,
    Button,
    Dialog,
    DialogBody,
    DialogFooter,
    Divider,
    FormGroup,
    H6,
    Intent,
    MenuItem
} from "@blueprintjs/core";
import { ReactNode, useMemo, useState } from "react";
import { AppMenu, useHandleCloseDialog } from "../api/menu-params";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { AccessLevel, hasMemberAccess } from "../api/backend-types";
import { ItemRenderer, Select } from "@blueprintjs/select";
import { capitalize } from "../common/utils";
import { invalidateSearchDb } from "../api/search";

export function SettingsMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== AppMenu.SETTINGS_MENU) {
        return null;
    }
    return <SettingsMenuDialog />;
}

function SettingsMenuDialog(): ReactNode {
    const closeDialog = useHandleCloseDialog();

    const search = useSearch({ from: "/app" });

    let adminSettings = null;
    // Unlike most other checks, this one uses maxAccessLevel so you can still switch from user to admin
    if (hasMemberAccess(search.maxAccessLevel)) {
        adminSettings = (
            <>
                <H6>Admin Settings</H6>
                <Divider />
                <AdminSettings />
            </>
        );
    }

    const closeButton = (
        <Button
            text="Close"
            icon="cross"
            intent={Intent.PRIMARY}
            onClick={closeDialog}
        />
    );

    return (
        <Dialog
            className="settings-dialog"
            isOpen
            icon="cog"
            title="Settings"
            onClose={closeDialog}
        >
            <DialogBody>{adminSettings}</DialogBody>
            <DialogFooter minimal actions={closeButton} />
        </Dialog>
    );
}

function AdminSettings(): ReactNode {
    const search = useSearch({ from: "/app" });
    return (
        <>
            <AccessLevelSelect />
            {hasMemberAccess(search.accessLevel) ? (
                <>
                    <ReloadDocumentsButton />
                    <ReloadDocumentsButton reloadAll />
                </>
            ) : null}
        </>
    );
}

function AccessLevelSelect(): ReactNode {
    const search = useSearch({ from: "/app" });
    const navigate = useNavigate();

    const maxAccessLevel = search.maxAccessLevel;
    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const accessLevels = useMemo(() => {
        return maxAccessLevel === AccessLevel.ADMIN
            ? [AccessLevel.ADMIN, AccessLevel.MEMBER, AccessLevel.USER]
            : [AccessLevel.MEMBER, AccessLevel.USER];
    }, [maxAccessLevel]);

    const [activeLevel, setActiveLevel] = useState<AccessLevel | null>(
        search.accessLevel
    );

    const button = (
        <Button
            alignText="start"
            endIcon="caret-down"
            text={capitalize(search.accessLevel)}
        />
    );

    const renderAccessLevel: ItemRenderer<AccessLevel> = (
        accessLevel,
        { handleClick, handleFocus, modifiers, ref }
    ) => {
        const selected = search.accessLevel === accessLevel;
        return (
            <MenuItem
                key={accessLevel}
                ref={ref}
                onClick={handleClick}
                onFocus={handleFocus}
                active={modifiers.active}
                text={capitalize(accessLevel)}
                roleStructure="listoption"
                selected={selected}
                intent={selected ? Intent.PRIMARY : Intent.NONE}
            />
        );
    };

    const select = (
        <Select<AccessLevel>
            items={accessLevels}
            activeItem={activeLevel}
            onActiveItemChange={setActiveLevel}
            filterable={false}
            popoverProps={{ minimal: true }}
            itemRenderer={renderAccessLevel}
            onItemSelect={(accessLevel) => {
                navigate({ to: ".", search: { accessLevel } });
            }}
        >
            {button}
        </Select>
    );

    return (
        <FormGroup label="Access Level" className="full-width" inline>
            {select}
        </FormGroup>
    );
}

interface ReloadDocumentsButtonProps {
    reloadAll?: boolean;
    hideFormGroup?: boolean;
}

export function ReloadDocumentsButton(
    props: ReloadDocumentsButtonProps
): ReactNode {
    const reloadAll = props.reloadAll ?? false;
    const hideFormGroup = props.hideFormGroup ?? false;

    const mutation = useMutation({
        mutationKey: ["reload-documents"],
        mutationFn: () => {
            return apiPost("/reload-documents", {
                // Set a timeout of 5 minutes
                query: { reloadAll }
            });
        },
        onError: () => {
            showErrorToast("Failed to reload documents!");
        },
        onSuccess: async (result) => {
            const savedElements = result["savedElements"];
            if (savedElements === 0) {
                showSuccessToast("All documents were already up to date.");
            } else {
                showSuccessToast(
                    "Successfully reloaded " + savedElements + " elements."
                );
            }
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["documents"] }),
                queryClient.refetchQueries({ queryKey: ["elements"] })
            ]);
            invalidateSearchDb();
        }
    });

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    const alert = (
        <Alert
            confirmButtonText="Reload"
            icon="refresh"
            intent={reloadAll ? Intent.DANGER : Intent.PRIMARY}
            isOpen={isAlertOpen}
            canEscapeKeyCancel
            canOutsideClickCancel
            cancelButtonText="Cancel"
            onClose={(confirmed) => {
                if (confirmed) {
                    mutation.mutate();
                }
                setIsAlertOpen(false);
            }}
        >
            Are you sure you want to
            {reloadAll
                ? " reload all documents?"
                : " reload outdated documents?"}
        </Alert>
    );

    const button = (
        <Button
            icon="refresh"
            text="Reload"
            onClick={() => setIsAlertOpen(true)}
            loading={mutation.isPending}
            intent={reloadAll ? Intent.DANGER : Intent.PRIMARY}
        />
    );

    const formGroup = hideFormGroup ? (
        button
    ) : (
        <FormGroup
            label={
                reloadAll ? "Reload all documents" : "Reload outdated documents"
            }
            inline
        >
            {button}
        </FormGroup>
    );

    return (
        <>
            {formGroup}
            {alert}
        </>
    );
}
