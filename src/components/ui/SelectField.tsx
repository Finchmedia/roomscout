import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

export type SelectOption = {
  label: string;
  value: string;
};

type SelectFieldProps = {
  ariaLabel: string;
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
};

export function SelectField({
  ariaLabel,
  options,
  value,
  onValueChange,
}: SelectFieldProps) {
  return (
    <SelectPrimitive.Root onValueChange={onValueChange} value={value}>
      <SelectPrimitive.Trigger aria-label={ariaLabel} className="rs-select-trigger">
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="rs-select-content"
          collisionPadding={10}
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.ScrollUpButton className="rs-select-scroll-button">
            <ChevronUp aria-hidden="true" size={15} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="rs-select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                className="rs-select-item"
                key={option.value}
                value={option.value}
              >
                <SelectPrimitive.ItemIndicator className="rs-select-item__indicator">
                  <Check aria-hidden="true" size={15} />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="rs-select-scroll-button">
            <ChevronDown aria-hidden="true" size={15} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
