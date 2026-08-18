/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Dev-only: the access level the app is viewed as by default. */
    readonly VITE_DEFAULT_ACCESS_LEVEL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
