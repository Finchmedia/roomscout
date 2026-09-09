import type { ReactNode } from "react";
import {
  Bell,
  Brain,
  CreditCard,
  Database,
  Shield,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import styles from "./SettingsFrame.module.css";

export type SettingsSection =
  | "sources"
  | "autonomy"
  | "knowledge"
  | "profile"
  | "notifications"
  | "usage"
  | "privacy";

const groups = [
  {
    label: "Scout",
    items: [
      ["sources", "Sources & access", Database],
      ["autonomy", "Autonomy", SlidersHorizontal],
      ["knowledge", "What Scout knows", Brain],
    ],
  },
  {
    label: "Account",
    items: [
      ["profile", "Profile", UserRound],
      ["notifications", "Notifications", Bell],
      ["usage", "Plan & usage", CreditCard],
      ["privacy", "Privacy", Shield],
    ],
  },
] as const;

const copy: Record<SettingsSection, [string, string]> = {
  sources: [
    "Sources & access",
    "Manage the private identities and reviewed portal access RoomScout may use for you.",
  ],
  autonomy: [
    "Autonomy",
    "Review what your Scout may do, what still needs approval, and where it must stop.",
  ],
  knowledge: [
    "What your Scout knows",
    "Inspect remembered facts and the working context used for your search.",
  ],
  profile: [
    "Your profile",
    "The account identity attached to this private RoomScout workspace.",
  ],
  notifications: [
    "Notifications",
    "See which product events can currently reach you.",
  ],
  usage: [
    "Plan & usage",
    "Availability of billing and metered usage for this workspace.",
  ],
  privacy: [
    "Privacy",
    "Understand what is stored, what is not, and which services perform product work.",
  ],
};

export function SettingsFrame({
  children,
  onSectionChange,
  section,
}: {
  children: ReactNode;
  onSectionChange: (section: SettingsSection) => void;
  section: SettingsSection;
}) {
  return (
    <div className={styles.frame}>
      <nav aria-label="Settings" className={styles.nav}>
        <h2>Settings</h2>
        {groups.map((group) => (
          <div className={styles.group} key={group.label}>
            <div className={styles.groupLabel}>{group.label}</div>
            {group.items.map(([id, label, Icon]) => (
              <button
                aria-current={section === id ? "page" : undefined}
                className={`${styles.link} ${section === id ? styles.active : ""}`}
                key={id}
                onClick={() => onSectionChange(id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <section className={styles.content}>
        <header className={styles.header}>
          <h1>{copy[section][0]}</h1>
          <p>{copy[section][1]}</p>
        </header>
        {children}
      </section>
    </div>
  );
}
