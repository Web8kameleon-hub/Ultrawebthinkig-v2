import { SUPPORTED_LANGUAGES_102 } from "./language_detection_102";

export const SUPPORTED_LANGUAGES_72 = [...SUPPORTED_LANGUAGES_102] as const;

export type SupportedLanguage72 = (typeof SUPPORTED_LANGUAGES_72)[number];
