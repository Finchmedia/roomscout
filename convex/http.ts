import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { webhook as agentmailWebhook } from "./agentmail";
import { webhook as firecrawlWebhook } from "./firecrawl";
import { optionsHttp as realtimeOptions, sessionHttp as realtimeSession } from "./voice";

const http = httpRouter();

http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async () => {
    return Response.json({ ok: true, service: "roomscout" });
  }),
});

http.route({
  path: "/api/webhooks/firecrawl",
  method: "POST",
  handler: firecrawlWebhook,
});

http.route({
  path: "/api/webhooks/agentmail",
  method: "POST",
  handler: agentmailWebhook,
});

http.route({
  path: "/api/realtime/session",
  method: "OPTIONS",
  handler: realtimeOptions,
});

http.route({
  path: "/api/realtime/session",
  method: "POST",
  handler: realtimeSession,
});

registerStaticRoutes(http, components.staticHosting);

export default http;
