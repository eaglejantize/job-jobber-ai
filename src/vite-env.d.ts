/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ENABLE_FIELD_COPILOT?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
