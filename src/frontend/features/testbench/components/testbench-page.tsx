import { Alert, Container, Loader, Tabs, Text } from "@mantine/core";
import { type ReactNode, useState } from "react";
import {
    AccessLevel,
    isWithinAccessLevel
} from "@backend/features/auth/access-level";
import { NavbarRow, SettingsControls } from "../../../components/app-navbar";
import { m } from "../../../paraglide/messages";
import { useAccessData } from "../../auth/access-level";
import { DEFAULT_DRAFT } from "../call-draft";
import { OnshapeCallForm } from "./onshape-call-form";
import { RateLimitPanel } from "./rate-limit-panel";
import { ToolbarPanel } from "./toolbar-panel";
import { WebhooksPanel } from "./webhooks-panel";

enum TestbenchTab {
    RATE_LIMITS = "rate-limits",
    TOOLBAR = "toolbar",
    WEBHOOKS = "webhooks",
    RAW = "raw"
}

/** The owner's tools for finding out how Onshape behaves, outside the panel's shell. */
export function TestbenchPage(): ReactNode {
    const access = useAccessData();
    return (
        <>
            <NavbarRow>
                <Text fw={600} style={{ alignSelf: "center" }}>
                    {m.testbenchTitle()}
                </Text>
                <SettingsControls />
            </NavbarRow>
            <Container size="lg" py="md">
                {access.isPending ? (
                    <Loader />
                ) : isWithinAccessLevel(
                      AccessLevel.OWNER,
                      access.maxAccessLevel
                  ) ? (
                    <TestbenchTabs />
                ) : (
                    <Alert color="red">{m.testbenchOwnerOnly()}</Alert>
                )}
            </Container>
        </>
    );
}

function TestbenchTabs(): ReactNode {
    const [rawDraft, setRawDraft] = useState(DEFAULT_DRAFT);
    const [tab, setTab] = useState(TestbenchTab.RATE_LIMITS);
    return (
        <Tabs
            value={tab}
            onChange={(value) => value && setTab(value as TestbenchTab)}
            keepMounted={false}
        >
            <Tabs.List mb="md">
                <Tabs.Tab value={TestbenchTab.RATE_LIMITS}>
                    {m.testbenchTabRateLimits()}
                </Tabs.Tab>
                <Tabs.Tab value={TestbenchTab.TOOLBAR}>
                    {m.testbenchTabToolbar()}
                </Tabs.Tab>
                <Tabs.Tab value={TestbenchTab.WEBHOOKS}>
                    {m.testbenchTabWebhooks()}
                </Tabs.Tab>
                <Tabs.Tab value={TestbenchTab.RAW}>
                    {m.testbenchTabRaw()}
                </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value={TestbenchTab.RATE_LIMITS}>
                <RateLimitPanel rawDraft={rawDraft} />
            </Tabs.Panel>
            <Tabs.Panel value={TestbenchTab.TOOLBAR}>
                <ToolbarPanel />
            </Tabs.Panel>
            <Tabs.Panel value={TestbenchTab.WEBHOOKS}>
                <WebhooksPanel />
            </Tabs.Panel>
            <Tabs.Panel value={TestbenchTab.RAW}>
                <OnshapeCallForm draft={rawDraft} onChange={setRawDraft} />
            </Tabs.Panel>
        </Tabs>
    );
}
