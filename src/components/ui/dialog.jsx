import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from '../../lib/utils';

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = ({ className, ...props }) => (
  <DialogPrimitive.Portal {...props} />
)

const DialogOverlay = ({ className, ...props }) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity",
      className
    )}
    {...props}
  />
)

const DialogContent = ({ className, children, ...props }) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      className={cn(
        "fixed z-50 left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
)

const DialogHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-2 text-center", className)} {...props} />
)

const DialogTitle = DialogPrimitive.Title

const DialogDescription = DialogPrimitive.Description

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
