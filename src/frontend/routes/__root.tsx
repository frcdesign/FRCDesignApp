import { createRootRoute, Outlet, useParams } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { ReactNode, useMemo } from "react";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { queryClient } from "../lib/query-client";
import { createAppTheme } from "../theme";
import { useUiState } from "../lib/ui-state";
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
    const tabId = useUiState((state) => state.tabId);
    const colorScheme = useUiState((state) => state.theme);

    const theme = useMemo(
        () => createAppTheme(params.libraryId ?? tabId ?? DEFAULT_LIBRARY),
        [params.libraryId, tabId]
    );

    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider theme={theme} forceColorScheme={colorScheme}>
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
