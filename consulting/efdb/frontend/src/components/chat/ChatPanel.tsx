import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, MessageSquare } from 'lucide-react'
import { chatApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  onClose: () => void
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    try {
      await chatApi.stream(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        undefined,
        (chunk) => {
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + chunk }
            }
            return updated
          })
        },
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chat error')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="w-[420px] shrink-0 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">AI Emission Factor Advisor</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMessages([])}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <div className="text-sm text-muted-foreground">
              Ask me to find the best emission factor for any activity.
            </div>
            <div className="space-y-1.5 text-left max-w-xs mx-auto">
              {[
                'What EF for diesel road freight in India for 2023?',
                'Recommend an electricity grid EF for the UK',
                'What\'s the best EF for natural gas combustion?',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="block w-full text-left text-xs p-2 rounded-md border border-border hover:bg-muted/50 transition-colors text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn(msg.role === 'user' ? 'chat-message-user' : 'chat-message-ai')}>
            <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">
              {msg.role === 'user' ? 'You' : 'AI Advisor'}
            </div>
            {msg.content ? (
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Searching emission factors…</span>
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about an emission factor… (Enter to send)"
            rows={2}
            disabled={loading}
            className="flex-1 resize-none rounded-md border border-input bg-background text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="self-end h-9 w-9 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Shift+Enter for new line · Chat history resets when closed</p>
      </div>
    </div>
  )
}
