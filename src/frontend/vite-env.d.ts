/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Dev-only: the access level granted, and so the one viewed by default. */
    readonly VITE_ACCESS_LEVEL_OVERRIDE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
