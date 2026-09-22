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
import * as z from "zod";
import { Theme } from "@backend/features/settings/settings";
import { adoptOnshapeLaunch } from "../../lib/onshape-params";
import {
    isReadOnlyInstance,
    LAUNCH_KEYS,
    OnshapeLaunchType
} from "../../lib/onshape-launch";
import {
    adoptAppParams,
    APP_PARAM_KEYS,
    type AppParams,
    AppParamsType
} from "../../lib/app-params";
import { parseSearch } from "../../lib/search-params";
import { AppNavbar } from "../../components/app-navbar";
import {
    ProgramSelect,
    useNeedsProgram
} from "../../features/library/components/program-select";
import { SectionLoading } from "../../components/app-zero-state";
import { useMessageListener } from "../../lib/messages";
import { updateUiState } from "../../lib/ui-state";
import { RootAppError } from "../../components/root-error";

/** What the entry redirect carries and the app takes off the url. */
const LaunchSearchType = OnshapeLaunchType.extend({
    /** The caller's saved theme, from their row. */
    theme: z.enum(Theme).optional().catch(undefined),
    /** Set when their row says they have answered the program prompt. Either
     * spelling: the router JSON-parses a value that is valid JSON. */
    libraryChosen: z
        .union([z.boolean(), z.stringbool()])
        .optional()
        .catch(undefined)
});

/** What the entry redirect seeds off the caller's row, beside the launch. */
const ENTRY_KEYS = ["theme", "libraryChosen"] as const;

type LaunchSearch = z.infer<typeof LaunchSearchType>;

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => ({
        ...parseSearch(LaunchSearchType, search),
        ...parseSearch(AppParamsType, search)
    }),
    search: {
        // Only the app's own: a launch is taken into the store below and struck
        // off, so navigating never carries the caller's document around.
        middlewares: [retainSearchParams([...APP_PARAM_KEYS])]
    },
    beforeLoad: ({ search, location }) => {
        adoptAppParams(search);
        adoptOnshapeLaunch(search);
        // The entry redirect seeds the account's saved theme; ui-state is what
        // the app reads, so take it rather than leave a second answer in the url.
        if (search.theme) {
            updateUiState({ theme: search.theme }, { sync: false });
        }
        // Seeded only when it is true, so this never un-answers the prompt for
        // a caller who answered it here while signed out.
        if (search.libraryChosen) {
            updateUiState({ libraryChosen: true }, { sync: false });
        }
        // Nothing to insert into, so the app cannot do its one job here.
        if (isReadOnlyInstance(search)) {
            throw redirect({ to: "/version-error", replace: true });
        }
        if (isLaunch(search)) {
            throw redirect({
                to: location.pathname,
                search: strippedOfLaunch(search),
                replace: true
            });
        }
    },
    errorComponent: RootAppError
});

function isLaunch(search: LaunchSearch): boolean {
    return (
        ENTRY_KEYS.some((key) => search[key] !== undefined) ||
        LAUNCH_KEYS.some((key) => search[key] !== undefined)
    );
}

/**
 * The url with the launch taken out. Undefined rather than absent:
 * `retainSearchParams` reads a missing key as one it should put back.
 */
function strippedOfLaunch(search: LaunchSearch & AppParams): AppParams {
    const cleared = Object.fromEntries(
        [...LAUNCH_KEYS, ...ENTRY_KEYS].map((key) => [key, undefined])
    );
    return { ...search, ...cleared };
}

function App() {
    // The navbar (control row + always-open filters) is self-sizing, so measure
    // it and feed its height to AppShell rather than hardcoding one.
    const { ref: headerRef, height: headerHeight } = useElementSize();
    const needsProgram = useNeedsProgram();

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
                    {/* A library nobody has asked for yet is no page to show,
                        so the welcome stands in for it rather than over it. */}
                    {needsProgram ? <ProgramSelect /> : <Outlet />}
                </Suspense>
                <TanStackRouterDevtools />
            </AppShell.Main>
        </AppShell>
    );
}
