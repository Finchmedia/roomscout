import {
  Activity,
  ArrowLeftRight,
  CircleUser,
  Database,
  LogOut,
  Mail,
  Radar,
  Radio,
  ScrollText,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { useCopy } from "../../ui/copy";
import { BrandLockup } from "./BrandLockup";

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  count?: number;
};

function NavigationItems({ items }: { items: NavItem[] }) {
  return items.map(({ label, to, icon: Icon, count }) => (
    <NavLink className={({ isActive }) => (isActive ? "on" : undefined)} end={to === "/ops"} key={to} to={to}>
      <Icon aria-hidden="true" size={16} />
      <span>{label}</span>
      {count ? <span className="cnt">{count}</span> : null}
    </NavLink>
  ));
}

type WorkspaceShellProps = {
  children: ReactNode;
  mode: "musician" | "ops";
};

export function WorkspaceShell({ children, mode }: WorkspaceShellProps) {
  const { t } = useCopy();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.current);
  const isOps = mode === "ops";
  const opsCounts = useQuery(api.ops.navCounts, isOps ? {} : "skip");
  const inboxThreads = useQuery(api.inbox.listThreadsMine, isOps ? "skip" : { limit: 50 });
  const newMatches = useQuery(api.matches.listMine, isOps ? "skip" : { status: "new", limit: 50 });
  const approvalDrafts = useQuery(api.outreach.listMine, isOps ? "skip" : { status: "awaiting_approval", limit: 50 });
  const musicianItems: NavItem[] = [
    { label: t("appRoutes.workspace.scout"), to: "/app/scout", icon: Radar, count: approvalDrafts?.length },
    { label: t("appRoutes.workspace.search"), to: "/app/search", icon: SlidersHorizontal, count: newMatches?.length },
    { label: t("appRoutes.messages"), to: "/app/inbox", icon: Mail, count: inboxThreads?.filter((thread) => thread.status === "replied").length },
  ];
  const opsItems: NavItem[] = [
    { label: "Overview", to: "/ops", icon: Activity },
    { label: "Signals", to: "/ops/signals", icon: Radio, count: opsCounts?.signalReview },
    { label: "Sources", to: "/ops/sources", icon: Database },
    { label: "Outreach", to: "/ops/outreach", icon: Send, count: opsCounts?.outreach },
    { label: "Inbox", to: "/ops/inbox", icon: Mail, count: opsCounts?.inbox },
  ];
  const items = isOps ? opsItems : musicianItems;
  const home = isOps ? "/ops" : "/app/scout";
  const displayName = currentUser?.displayName ?? currentUser?.username ?? t("appRoutes.workspace.account");
  const initials = displayName.split(/[\s_-]+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join("").toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  if (!isOps) return (
    <div className={`rs-consumer-workspace${location.pathname === "/app/scout" ? " rs-consumer-workspace--scout" : ""}`}>
      <header className="rs-consumer-header">
        <Link className="rs-consumer-wordmark" to={home} aria-label={t("appRoutes.workspace.home")}><BrandLockup /></Link>
        <details className="rs-account-menu" key={location.pathname}>
          <summary aria-label={t("appRoutes.profileMenu")}><span>{initials}</span></summary>
          <nav aria-label={t("appRoutes.workspace.accountNavigation")} className="rs-account-menu__panel">
            <div className="rs-account-menu__identity"><strong>{displayName}</strong><span>{t("appRoutes.workspace.personalScout")}</span></div>
            <NavigationItems items={musicianItems} />
            <hr />
            <Link to="/app/settings/sources"><CircleUser size={16} aria-hidden="true" />{t("appRoutes.settings")}</Link>
            {currentUser?.role === "operator" ? <Link to="/ops"><ArrowLeftRight size={16} aria-hidden="true" />{t("appRoutes.operator")}</Link> : null}
            <button onClick={() => void handleSignOut()} type="button"><LogOut size={16} aria-hidden="true" />{t("appRoutes.signOut")}</button>
          </nav>
        </details>
      </header>
      <main className="rs-consumer-main">{children}</main>
    </div>
  );

  return (
    <div className={`shell rs-workspace rs-workspace--${mode}`}>
      <aside className="side rs-sidebar">
        <Link aria-label={isOps ? "RoomScout Ops home" : "RoomScout home"} className="brand" to={home}>
          <BrandLockup suffix={isOps ? <span className="rs-brand-accent">ops</span> : null} />
        </Link>
        <nav aria-label={isOps ? "Operations" : "RoomScout"} className="nav">
          <NavigationItems items={items} />
        </nav>
        <div className="grow" />
        <hr />
        <nav aria-label="Account" className="nav">
          {isOps ? (
            <>
              <NavLink to="/ops/audit"><ScrollText aria-hidden="true" size={16} />Audit log</NavLink>
              <Link to="/app/scout"><ArrowLeftRight aria-hidden="true" size={16} />Switch to RoomScout</Link>
              <span className="rs-nav-identity"><CircleUser aria-hidden="true" size={16} />{currentUser?.displayName ?? currentUser?.username ?? "Operator"}</span>
            </>
          ) : (
            <>
              <NavLink to="/app/profile"><CircleUser aria-hidden="true" size={16} />Profile</NavLink>
              {currentUser?.role === "operator" ? <Link to="/ops"><ArrowLeftRight aria-hidden="true" size={16} />Switch to Ops</Link> : null}
              <button className="rs-nav-button" onClick={handleSignOut} type="button"><LogOut aria-hidden="true" size={16} />Sign out</button>
            </>
          )}
        </nav>
      </aside>
      <main className="main rs-workspace__main">{children}</main>
      <nav aria-label="Mobile workspace navigation" className="rs-mobile-tabs">
        <NavigationItems items={items.slice(0, 4)} />
      </nav>
    </div>
  );
}
