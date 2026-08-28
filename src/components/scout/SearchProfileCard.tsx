import { Pencil } from "lucide-react";
import type { SavedSearch, SearchField } from "../../mocks/demoData";
import { LedgerCard } from "../ui/LedgerCard";

type SearchProfileCardProps = {
  search: SavedSearch;
  fields?: SearchField[];
  progress?: number;
  onConfirm?: () => void;
  onEdit?: (field: SearchField) => void;
  totalFields?: number;
  canConfirm?: boolean;
  confirming?: boolean;
  confirmationHint?: string;
};

export function SearchProfileCard({
  search,
  fields = search.fields,
  progress = fields.length,
  onConfirm,
  onEdit,
  totalFields,
  canConfirm = true,
  confirming = false,
  confirmationHint,
}: SearchProfileCardProps) {
  const total = totalFields ?? search.fields.length;
  const complete = Math.min(progress, total);

  return (
    <LedgerCard
      accent
      className="rs-search-profile"
      header={
        <>
          <span className="type t-scout">{search.status === "draft" ? "Draft search" : "Your search"}</span>
          <span className="mono">{search.status === "draft" ? "Not active yet" : search.status}</span>
        </>
      }
    >
      <h2 className="ltitle">{search.title}</h2>
      <dl className="rs-search-fields">
        {fields.map((field) => (
          <div className="frow" key={field.label}>
            <dt className="k">{field.label}</dt>
            <dd className="v">
              {field.value}
              <span className={`chip${field.source === "you" ? " you" : ""}`}>{field.source === "you" ? "You" : "Scout"}</span>
              {onEdit ? (
                <button aria-label={`Edit ${field.label}`} className="edit" onClick={() => onEdit(field)} type="button">
                  <Pencil aria-hidden="true" size={12} />
                </button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      {search.status === "draft" ? (
        <div className="rs-search-confirmation">
          <div aria-label={`${complete} of ${total} high-value fields set`} className="meter">
            {Array.from({ length: total }, (_, index) => <i className={index < complete ? "on" : undefined} key={index} />)}
          </div>
          <p className="mono">{complete} of {total} high-value fields set</p>
          {confirmationHint ? <p className="hint">{confirmationHint}</p> : null}
          <button className="btn btn-p" disabled={!canConfirm || confirming} onClick={onConfirm} type="button">{confirming ? "Activating…" : "Confirm search"}</button>
        </div>
      ) : null}
    </LedgerCard>
  );
}
