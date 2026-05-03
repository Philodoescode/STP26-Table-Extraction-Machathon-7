// SmithyAssistant — the floating chat bubble + slide-in panel
// Appears only after hasProcessed === true

import { useState, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { MessageCircle, X, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { MessageList } from "@/components/ui/message-list"
import { MessageInput } from "@/components/ui/message-input"
import { type Message } from "@/components/ui/chat-message"
import { useAutoScroll } from "@/hooks/use-auto-scroll"

// ─── Smithy avatar ───────────────────────────────────────────────────────────
function SmithyAvatar({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-primary shrink-0"
      style={{ width: size, height: size }}
    >
      <Sparkles style={{ width: size * 0.5, height: size * 0.5 }} className="text-primary-foreground" />
    </div>
  )
}

// ─── Chat panel body ─────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"
const SMITHY_API_URL = import.meta.env.VITE_SMITHY_API_URL || `${API_BASE_URL}/smithy`

interface SmithyChatPanelProps {
  onClose: () => void
  jobId: string | null
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "smithy-greeting",
    role: "assistant",
    content:
      "Hey! I'm Smithy 👋\n\nI've analyzed your extracted tables. Ask me anything about the data — I can summarize rows, explain patterns, or help you export in a specific format.",
    createdAt: new Date(),
  },
]

function SmithyChatPanel({ onClose, jobId }: SmithyChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const { containerRef, handleScroll, handleTouchStart } = useAutoScroll([messages])

  const handleSubmit = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.()
    const trimmed = input.trim()
    if (!trimmed || isGenerating) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date(),
    }

    // Build history in the format the Smithy API expects
    const history = [...messages, userMsg].map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      content: m.content,
    }))

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsGenerating(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${SMITHY_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: history,
          ...(jobId ? { job_id: jobId } : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }

      const data = await res.json()
      const reply: Message = {
        id: `smithy-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, reply])
    } catch (err: any) {
      if (err.name === "AbortError") return
      const errMsg: Message = {
        id: `smithy-err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ ${err.message || "Something went wrong. Please try again."}`,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setIsGenerating(false)
  }

  return (
    <motion.div
      key="smithy-panel"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "fixed bottom-24 right-6 z-50 flex flex-col",
        "w-[360px] h-[520px]",
        "rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/30 overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-sm shrink-0">
        <SmithyAvatar size={34} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-none">Smithy</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">AI Table Analyst</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <MessageList
          messages={messages}
          isTyping={isGenerating}
          showTimeStamps={false}
        />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/50 bg-card/80 backdrop-blur-sm shrink-0">
        <form onSubmit={handleSubmit}>
          <MessageInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            isGenerating={isGenerating}
            stop={handleStop}
            placeholder="Ask Smithy about your tables..."
          />
        </form>
      </div>
    </motion.div>
  )
}

// ─── Speech-bubble callout ────────────────────────────────────────────────────
function SmithyCallout({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 8 }}
      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.3 }}
      className={cn(
        "fixed bottom-[5.5rem] right-[4.5rem] z-50",
        "max-w-[200px] rounded-2xl rounded-br-sm",
        "bg-card border border-border/60 shadow-xl shadow-black/20 px-3.5 py-2.5",
        "cursor-pointer"
      )}
      onClick={onDismiss}
    >
      <p className="text-[12px] font-medium text-foreground leading-snug">
        Analyze your output with Smithy ✨
      </p>
      {/* Arrow pointing to the button */}
      <div className="absolute -bottom-[7px] right-3 w-3 h-3 rotate-45 bg-card border-r border-b border-border/60" />
    </motion.div>
  )
}

// ─── Main floating bubble ─────────────────────────────────────────────────────
interface SmithyAssistantProps {
  hasProcessed: boolean
  jobId: string | null
}

export default function SmithyAssistant({ hasProcessed, jobId }: SmithyAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCallout, setShowCallout] = useState(false)
  const calloutDismissed = useRef(false)

  // Show callout when pipeline completes for the first time
  useEffect(() => {
    if (hasProcessed && !calloutDismissed.current) {
      const t = setTimeout(() => setShowCallout(true), 600)
      return () => clearTimeout(t)
    }
  }, [hasProcessed])

  // Auto-dismiss callout after 5 s
  useEffect(() => {
    if (!showCallout) return
    const t = setTimeout(() => {
      setShowCallout(false)
      calloutDismissed.current = true
    }, 5000)
    return () => clearTimeout(t)
  }, [showCallout])

  const handleBubbleClick = () => {
    setShowCallout(false)
    calloutDismissed.current = true
    setIsOpen((v) => !v)
  }

  return (
    <>
      {/* Callout speech bubble */}
      <AnimatePresence>
        {hasProcessed && showCallout && !isOpen && (
          <SmithyCallout onDismiss={() => {
            setShowCallout(false)
            calloutDismissed.current = true
          }} />
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && <SmithyChatPanel onClose={() => setIsOpen(false)} jobId={jobId} />}
      </AnimatePresence>

      {/* Floating circle button */}
      <AnimatePresence>
        {hasProcessed && (
          <motion.button
            key="smithy-bubble"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            onClick={handleBubbleClick}
            aria-label={isOpen ? "Close Smithy chat" : "Open Smithy chat"}
            className={cn(
              "fixed bottom-6 right-6 z-50",
              "flex h-14 w-14 items-center justify-center rounded-full",
              "bg-primary text-primary-foreground shadow-lg shadow-primary/40",
              "transition-shadow duration-200 hover:shadow-xl hover:shadow-primary/50",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            )}
          >
            {/* Pulsing ring — only when callout is visible and panel is closed */}
            {showCallout && !isOpen && (
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30 pointer-events-none" />
            )}

            <AnimatePresence mode="popLayout" initial={false}>
              {isOpen ? (
                <motion.span
                  key="x"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <X className="h-6 w-6" />
                </motion.span>
              ) : (
                <motion.span
                  key="chat"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <MessageCircle className="h-6 w-6" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
