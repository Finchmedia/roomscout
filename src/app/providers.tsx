import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { PropsWithChildren } from "react";
import { api } from "../../convex/_generated/api";
import { Toaster } from "../components/ui/sonner";
import { LocaleProvider } from "../ui/copy";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required. Run `npx convex dev` first.");
}

const convex = new ConvexReactClient(convexUrl);

/**
 * App-wide providers.
 *
 * `LocaleProvider` wraps everything so `useCopy()` works on every route —
 * English is its default locale, and it is the only place the dictionary is
 * mounted. The single `<Toaster />` lives here too: sonner keeps one queue per
 * toaster, so a second one anywhere below would render every toast twice.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <ConvexAuthProvider
        client={convex}
        api={{
          refreshSession: api.auth.refreshSession,
          signOut: api.auth.signOut,
        }}
        ambientSignIns={[]}
      >
        {children}
        <Toaster />
      </ConvexAuthProvider>
    </LocaleProvider>
  );
}
