import type { DesignScenario } from "@/lib/design/evaluate";
import { urlShortener } from "./url-shortener";
import { rateLimiterLab } from "./rate-limiter-lab";
import { notificationsLab } from "./notifications-lab";

export const designScenarios: Record<string, DesignScenario> = Object.fromEntries([urlShortener, rateLimiterLab, notificationsLab].map((s) => [s.id, s]));
