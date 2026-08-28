import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { PropsWithChildren } from "react";
import { api } from "../../convex/_generated/api";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required. Run `npx convex dev` first.");
}

const convex = new ConvexReactClient(convexUrl);

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ConvexAuthProvider
      client={convex}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
      }}
      ambientSignIns={[]}
    >
      {children}
    </ConvexAuthProvider>
  );
}
