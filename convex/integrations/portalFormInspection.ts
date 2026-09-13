import type {
  PortalFormInspection,
  PortalFormRole,
} from "./stagehandPortalDriver";

export function portalFormInspectionExpression(input: {
  selector: string;
  role: PortalFormRole;
}): string {
  const serialized = JSON.stringify(input).replace(/</g, "\\u003c");
  return `(() => {
    const { selector, role } = ${serialized};
    const select = () => {
      if (selector.startsWith("xpath=")) {
        const snapshot = document.evaluate(selector.slice(6), document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return Array.from({ length: snapshot.snapshotLength }, (_, index) => snapshot.snapshotItem(index)).filter((value) => value instanceof Element);
      }
      try { return Array.from(document.querySelectorAll(selector)); } catch { return []; }
    };
    const elements = select();
    const element = elements[0];
    const style = element ? window.getComputedStyle(element) : null;
    const visible = Boolean(element && !element.hidden && style?.display !== "none" && style?.visibility !== "hidden" && element.getClientRects().length > 0);
    const isFormControl = Boolean(element && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement));
    const formControl = element;
    const editable = role !== "submit" && Boolean(element && visible && ((isFormControl && !formControl.disabled && !formControl.readOnly) || element.isContentEditable === true));
    const form = isFormControl ? formControl.form : element instanceof HTMLButtonElement ? element.form : element?.closest("form") ?? null;
    return {
      count: elements.length,
      visible,
      editable,
      name: element?.getAttribute("name") ?? null,
      type: element?.getAttribute("type") ?? null,
      autocomplete: element?.getAttribute("autocomplete") ?? null,
      required: isFormControl ? formControl.required : false,
      value: isFormControl ? formControl.value : null,
      formValid: form ? form.checkValidity() : null,
    };
  })()`;
}

export async function inspectPortalFormOnPage(
  page: { evaluate<Result>(expression: string): Promise<Result> },
  input: { selector: string; role: PortalFormRole },
): Promise<PortalFormInspection> {
  return await page.evaluate<PortalFormInspection>(
    portalFormInspectionExpression(input),
  );
}
