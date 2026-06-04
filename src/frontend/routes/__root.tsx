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
import { Library, type Settings, Theme } from "../../shared/types";
import { NotFoundError, RootCrash } from "../app/root-error";

const DEFAULT_SETTINGS: Settings = {
    theme: Theme.SYSTEM,
    library: Library.FRC_DESIGN_LIB
};

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
    // `strict: false` returns the union of every route's search params, which
    // already includes the optional `settings`/`systemTheme` we read below.
    const search = useSearch({ strict: false });

    // Search params win so the navbar's library/theme switch is reactive; the
    // loader settings are the initial value and the fallback for pages (error,
    // landing) that have no settings in the URL.
    const library = search.settings?.library ?? settings.library;
    const theme = useMemo(() => createAppTheme(library), [library]);
    const colorTheme = getColorTheme(
        search.settings?.theme ?? settings.theme,
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
                    <Notifications position="bottom-center" limit={3} />
                    <Outlet />
                </ModalsProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}
