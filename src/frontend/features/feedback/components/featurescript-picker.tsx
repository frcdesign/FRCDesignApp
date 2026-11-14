import { Select } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import {
    getFeatureScriptsQuery,
    getFeatureScriptsVersionQuery
} from "../../featurescripts/queries";
import { m } from "../../../paraglide/messages";

interface FeatureScriptPickerProps {
    value: string | undefined;
    onChange: (featureScriptId: string | undefined) => void;
}

/** Optional: a report can be about FeatureScripts as a whole. */
export function FeatureScriptPicker(
    props: FeatureScriptPickerProps
): ReactNode {
    const { value, onChange } = props;
    const version = useQuery(getFeatureScriptsVersionQuery());
    // Waits for the version, which the tab's route loads but the form may open without.
    const features = useQuery({
        ...getFeatureScriptsQuery(version.data ?? 0),
        enabled: version.data !== undefined
    });
    return (
        <Select
            label={m.feedbackFeatureScriptLabel()}
            placeholder={m.feedbackFeatureScriptPlaceholder()}
            data={(features.data?.features ?? []).map((feature) => ({
                value: feature.id,
                label: feature.name
            }))}
            value={value ?? null}
            clearable
            searchable
            checkIconPosition="right"
            onChange={(id) => onChange(id ?? undefined)}
        />
    );
}
