import { LandingPage as ClaudeLandingPage } from "@/ui/landing";
import { useCopy } from "@/ui/copy";

const SCOUT_RETURN_TO = encodeURIComponent("/app/scout");

/** Public route adapter for the Claude design-system landing surface. */
export function LandingPage() {
  const { t } = useCopy();

  return <ClaudeLandingPage
    demoHref="/design/scout"
    startHref={`/sign-up?returnTo=${SCOUT_RETURN_TO}`}
    signInHref={`/sign-in?returnTo=${SCOUT_RETURN_TO}`}
    exploreHref="/explore"
    signInLabel={t("landing.route.signIn")}
    startLabel={t("landing.route.start")}
    exploreLabel={t("landing.route.explore")}
    demoDisclosure={t("landing.route.demoDisclosure")}
  />;
}
