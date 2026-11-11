import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { PageError, PageLoading } from "../../../components/app-notice";
import { FeatureScriptDetails } from "../../../features/featurescripts/components/featurescript-details";
import { useFeatureScriptsQuery } from "../../../features/featurescripts/queries";
import { m } from "../../../paraglide/messages";

export const Route = createFileRoute("/app/featurescripts/$featureId")({
    component: FeatureScriptPage
});

function FeatureScriptPage(): ReactNode {
    const { featureId } = Route.useParams();
    const { data, isPending, isError } = useFeatureScriptsQuery();

    if (isPending) {
        return <PageLoading title={m.featureScriptsLoading()} />;
    }
    const feature = data?.features.find((feature) => feature.id === featureId);
    if (isError || !feature) {
        return <PageError title={m.featureScriptsNotFound()} />;
    }
    return <FeatureScriptDetails feature={feature} />;
}
