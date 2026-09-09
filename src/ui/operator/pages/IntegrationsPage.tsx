/**
 * Operator → Integrationen (`page = "integrations"`).
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx`
 * (`pages.integrations`); `docs/UI_PORT/OPERATOR_SCREENS.md` §8 — all **five**
 * providers (OpenAI included, unlike the overview's four tiles), the
 * `1.2fr 1.3fr 1fr auto` row header with the rotating chevron, and the
 * `Konfiguration:` / `Letzter Demo-Test:` / note panel.
 *
 * The open row is controlled state: an overview tile can open a provider here
 * (§8.2), so the accordion cannot own it.
 *
 * Demo data — see `state/useOperatorDemoState.ts`.
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { StatusDot } from "@/components/ui/status-dot"
import { useCopy } from "@/ui/copy"
import { PartnerLogo } from "@/ui/operator/IntegrationTile"
import { PageIntro } from "@/ui/operator/PageIntro"
import {
  OPERATOR_INTEGRATION_IDS,
  type OperatorIntegration,
  type OperatorIntegrationId,
} from "@/ui/operator/state/useOperatorDemoState"

function isIntegrationId(value: string): value is OperatorIntegrationId {
  return (OPERATOR_INTEGRATION_IDS as readonly string[]).includes(value)
}

interface IntegrationsPageProps {
  integrations: readonly OperatorIntegration[]
  openIntegrationId: OperatorIntegrationId | null
  onOpenIntegrationChange: (id: OperatorIntegrationId | null) => void
}

function IntegrationsPage({
  integrations,
  openIntegrationId,
  onOpenIntegrationChange,
}: IntegrationsPageProps) {
  const { t } = useCopy()

  return (
    <div className="flex flex-col">
      <PageIntro
        title={t("operator.integrations.title")}
        lead={t("operator.integrations.subtitle")}
      />

      <Accordion
        type="single"
        collapsible
        variant="integration"
        className="mt-[var(--space-12)]"
        value={openIntegrationId ?? ""}
        onValueChange={(value) =>
          onOpenIntegrationChange(isIntegrationId(value) ? value : null)
        }
      >
        {integrations.map((integration) => (
          <AccordionItem key={integration.id} value={integration.id}>
            <AccordionTrigger heading={false}>
              <span className="flex min-w-0 items-center gap-[var(--space-5)] font-medium">
                <PartnerLogo src={integration.logo} />
                {t(integration.nameKey)}
              </span>
              <span className="min-w-0 text-rs-ink-4">
                {t(integration.roleKey)}
              </span>
              <StatusDot
                tone={integration.tone}
                className="text-[length:var(--text-body-size)] text-rs-ink"
              >
                {t(integration.statusKey)}
              </StatusDot>
            </AccordionTrigger>
            <AccordionContent>
              <div>
                <span className="text-rs-ink-6">
                  {t("operator.integrations.field.config")}
                </span>{" "}
                {t(integration.configKey)}
              </div>
              <div>
                <span className="text-rs-ink-6">
                  {t("operator.integrations.field.lastTest")}
                </span>{" "}
                {t(integration.testKey)}
              </div>
              <div className="col-span-full text-rs-ink-4">
                {t(integration.noteKey)}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

export { IntegrationsPage }
export type { IntegrationsPageProps }
