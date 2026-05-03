// Simplified MessageInput adapted from shadcn-chatbot-kit
// Removed: audio recording, file attachments, remeda, framer-motion
// Kept: textarea auto-resize, submit on Enter, send button, stop button

import React, { useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUp, Square } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAutosizeTextArea } from "@/hooks/use-autosize-textarea"
import { Button } from "@/components/ui/button"

interface MessageInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  submitOnEnter?: boolean
  stop?: () => void
  isGenerating: boolean
  placeholder?: string
}

export function MessageInput({
  placeholder = "Ask Smithy...",
  className,
  onKeyDown: onKeyDownProp,
  submitOnEnter = true,
  stop,
  isGenerating,
  ...props
}: MessageInputProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useAutosizeTextArea({
    ref: textAreaRef,
    maxHeight: 160,
    borderWidth: 1,
    dependencies: [props.value],
  })

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
    onKeyDownProp?.(event)
  }

  return (
    <div className="relative flex w-full">
      <div className="relative flex w-full items-end gap-2">
        <div className="relative flex-1">
          <textarea
            aria-label="Write your prompt here"
            placeholder={placeholder}
            ref={textAreaRef}
            onKeyDown={onKeyDown}
            className={cn(
              "z-10 w-full resize-none rounded-xl border border-input bg-background p-3 pr-12 text-sm ring-offset-background transition-[border] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />

          <div className="absolute right-2 bottom-2 z-20">
            <AnimatePresence mode="popLayout" initial={false}>
              {isGenerating && stop ? (
                <motion.div
                  key="stop"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    type="button"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    aria-label="Stop generating"
                    onClick={stop}
                  >
                    <Square className="h-3 w-3" fill="currentColor" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="send"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    type="submit"
                    size="icon"
                    className="h-8 w-8 rounded-lg transition-opacity"
                    aria-label="Send message"
                    disabled={!props.value || props.value === "" || isGenerating}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
MessageInput.displayName = "MessageInput"
