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
  Search,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";

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
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.current);
  const isOps = mode === "ops";
  const opsCounts = useQuery(api.ops.navCounts, isOps ? {} : "skip");
  const inboxThreads = useQuery(api.inbox.listThreadsMine, isOps ? "skip" : { limit: 50 });
  const newMatches = useQuery(api.matches.listMine, isOps ? "skip" : { status: "new", limit: 50 });
  const approvalDrafts = useQuery(api.outreach.listMine, isOps ? "skip" : { status: "awaiting_approval", limit: 50 });
  const musicianItems: NavItem[] = [
    { label: "Scout", to: "/app/scout", icon: Radar, count: approvalDrafts?.length },
    { label: "Explore", to: "/app/explore", icon: Search },
    { label: "My search", to: "/app/search", icon: SlidersHorizontal, count: newMatches?.length },
    { label: "Inbox", to: "/app/inbox", icon: Mail, count: inboxThreads?.filter((thread) => thread.status === "replied").length },
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

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className={`shell rs-workspace rs-workspace--${mode}`}>
      <aside className="side rs-sidebar">
        <Link aria-label={isOps ? "RoomScout Ops home" : "RoomScout home"} className="brand" to={home}>
          <b className="rs-wordmark">
            roomscout {isOps ? <span className="rs-brand-accent">ops</span> : null}
          </b>
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
