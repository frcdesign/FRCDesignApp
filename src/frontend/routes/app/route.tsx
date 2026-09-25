import {
    createFileRoute,
    Outlet,
    retainSearchParams,
    type SearchSchemaInput
} from "@tanstack/react-router";
import { AppShell } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { Suspense } from "react";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as z from "zod";
import { Theme } from "@backend/features/settings/settings";
import { AppTabType } from "../../lib/tabs";
import { adoptOnshapeLaunch } from "../../lib/onshape-params";
import { OnshapeLaunchType } from "../../lib/onshape-launch";
import {
    adoptAppParams,
    APP_PARAM_KEYS,
    type AppParams,
    AppParamsType
} from "../../lib/app-params";
import { parseSearch } from "../../lib/search-params";
import { AppNavbar } from "../../components/app-navbar";
import { ProgramSelect } from "../../features/library/components/program-select";
import { SectionLoading } from "../../components/app-notice";
import { useMessageListener } from "../../lib/messages";
import { usePushSync } from "../../lib/push-sync";
import { getUiState, updateUiState } from "../../lib/ui-state";
import { showSuccessToast } from "../../lib/notifications";
import { RootAppError } from "../../components/root-error";

/** What the entry redirect carries and the app takes off the url. */
const LaunchSearchType = OnshapeLaunchType.extend({
    /** The caller's saved theme, from their row. */
    theme: z.enum(Theme).optional().catch(undefined),
    /** The tab their row names, when it names one. */
    tabId: AppTabType.optional().catch(undefined)
});

type LaunchSearch = z.infer<typeof LaunchSearchType>;

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => ({
        ...parseSearch(LaunchSearchType, search),
        ...parseSearch(AppParamsType, search)
    }),
    search: {
        middlewares: [retainSearchParams([...APP_PARAM_KEYS])]
    },
    beforeLoad: ({ search }) => adoptUrl(search),
    errorComponent: RootAppError
});

// Once per load: after that the store is the source of truth, and in-app
// navigation drops everything but the app's own params from the url.
let adopted = false;

function adoptUrl(search: LaunchSearch & AppParams): void {
    if (adopted) {
        return;
    }
    adopted = true;
    adoptAppParams(search);
    adoptOnshapeLaunch(search);
    // Seeded by the entry from the caller's row, which already has them.
    if (search.theme) {
        updateUiState({ theme: search.theme }, { sync: false });
    }
    if (search.tabId) {
        updateUiState({ tabId: search.tabId }, { sync: false });
    }
    if (getUiState().justSignedIn) {
        updateUiState({ justSignedIn: false });
        // Onshape only returns here on success.
        showSuccessToast("Signed in to Onshape.");
    }
}

function App() {
    const { ref: headerRef, height: headerHeight } = useElementSize();

    useMessageListener();
    usePushSync();

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
            {/* Over whichever library the app opened in, until it is answered. */}
            <ProgramSelect />
        </AppShell>
    );
}
