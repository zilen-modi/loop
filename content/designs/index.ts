import type { DesignScenario } from "@/lib/design/evaluate";
import { urlShortener } from "./url-shortener";

export const designScenarios: Record<string, DesignScenario> = { [urlShortener.id]: urlShortener };
