"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Send, Bot, Zap, Clock } from "lucide-react"
import { getStatusColor, getStatusBg, type Charger } from "@/lib/charger-data"
import { useDashboardData } from "@/components/live-dashboard-provider"

interface AITriageTabProps {
  preloadedChargerId: string | null
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  mentionedChargers?: string[]
}

const aiResponses: Record<string, { content: string; chargers: string[] }> = {
  "Which chargers need immediate attention?": {
    content: `Based on my real-time analysis, **3 chargers require immediate attention**:\n\n- **Charger 25** (CHG-025) — Critical voltage drop at 218V, well below the 230V threshold. Risk score: 82.4. Located at Lot F - Financial District.\n\n- **Charger 26** (CHG-026) — Overheating at 52.3C, exceeding the 45C limit. Risk score: 78.9. Located at Lot G - SoHo.\n\n- **Charger 27** (CHG-027) — Experienced complete power failure earlier today. Now resolved but recommend follow-up inspection.\n\nI recommend prioritizing Charger 25 first — the voltage degradation pattern suggests imminent failure within 2 hours.`,
    chargers: ["charger-25", "charger-26", "charger-27"],
  },
  "What caused the Charger 9 anomaly?": {
    content: `Analyzing historical data for **Charger 9** (CHG-009)...\n\nThe anomaly detected at 06:23 AM was caused by a **momentary grid voltage fluctuation** in the Lot B - Midtown area. Key findings:\n\n- Voltage dipped to 226V for approximately 45 seconds\n- Temperature spiked briefly to 41.2C during the event\n- The charger's built-in protection circuit activated correctly\n- Normal operations resumed within 2 minutes\n\nThis appears to be an **external grid issue** rather than a charger hardware problem. The same voltage dip was registered by Chargers 8 and 10 in the same location, confirming it was area-wide.\n\nNo further action needed, but I've added this location to enhanced monitoring for the next 48 hours.`,
    chargers: ["charger-9", "charger-8", "charger-10"],
  },
  "Predict failures in the next 24 hours": {
    content: `Running predictive analysis across all 27 chargers...\n\n**High probability of failure (>70%):**\n- **Charger 25** — Voltage decline trajectory suggests failure in **1.8 hours** if uncorrected\n- **Charger 26** — Thermal runaway risk, projected to hit safety shutdown at **52C in 45 minutes**\n\n**Moderate risk (30-70%):**\n- **Charger 20** — Voltage fluctuation pattern matches pre-failure signatures seen in similar units. Estimated 40% chance of failure within 24 hours.\n- **Charger 21** — Temperature trending upward. 35% chance of exceeding critical threshold within 18 hours.\n\n**Low risk but watch:**\n- **Charger 22** — Uptime degradation indicates possible network module issue. May go offline intermittently.\n\nRecommendation: Schedule maintenance for Chargers 25 and 26 immediately. Place Chargers 20-22 on the priority inspection queue for tomorrow.`,
    chargers: ["charger-25", "charger-26", "charger-20", "charger-21", "charger-22"],
  },
  "Summarize today's incidents": {
    content: `**Incident Summary — Saturday, February 21, 2026:**\n\nTotal incidents today: **6** (3 critical, 3 warning)\n\n**Critical:**\n1. Charger 25 — Voltage drop to 218V (active, 14 min ago)\n2. Charger 26 — Temperature spike to 52.3C (active, 8 min ago)\n3. Charger 27 — Complete power failure (resolved at 07:45 AM)\n\n**Warning:**\n4. Charger 20 — Voltage fluctuation 228-234V (active, 23 min ago)\n5. Charger 21 — Elevated temperature 42.8C (active, 35 min ago)\n6. Charger 22 — Uptime dropped to 87.2% (active, 1 hr ago)\n\n**Key metrics:**\n- Average response time: 3.2 minutes\n- 1 incident auto-resolved\n- 5 incidents require operator action\n- Fleet health score: 73.4% (Mostly Healthy)\n\nOverall, the fleet is operating within acceptable parameters, but the two active critical incidents on Chargers 25 and 26 should be addressed urgently.`,
    chargers: ["charger-25", "charger-26", "charger-27", "charger-20", "charger-21", "charger-22"],
  },
}

const defaultResponse = {
  content: `I've analyzed the fleet data and here's what I can tell you:\n\n**Current Fleet Status:**\n- 19 chargers operating normally (healthy)\n- 5 chargers showing early warning signs\n- 3 chargers in critical condition\n\nThe overall health score is 73.4%, which is in the "Mostly Healthy" range. The primary concerns right now are Charger 25 (voltage) and Charger 26 (temperature).\n\nIs there anything specific you'd like me to investigate further?`,
  chargers: ["charger-25", "charger-26"],
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

export function AITriageTab({ preloadedChargerId }: AITriageTabProps) {
  const { chargers, fleetStats } = useDashboardData()
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [recentActions] = useState([
    { action: "Flagged Charger 25 as high priority", time: "2 min ago" },
    { action: "Updated risk model for Lot F chargers", time: "15 min ago" },
    { action: "Auto-resolved Charger 27 incident", time: "2.5 hrs ago" },
  ])

  const suggestedPrompts = [
    "Which chargers need immediate attention?",
    "What caused the Charger 9 anomaly?",
    "Predict failures in the next 24 hours",
    "Summarize today's incidents",
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

  const sendMessage = (text: string) => {
    if (!text.trim()) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    const response = aiResponses[text] ?? defaultResponse

    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.content,
        mentionedChargers: response.chargers,
      }
      setMessages((prev) => [...prev, assistantMsg])
      setIsTyping(false)
    }, 1200 + Math.random() * 800)
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
      {/* Left - Chat */}
      <div className="flex flex-[3] flex-col rounded-2xl border border-border bg-card">
        {/* Chat Header */}
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
                Powered by Ampera Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-4 flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
              style={{ animation: "fade-up 0.3s ease-out" }}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary/10 text-foreground"
                    : "bg-secondary text-foreground/90"
                }`}
              >
                <div className="whitespace-pre-line">
                  {renderContent(msg.content)}
                </div>
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

        {/* Suggested Prompts */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-6 pb-3">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {`"${prompt}"`}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage(input)
            }}
            className="flex items-center gap-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your fleet..."
              className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Right - Context Panel */}
      <div className="flex w-[340px] flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Live Context</h3>

        {contextChargers.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs text-muted-foreground">
              Chargers in Discussion
            </h4>
            {contextChargers.slice(0, 5).map((charger) => (
              <ContextChargerCard key={charger.id} charger={charger} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Charger context will appear here
            </p>
          </div>
        )}

        {/* Recent Actions */}
        <div className="mt-4">
          <h4 className="mb-3 text-xs font-medium text-muted-foreground">
            Recent AI Actions
          </h4>
          <div className="flex flex-col gap-2">
            {recentActions.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-secondary p-2.5"
              >
                <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-foreground">{action.action}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {action.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
