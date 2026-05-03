// Simplified typing indicator — no framer-motion dependency
import { cn } from "@/lib/utils"

export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1 px-3 py-2", className)}>
      <span
        className="size-1.5 rounded-full bg-muted-foreground/60 animate-[typing-dot-bounce_1.25s_ease-out_infinite]"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="size-1.5 rounded-full bg-muted-foreground/60 animate-[typing-dot-bounce_1.25s_ease-out_infinite]"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="size-1.5 rounded-full bg-muted-foreground/60 animate-[typing-dot-bounce_1.25s_ease-out_infinite]"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  )
}
