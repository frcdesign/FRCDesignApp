import { Button } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { IconSize } from "./style-constants";
import { openUrlInNewTab } from "./url";

interface UrlButtonProps {
    url: string;
    text: string;
}

export function OpenUrlButton(props: UrlButtonProps) {
    return (
        <Button
            leftSection={<IconExternalLink size={IconSize.SMALL} />}
            onClick={() => openUrlInNewTab(props.url)}
            variant="light"
        >
            {props.text}
        </Button>
    );
}
