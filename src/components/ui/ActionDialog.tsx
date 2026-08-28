import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type ActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: ActionDialogProps) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay open rs-dialog-overlay" />
        <Dialog.Content className="modal rs-dialog-content">
          <div className="modal-top">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description ? <Dialog.Description className="mono">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close aria-label="Close dialog" className="xbtn" type="button">
              <X aria-hidden="true" size={18} />
            </Dialog.Close>
          </div>
          <div className="modal-body">{children}</div>
          {footer ? <div className="modal-foot">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
