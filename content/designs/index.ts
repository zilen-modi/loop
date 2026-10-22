import type { DesignScenario } from "@/lib/design/evaluate";
import { urlShortener } from "./url-shortener";
import { rateLimiterLab } from "./rate-limiter-lab";

export const designScenarios: Record<string, DesignScenario> = Object.fromEntries([urlShortener, rateLimiterLab].map((s) => [s.id, s]));
