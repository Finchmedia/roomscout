import { Component, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useCopy } from "../ui/copy";

class RenderBoundary extends Component<{ children: ReactNode; fallback: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Query/render failures must remain recoverable without exposing server details. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useCopy();
  const location = useLocation();
  const resetKey = `${location.pathname}${location.search}`;
  return <RenderBoundary resetKey={resetKey} fallback={
    <main className="flex min-h-dvh flex-col items-center justify-center gap-[var(--space-7)] bg-rs-surface-page px-[var(--space-11)] text-center text-rs-ink">
      <h1 className="text-2xl font-medium">{t("appRoutes.errorTitle")}</h1>
      <p role="alert" className="max-w-lg text-rs-ink-4">{t("appRoutes.errorDetail")}</p>
      <div className="flex flex-wrap justify-center gap-[var(--space-4)]">
        <Button onClick={() => window.location.reload()}>{t("appRoutes.reload")}</Button>
        <Button asChild variant="ghost"><Link to="/">{t("appRoutes.home")}</Link></Button>
      </div>
    </main>
  }>{children}</RenderBoundary>;
}
