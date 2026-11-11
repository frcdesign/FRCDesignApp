import { Input, TextInput } from "@mantine/core";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { m } from "../../../paraglide/messages";
import { useFeatureScriptsSearch } from "../search";

/** In the navbar's second row, where a library's search is. */
export function FeatureScriptSearchBar(): ReactNode {
    const query = useFeatureScriptsSearch((state) => state.query);
    const setQuery = useFeatureScriptsSearch((state) => state.setQuery);
    return (
        <TextInput
            type="search"
            autoFocus
            flex={1}
            leftSection={<MagnifyingGlassIcon />}
            placeholder={m.featureScriptsSearch()}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            rightSection={
                query ? (
                    <Input.ClearButton onClick={() => setQuery("")} />
                ) : undefined
            }
        />
    );
}
