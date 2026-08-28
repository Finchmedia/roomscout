import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { RoomScoutMark } from "../brand/RoomScoutMark";

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="pubhead rs-public-header">
      <Link aria-label="RoomScout home" className="brand" to="/">
        <RoomScoutMark />
        <b>RoomScout</b>
      </Link>
      <button
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        className="rs-public-header__menu xbtn"
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <nav aria-label="Public navigation" className={menuOpen ? "open" : undefined}>
        <NavLink onClick={() => setMenuOpen(false)} to="/explore">Explore</NavLink>
        <Link onClick={() => setMenuOpen(false)} to="/#how">How it works</Link>
        <NavLink onClick={() => setMenuOpen(false)} to="/sign-in">Sign in</NavLink>
        <Link className="btn btn-p" onClick={() => setMenuOpen(false)} to="/app/scout">Start my search</Link>
      </nav>
    </header>
  );
}
