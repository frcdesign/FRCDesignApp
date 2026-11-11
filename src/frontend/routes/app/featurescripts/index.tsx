import { createFileRoute } from "@tanstack/react-router";
import { FeatureScriptList } from "../../../features/featurescripts/components/featurescript-list";

export const Route = createFileRoute("/app/featurescripts/")({
    component: FeatureScriptList
});
