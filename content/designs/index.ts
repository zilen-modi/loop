import type { DesignScenario } from "@/lib/design/evaluate";
import { urlShortener } from "./url-shortener";
import { rateLimiterLab } from "./rate-limiter-lab";
import { notificationsLab } from "./notifications-lab";
import { newsFeedLab } from "./news-feed-lab";
import { ticketBookingLab } from "./ticket-booking-lab";

export const designScenarios: Record<string, DesignScenario> = Object.fromEntries([urlShortener, rateLimiterLab, notificationsLab, newsFeedLab, ticketBookingLab].map((s) => [s.id, s]));
