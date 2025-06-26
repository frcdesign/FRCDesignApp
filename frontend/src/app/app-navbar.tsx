import {
    Alignment,
    Button,
    IconSize,
    InputGroup,
    Navbar,
    NavbarDivider,
    NavbarGroup
} from "@blueprintjs/core";
import { ReactNode } from "react";

import robotIcon from "/robot-icon.svg";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { router } from "../router";

/**
 * Provides top-level navigation for the app.
 */
export function AppNavbar(): ReactNode {
    return (
        <Navbar fixedToTop className="app-navbar">
            <NavbarGroup>
                <img
                    height={IconSize.LARGE}
                    src={robotIcon}
                    alt="Robot manager"
                />
                <NavbarDivider />
                <InputGroup
                    type="search"
                    leftIcon="search"
                    placeholder="Search library..."
                />
            </NavbarGroup>
            <NavbarGroup align={Alignment.END}>
                <ReloadAllDocumentsButton />
            </NavbarGroup>
        </Navbar>
    );
}

function ReloadAllDocumentsButton(): ReactNode {
    const mutation = useMutation({
        mutationKey: ["save-all-documents"],
        mutationFn: () => {
            return apiPost("/save-all-documents", {
                // Set a timeout of 5 minutes
                signal: AbortSignal.timeout(5 * 60000)
            });
        },
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: ["documents"] });
            router.invalidate(); // Trigger page reload
        }
    });

    return (
        <Button
            icon="refresh"
            text="Reload all documents"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            intent="primary"
        />
    );
}
