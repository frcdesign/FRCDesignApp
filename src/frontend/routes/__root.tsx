import { createRootRoute, Outlet, useParams } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { ReactNode, useMemo } from "react";
import { useColorScheme } from "@mantine/hooks";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { queryClient } from "../lib/query-client";
import { createAppTheme } from "../theme";
import { getColorTheme } from "../lib/onshape-params";
import { useGetUiState } from "../lib/ui-state";
import { NotFoundError, RootCrash } from "../components/root-error";

export const Route = createRootRoute({
    component: RootComponent,
    // notFoundComponent renders inside the root Outlet, so it has the provider.
    notFoundComponent: NotFoundError,
    // Replaces the root component, provider included, so no Mantine here.
    errorComponent: RootCrash
});

function RootComponent(): ReactNode {
    // The tab comes off the url, so the first paint is already its color.
    const params = useParams({ strict: false });
    const { theme: savedTheme, tabId, systemTheme } = useGetUiState();

    const theme = useMemo(
        () => createAppTheme(params.libraryId ?? tabId ?? DEFAULT_LIBRARY),
        [params.libraryId, tabId]
    );

    // Standalone there's no Onshape scheme, so "system" means the OS.
    const osColorScheme = useColorScheme();
    const colorTheme = getColorTheme(savedTheme, systemTheme ?? osColorScheme);

    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider theme={theme} forceColorScheme={colorTheme}>
                <ModalsProvider
                    labels={{ confirm: "Confirm", cancel: "Cancel" }}
                >
                    <Notifications
                        position="bottom-center"
                        limit={3}
                        autoClose={4000}
                        // Otherwise pinned at 440px.
                        containerWidth="max-content"
                    />
                    <Outlet />
                </ModalsProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}
