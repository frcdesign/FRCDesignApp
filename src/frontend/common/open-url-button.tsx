import { Button } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { openUrlInNewTab } from "./url";

interface UrlButtonProps {
    url: string;
    text: string;
}

export function OpenUrlButton(props: UrlButtonProps) {
    return (
        <Button
            leftSection={<IconExternalLink size={16} />}
            onClick={() => openUrlInNewTab(props.url)}
            variant="light"
        >
            {props.text}
        </Button>
    );
}
