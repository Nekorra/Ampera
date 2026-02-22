"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Send, Bot, Zap, Clock } from "lucide-react"
import { getStatusColor, getStatusBg, type Charger, type Incident } from "@/lib/charger-data"
import { useDashboardData } from "@/components/live-dashboard-provider"
import { Spinner } from "@/components/ui/spinner"

interface AITriageTabProps {
  preloadedChargerId: string | null
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  mentionedChargers?: string[]
}

type AITriageResponse = {
  content: string
  mentionedChargerIds?: string[]
  error?: string
}

function ContextChargerCard({ charger }: { charger: Charger }) {
  const color = getStatusColor(charger.status)
  return (
    <div className="rounded-xl border border-border bg-secondary p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{charger.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{charger.code}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${getStatusBg(charger.status)}`}
        >
          {charger.status}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Voltage</p>
          <p className="font-mono text-xs text-foreground">{charger.voltage.toFixed(1)}V</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Temp</p>
          <p className="font-mono text-xs text-foreground">{charger.temperature.toFixed(1)}C</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Risk</p>
          <p className="font-mono text-xs font-bold" style={{ color }}>
            {charger.riskScore.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  )
}

function extractMentionedChargerIds(text: string, chargers: Charger[]): string[] {
  const matches = [...text.matchAll(/charger\s*(\d{1,4})/gi)]
  const ids = new Set(matches.map((m) => `charger-${Number(m[1])}`))
  const valid = new Set(chargers.map((charger) => charger.id))
  return [...ids].filter((id) => valid.has(id))
}

function compactChargersForAI(chargers: Charger[]) {
  return chargers.map((charger) => ({
    id: charger.id,
    name: charger.name,
    code: charger.code,
    location: charger.location,
    lat: charger.lat,
    lng: charger.lng,
    status: charger.status,
    riskScore: charger.riskScore,
    riskHistory: charger.riskHistory,
    temperature: charger.temperature,
    voltage: charger.voltage,
    uptime: charger.uptime,
    energyDelivered: charger.energyDelivered,
    lastUpdated: charger.lastUpdated,
    voltageHistory: charger.voltageHistory,
    tempHistory: charger.tempHistory,
  }))
}

function compactIncidentsForAI(incidents: Incident[]) {
  return incidents.map((incident) => ({
    id: incident.id,
    chargerId: incident.chargerId,
    chargerName: incident.chargerName,
    chargerCode: incident.chargerCode,
    location: incident.location,
    severity: incident.severity,
    status: incident.status,
    title: incident.title,
    description: incident.description,
    metric: incident.metric,
    threshold: incident.threshold,
    currentValue: incident.currentValue,
    timeAgo: incident.timeAgo,
    timestamp: incident.timestamp,
  }))
}

export function AITriageTab({ preloadedChargerId }: AITriageTabProps) {
  const { chargers, incidents, fleetStats, isLoading: isDashboardLoading } = useDashboardData()
  const preloaded = preloadedChargerId
    ? chargers.find((c) => c.id === preloadedChargerId)
    : null

  const openingMessage: ChatMessage = useMemo(
    () => ({
      id: "opening",
      role: "assistant",
      content: preloaded
        ? `Hello Kaushik. I see you're looking at **${preloaded.name}** (${preloaded.code}). This charger is currently **${preloaded.status}** with a risk score of ${preloaded.riskScore.toFixed(1)}. ${
            preloaded.status === "critical"
              ? "This requires immediate attention."
              : preloaded.status === "warning"
                ? "I'm monitoring this unit closely."
                : "It's operating within normal parameters."
          } How can I help?`
        : `Hello Kaushik. I'm monitoring **${fleetStats.totalChargers} chargers** across **${fleetStats.totalLocations} locations**. There are currently **${fleetStats.warning} warnings** and **${fleetStats.critical} critical alerts**. How can I help you today?`,
      mentionedChargers: preloaded ? [preloaded.id] : [],
    }),
    [preloaded, fleetStats.totalChargers, fleetStats.totalLocations, fleetStats.warning, fleetStats.critical]
  )

  const [messages, setMessages] = useState<ChatMessage[]>([openingMessage])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [recentActions] = useState([
    { action: "Flagged top-risk chargers for triage review", time: "Live" },
    { action: "Monitoring prediction score changes", time: "Live" },
    { action: "Using live telemetry + predictions context", time: "Live" },
  ])

  const suggestedPrompts = [
    "Which chargers need immediate attention?",
    "Summarize today's incidents",
    "Which chargers have the fastest rising risk?",
    "What should I prioritize in Sacramento-Downtown?",
  ]

  const contextChargerIds = [
    ...new Set(messages.flatMap((m) => m.mentionedChargers ?? [])),
  ]
  const contextChargers = contextChargerIds
    .map((id) => chargers.find((c) => c.id === id))
    .filter(Boolean) as Charger[]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.id !== "opening") return prev
      return [openingMessage]
    })
  }, [openingMessage])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping || isSubmitting) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      mentionedChargers: extractMentionedChargerIds(trimmed, chargers),
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput("")
    setIsTyping(true)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/ai-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          chargers: compactChargersForAI(chargers),
          incidents: compactIncidentsForAI(incidents),
          fleetStats,
          preloadedChargerId,
        }),
      })

      const data = (await response.json()) as AITriageResponse
      if (!response.ok || !data.content) {
        throw new Error(data.error || `AI triage request failed (${response.status})`)
      }

      const mentionedChargerIds = Array.isArray(data.mentionedChargerIds)
        ? data.mentionedChargerIds
        : extractMentionedChargerIds(data.content, chargers)

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.content,
        mentionedChargers: mentionedChargerIds,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown AI triage error"
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          `I couldn't reach the AI triage service right now. ${errorMessage}\n\n` +
          `I can still help with visible live data: there are currently ${fleetStats.warning} warning and ${fleetStats.critical} critical chargers.`,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } finally {
      setIsTyping(false)
      setIsSubmitting(false)
    }
  }

  const renderContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })
  }

  return (
    <div className="flex gap-6" style={{ height: "calc(100vh - 80px)" }}>
      <div className="flex flex-[3] flex-col rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                AI Triage Assistant
              </h2>
              <p className="text-xs text-muted-foreground">
                Powered by Azure GPT-5 with live telemetry + predictions context
              </p>
            </div>
            {isDashboardLoading && (
              <div className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3.5" />
                Syncing live data
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              style={{ animation: "fade-up 0.3s ease-out" }}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary/10 text-foreground"
                    : "bg-secondary text-foreground/90"
                }`}
              >
                <div className="whitespace-pre-line">{renderContent(msg.content)}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="mb-4 flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl bg-secondary px-4 py-3">
                <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "0.2s" }} />
                <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-6 pb-3">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void sendMessage(prompt)}
                className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {`\"${prompt}\"`}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void sendMessage(input)
            }}
            className="flex items-center gap-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about live chargers, incidents, or risk trends..."
              className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping || isSubmitting}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              aria-label="Send message"
            >
              {isSubmitting ? <Spinner className="size-4" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>

      <div className="flex w-[340px] flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Live Context</h3>

        {contextChargers.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs text-muted-foreground">Chargers in Discussion</h4>
            {contextChargers.slice(0, 5).map((charger) => (
              <ContextChargerCard key={charger.id} charger={charger} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Charger context will appear here</p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-secondary p-3">
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">Fleet Snapshot</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-card px-2 py-1 text-muted-foreground">Total: <span className="font-mono text-foreground">{fleetStats.totalChargers}</span></div>
            <div className="rounded-md bg-card px-2 py-1 text-muted-foreground">Health: <span className="font-mono text-foreground">{fleetStats.healthScore.toFixed(1)}%</span></div>
            <div className="rounded-md bg-card px-2 py-1 text-muted-foreground">Warn: <span className="font-mono text-[#f5a623]">{fleetStats.warning}</span></div>
            <div className="rounded-md bg-card px-2 py-1 text-muted-foreground">Critical: <span className="font-mono text-[#ff4d4d]">{fleetStats.critical}</span></div>
          </div>
        </div>

        <div className="mt-2">
          <h4 className="mb-3 text-xs font-medium text-muted-foreground">Recent AI Context Notes</h4>
          <div className="flex flex-col gap-2">
            {recentActions.map((action, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-secondary p-2.5">
                <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-foreground">{action.action}</p>
                  <p className="text-[10px] text-muted-foreground">{action.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
