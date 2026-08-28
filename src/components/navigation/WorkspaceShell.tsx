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
import { RoomScoutMark } from "../brand/RoomScoutMark";

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  count?: number;
};

const musicianItems: NavItem[] = [
  { label: "Scout", to: "/app/scout", icon: Radar },
  { label: "Explore", to: "/app/explore", icon: Search },
  { label: "My search", to: "/app/search", icon: SlidersHorizontal },
  { label: "Inbox", to: "/app/inbox", icon: Mail, count: 1 },
];

const opsItems: NavItem[] = [
  { label: "Overview", to: "/ops", icon: Activity },
  { label: "Signals", to: "/ops/signals", icon: Radio, count: 4 },
  { label: "Sources", to: "/ops/sources", icon: Database },
  { label: "Outreach", to: "/ops/outreach", icon: Send, count: 1 },
  { label: "Inbox", to: "/ops/inbox", icon: Mail, count: 1 },
];

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
          <RoomScoutMark size={22} />
          <b>
            RoomScout {isOps ? <span className="rs-brand-accent">Ops</span> : null}
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
