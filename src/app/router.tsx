import { Authenticated, AuthLoading, Unauthenticated } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { api } from "../../convex/_generated/api";
import {
  AppExplorePage,
  BrowserRunPage,
  ExplorePage,
  LandingPage,
  MapPage,
  MusicianInboxPage,
  MySearchPage,
  OpsAuditPage,
  OpsInboxPage,
  OpsOutreachPage,
  OpsOverviewPage,
  OpsSignalsPage,
  OpsSourcesPage,
  ProfilePage,
  ScoutPage,
  SignalDetailPage,
} from "../routes";
import { AuthRoute } from "./AuthRoute";
import { VoiceSessionProvider } from "../components/voice/VoiceSessionProvider";
import { DesignGalleryPage } from "../ui/gallery/DesignGalleryPage";
// The ported design-system surfaces. Public, demo-data only, no Convex — they
// are the review surface for the UI port and are mounted under /design/*.
// `LandingPage` is aliased because the legacy route module exports one too.
import { LandingPage as DesignLandingPage } from "../ui/landing";
import { DemoOperatorPage } from "../ui/operator";
import { DemoScoutPage } from "../ui/scout";
import { DemoSettingsPage } from "../ui/settings/DemoSettingsPage";

function RouteState({ children }: { children: ReactNode }) {
  return <div className="rs-route-state" role="status">{children}</div>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <>
      <AuthLoading><RouteState>Restoring your session…</RouteState></AuthLoading>
      <Unauthenticated>
        <Navigate replace to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  );
}

function RequireOperator({ children }: { children: ReactNode }) {
  const currentUser = useQuery(api.users.current);

  if (currentUser === undefined) return <RouteState>Checking operator access…</RouteState>;
  if (currentUser?.role !== "operator") {
    return (
      <div className="rs-route-state rs-route-state--panel">
        <span className="type t-scout">Protected workspace</span>
        <h1>Operator access required</h1>
        <p>Your account can use the musician workspace. The Ops cockpit is restricted server-side.</p>
        <Link className="btn btn-p" to="/app/scout">Open your Scout</Link>
      </div>
    );
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<ExplorePage />} path="/explore" />
      <Route element={<SignalDetailPage />} path="/signals/:signalId" />
      <Route element={<MapPage />} path="/map" />
      <Route element={<DesignGalleryPage />} path="/design" />
      <Route element={<DemoScoutPage />} path="/design/scout" />
      <Route element={<DemoSettingsPage />} path="/design/settings" />
      <Route element={<DemoOperatorPage />} path="/design/operator" />
      <Route element={<DesignLandingPage />} path="/design/landing" />
      <Route element={<AuthRoute />} path="/sign-in" />
      <Route element={<AuthRoute />} path="/sign-up" />

      <Route element={<RequireAuth><VoiceSessionProvider><Outlet /></VoiceSessionProvider></RequireAuth>}>
        <Route element={<ScoutPage />} path="/app/scout" />
        <Route element={<AppExplorePage />} path="/app/explore" />
        <Route element={<MapPage workspace />} path="/app/map" />
        <Route element={<MySearchPage />} path="/app/search" />
        <Route element={<MusicianInboxPage />} path="/app/inbox" />
        <Route element={<ProfilePage />} path="/app/profile" />
        <Route element={<ProfilePage />} path="/app/settings/:section?" />
        <Route element={<BrowserRunPage />} path="/app/runs/:runId" />
      </Route>

      <Route element={<RequireAuth><RequireOperator><OpsOverviewPage /></RequireOperator></RequireAuth>} path="/ops" />
      <Route element={<RequireAuth><RequireOperator><OpsSignalsPage /></RequireOperator></RequireAuth>} path="/ops/signals" />
      <Route element={<RequireAuth><RequireOperator><OpsSourcesPage /></RequireOperator></RequireAuth>} path="/ops/sources" />
      <Route element={<RequireAuth><RequireOperator><OpsOutreachPage /></RequireOperator></RequireAuth>} path="/ops/outreach" />
      <Route element={<RequireAuth><RequireOperator><OpsInboxPage /></RequireOperator></RequireAuth>} path="/ops/inbox" />
      <Route element={<RequireAuth><RequireOperator><OpsAuditPage /></RequireOperator></RequireAuth>} path="/ops/audit" />

      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
