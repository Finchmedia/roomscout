import type { ReactNode } from "react";

type LedgerCardProps = {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  accent?: boolean;
};

export function LedgerCard({
  children,
  className = "",
  header,
  footer,
  accent = false,
}: LedgerCardProps) {
  return (
    <section className={`lcard rs-ledger-card${accent ? " rs-ledger-card--accent" : ""}${className ? ` ${className}` : ""}`}>
      {header ? <header className="lcard-top rs-ledger-card__header">{header}</header> : null}
      <div className="lcard-body rs-ledger-card__body">{children}</div>
      {footer ? <footer className="lcard-foot rs-ledger-card__footer">{footer}</footer> : null}
    </section>
  );
}

type PageHeaderProps = {
  title: string;
  meta?: ReactNode;
  eyebrow?: string;
};

export function PageHeader({ title, meta, eyebrow }: PageHeaderProps) {
  return (
    <header className="pagehead rs-page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
      </div>
      {meta ? <div className="rs-page-header__meta">{meta}</div> : null}
    </header>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rs-empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
