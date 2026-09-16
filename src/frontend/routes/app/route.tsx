import {
    createFileRoute,
    Outlet,
    redirect,
    retainSearchParams,
    type SearchSchemaInput
} from "@tanstack/react-router";
import { AppShell } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { Suspense } from "react";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { OnshapeParams } from "../../lib/onshape-params";
import {
    adoptAppParams,
    APP_PARAM_KEYS,
    AppParamsType
} from "../../lib/app-params";
import { parseSearch } from "../../lib/search-params";
import { AppNavbar } from "../../components/app-navbar";
import { SectionLoading } from "../../components/app-zero-state";
import { useMessageListener } from "../../lib/messages";
import { updateUiState } from "../../lib/ui-state";
import { RootAppError } from "../../components/root-error";

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => ({
        ...(search as unknown as OnshapeParams),
        ...parseSearch(AppParamsType, search)
    }),
    search: {
        // What Onshape launched us with and what the app put there itself,
        // which every navigation keeps. The theme rides along too, but only as
        // far as beforeLoad below.
        middlewares: [
            retainSearchParams([
                "documentId",
                "instanceId",
                "instanceType",
                "elementId",
                "elementType",
                "systemTheme",
                "server",
                ...APP_PARAM_KEYS
            ])
        ]
    },
    beforeLoad: ({ search, location }) => {
        adoptAppParams(search);
        // The entry redirect seeds the account's saved theme; ui-state is what
        // the app reads, so take it rather than leave a second answer in the url.
        if (search.theme) {
            updateUiState({ theme: search.theme });
            throw redirect({
                to: location.pathname,
                search: { ...search, theme: undefined },
                replace: true
            });
        }
    },
    errorComponent: RootAppError
});

function App() {
    // The navbar (control row + always-open filters) is self-sizing, so measure
    // it and feed its height to AppShell rather than hardcoding one.
    const { ref: headerRef, height: headerHeight } = useElementSize();

    useMessageListener();

    return (
        <AppShell header={{ height: headerHeight || 56 }}>
            <AppShell.Header>
                <div ref={headerRef}>
                    <AppNavbar />
                </div>
            </AppShell.Header>
            {/* Cap the main region at one viewport so it (not the window)
                scrolls; the fixed header covers the top of this scrollbar,
                keeping it within the body. A column, so a page that wants its
                list in its own scroll container can have one by shrinking; a
                page that does not, like the home sections, keeps its content
                height and scrolls here. */}
            <AppShell.Main
                h="100dvh"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto"
                }}
            >
                {/* Without a boundary here, a pending match suspends past
                    the navbar to the root and blanks the page. */}
                <Suspense
                    fallback={<SectionLoading title="Loading library..." />}
                >
                    <Outlet />
                </Suspense>
                <TanStackRouterDevtools />
            </AppShell.Main>
        </AppShell>
    );
}
