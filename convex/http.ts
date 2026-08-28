import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { webhook as agentmailWebhook } from "./agentmail";
import { webhook as firecrawlWebhook } from "./firecrawl";

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

registerStaticRoutes(http, components.staticHosting);

export default http;
