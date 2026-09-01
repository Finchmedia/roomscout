import agent from "@convex-dev/agent/convex.config";
import auth from "@convex-dev/auth/core/convex.config.js";
import password from "@convex-dev/auth/providers/password/convex.config.js";
import username from "@convex-dev/auth/username/convex.config.js";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import agentmail from "@agentmail/convex/convex.config";
import firecrawlRoomScout from "./components/firecrawlRoomScout/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
    FIRECRAWL_API_KEY: v.string(),
    FIRECRAWL_API_URL: v.optional(v.string()),
    FIRECRAWL_WEBHOOK_SECRET: v.optional(v.string()),
    FIRECRAWL_MONITOR_WEBHOOK_BEARER: v.optional(v.string()),
    AGENTMAIL_API_KEY: v.string(),
    AGENTMAIL_BASE_URL: v.optional(v.string()),
  },
});

app.use(auth, {
  httpPrefix: "/auth",
  env: {
    AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
    AUTH_JWKS: app.env.AUTH_JWKS,
  },
});
app.use(username);
app.use(password);
app.use(agent);
app.use(rateLimiter);
app.use(staticHosting);
app.use(agentmail, {
  env: {
    AGENTMAIL_API_KEY: app.env.AGENTMAIL_API_KEY,
    AGENTMAIL_BASE_URL: app.env.AGENTMAIL_BASE_URL,
  },
});
app.use(firecrawlRoomScout, {
  // Durable crawl callbacks are isolated from RoomScout's native-monitor
  // webhook at /api/webhooks/firecrawl.
  httpPrefix: "/api/components/firecrawl/",
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
    FIRECRAWL_API_URL: app.env.FIRECRAWL_API_URL,
    FIRECRAWL_WEBHOOK_SECRET: app.env.FIRECRAWL_WEBHOOK_SECRET,
  },
});

export default app;
