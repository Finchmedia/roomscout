import { useConvexAuth } from "convex/react";
import { LandingPage as ClaudeLandingPage, researchCoverageSnapshot } from "@/ui/landing";
import { useCopy } from "@/ui/copy";

const SCOUT_RETURN_TO = encodeURIComponent("/app/scout");

/** Public route adapter for the Claude design-system landing surface. */
export function LandingPage() {
  const { t } = useCopy();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const isGuest = !isLoading && !isAuthenticated;

  return <ClaudeLandingPage
    demoHref="/design/scout"
    researchHref={`/sign-up?returnTo=${SCOUT_RETURN_TO}`}
    startHref={isGuest ? `/sign-up?returnTo=${SCOUT_RETURN_TO}` : "/app/scout"}
    signInHref={isLoading ? undefined : isAuthenticated ? "/app/scout" : `/sign-in?returnTo=${SCOUT_RETURN_TO}`}
    exploreHref="/#how"
    signInLabel={t(isAuthenticated ? "appRoutes.scout" : "landing.route.signIn")}
    startLabel={t(isGuest ? "landing.route.start" : "appRoutes.scout")}
    exploreLabel={t("landing.hero.cta.secondary.label")}
    demoDisclosure={t("landing.route.demoDisclosure")}
    researchCoverage={researchCoverageSnapshot}
  />;
}
