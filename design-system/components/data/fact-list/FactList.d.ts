import * as React from 'react';

/**
 * "Euer Suchauftrag": the brief as a fact list with quiet icons.
 * @startingPoint section="Data" subtitle="Der Suchauftrag als schwebende Liste oder zentrale Karte" viewport="700x340"
 */
export interface FactListProps extends React.HTMLAttributes<HTMLDivElement> {
  facts: { id: 'ort' | 'budget' | 'band' | 'zeit' | 'equip' | string; label: string; changed?: boolean }[];
  /** floating = light group beside the conversation; card = central review card; compact = inline expansion. */
  variant?: 'floating' | 'card' | 'compact';
  title?: string;
  onEdit?: () => void;
  /** Inline edit mode: rows render inputs. */
  editing?: boolean;
  /** Draft values keyed by fact id while editing. */
  drafts?: Record<string, string>;
  onDraftChange?: (id: string, value: string) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function FactList(props: FactListProps): JSX.Element;
