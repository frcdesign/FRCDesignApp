import { createRootRoute, Outlet, useSearch } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { ReactNode, useMemo } from "react";
import { queryClient } from "../query-client";
import { getContextDataQuery } from "../queries";
import { createAppTheme } from "../theme";
import { getColorScheme, getColorTheme } from "../api-utils/onshape-params";
import { DEFAULT_SETTINGS, type Settings } from "../../shared/types";
import { NotFoundError, RootCrash } from "../app/root-error";

export const Route = createRootRoute({
    // Fetch the user's settings to theme the single app-wide MantineProvider, but
    // never throw: error/landing pages (e.g. unauthenticated) must still render.
    loader: async (): Promise<{ settings: Settings }> => {
        try {
            const { settings } = await queryClient.ensureQueryData(
                getContextDataQuery()
            );
            return { settings };
        } catch {
            return { settings: DEFAULT_SETTINGS };
        }
    },
    component: RootComponent,
    // notFoundComponent renders inside the root Outlet, so it has the provider.
    notFoundComponent: NotFoundError,
    // errorComponent replaces the root component (no provider), so it must not use
    // Mantine. It only fires if the always-on root component itself throws.
    errorComponent: RootCrash
});

function RootComponent(): ReactNode {
    const { settings } = Route.useLoaderData();
    const search = useSearch({ strict: false });

    const library = settings.library;
    const theme = useMemo(() => createAppTheme(library), [library]);
    const colorTheme = getColorTheme(
        settings.theme,
        search.systemTheme ?? "light"
    );

    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider
                theme={theme}
                forceColorScheme={getColorScheme(colorTheme)}
            >
                <ModalsProvider
                    labels={{ confirm: "Confirm", cancel: "Cancel" }}
                >
                    <Notifications
                        position="bottom-center"
                        limit={3}
                        autoClose={4000}
                    />
                    <Outlet />
                </ModalsProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}
