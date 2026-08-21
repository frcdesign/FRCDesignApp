import {
    createRootRoute,
    Outlet,
    useParams,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { ReactNode, useMemo } from "react";
import { useColorScheme } from "@mantine/hooks";
import { queryClient } from "../lib/query-client";
import { createAppTheme } from "../theme";
import { getColorTheme } from "../lib/onshape-params";
import { DEFAULT_SETTINGS } from "@backend/features/settings/settings";
import { NotFoundError, RootCrash } from "../components/root-error";
import { isLibraryId } from "../features/library/library-path";

export const Route = createRootRoute({
    component: RootComponent,
    // notFoundComponent renders inside the root Outlet, so it has the provider.
    notFoundComponent: NotFoundError,
    // errorComponent replaces the root component (no provider), so it must not use
    // Mantine. It only fires if the always-on root component itself throws.
    errorComponent: RootCrash
});

function RootComponent(): ReactNode {
    const search = useSearch({ strict: false });
    // Both come off the url — the entry redirect seeds them and a switch
    // rewrites them — so the first paint is already the right colors.
    const params = useParams({ strict: false });

    // The root renders around a not-found too, so the url may name a library
    // that does not exist; its theme still has to resolve to something.
    const libraryId =
        params.libraryId && isLibraryId(params.libraryId)
            ? params.libraryId
            : DEFAULT_SETTINGS.libraryId;
    const theme = useMemo(() => createAppTheme(libraryId), [libraryId]);
    // Onshape puts its own scheme on the url when it launches us; standalone
    // there is none, and the OS is what "system" means.
    const osColorScheme = useColorScheme();
    const colorTheme = getColorTheme(
        search.theme ?? DEFAULT_SETTINGS.theme,
        search.systemTheme ?? osColorScheme
    );

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
                        // Mantine pins this at 440px otherwise, wrapping a
                        // message with an action button even on a wide window.
                        // Mantine clamps it to the viewport on a narrow one.
                        containerWidth="max-content"
                    />
                    <Outlet />
                </ModalsProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}
