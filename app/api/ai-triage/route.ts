import { NextResponse } from "next/server"
import type { Charger, Incident } from "@/lib/charger-data"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

type FleetStats = {
  totalChargers: number
  healthy: number
  warning: number
  critical: number
  totalLocations: number
  healthScore: number
  totalEnergyToday: number
}

type TriageMessage = {
  role: "user" | "assistant" | "system"
  content: string
}

type TriageRequestBody = {
  messages?: TriageMessage[]
  chargers?: Charger[]
  incidents?: Incident[]
  fleetStats?: FleetStats
  preloadedChargerId?: string | null
}

function extractChargerMentions(text: string): string[] {
  const ids = new Set<string>()
  const regex = /charger\s*(\d{1,4})/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    ids.add(`charger-${Number(match[1])}`)
  }
  return [...ids]
}

function sanitizeMessages(messages: TriageMessage[] | undefined): TriageMessage[] {
  if (!Array.isArray(messages)) return []
  return messages
    .filter(
      (msg): msg is TriageMessage =>
        Boolean(msg) &&
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string" &&
        msg.content.trim().length > 0
    )
    .slice(-12)
    .map((msg) => ({ role: msg.role, content: msg.content.slice(0, 6000) }))
}

function buildContextSnapshot(params: {
  chargers: Charger[]
  incidents: Incident[]
  fleetStats: FleetStats | undefined
  preloadedChargerId: string | null | undefined
  latestUserPrompt: string
  compact?: boolean
}) {
  const { chargers, incidents, fleetStats, preloadedChargerId, latestUserPrompt, compact = false } = params

  const safeChargers = Array.isArray(chargers) ? chargers : []
  const safeIncidents = Array.isArray(incidents) ? incidents : []

  const mentionedIds = new Set<string>([
    ...(preloadedChargerId ? [preloadedChargerId] : []),
    ...extractChargerMentions(latestUserPrompt),
  ])

  const selectedCharger = preloadedChargerId
    ? safeChargers.find((charger) => charger.id === preloadedChargerId) ?? null
    : null

  const topRiskChargers = [...safeChargers]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, compact ? 8 : 15)
    .map((charger) => ({
      id: charger.id,
      name: charger.name,
      code: charger.code,
      location: charger.location,
      status: charger.status,
      riskScore: charger.riskScore,
      temperature: charger.temperature,
      voltage: charger.voltage,
      uptime: charger.uptime,
      lastUpdated: charger.lastUpdated,
      ...(compact
        ? {}
        : {
            riskHistory: charger.riskHistory.slice(-7),
            voltageHistory: charger.voltageHistory.slice(-10),
            tempHistory: charger.tempHistory.slice(-10),
          }),
    }))

  const allChargersSummary = safeChargers.slice(0, compact ? 60 : safeChargers.length).map((charger) => ({
    id: charger.id,
    name: charger.name,
    code: charger.code,
    location: charger.location,
    status: charger.status,
    riskScore: charger.riskScore,
    temperature: charger.temperature,
    voltage: charger.voltage,
    uptime: charger.uptime,
    lastUpdated: charger.lastUpdated,
  }))

  const mentionedChargers = safeChargers
    .filter((charger) => mentionedIds.has(charger.id))
    .map((charger) => ({
      id: charger.id,
      name: charger.name,
      code: charger.code,
      location: charger.location,
      status: charger.status,
      riskScore: charger.riskScore,
      temperature: charger.temperature,
      voltage: charger.voltage,
      uptime: charger.uptime,
      riskHistory: charger.riskHistory.slice(-7),
      voltageHistory: charger.voltageHistory.slice(-10),
      tempHistory: charger.tempHistory.slice(-10),
    }))

  const activeIncidents = safeIncidents
    .filter((incident) => incident.status !== "resolved")
    .slice(0, compact ? 20 : 30)
    .map((incident) => ({
      id: incident.id,
      chargerId: incident.chargerId,
      chargerName: incident.chargerName,
      chargerCode: incident.chargerCode,
      severity: incident.severity,
      status: incident.status,
      title: incident.title,
      description: incident.description,
      metric: incident.metric,
      threshold: incident.threshold,
      currentValue: incident.currentValue,
      timeAgo: incident.timeAgo,
      location: incident.location,
    }))

  return {
    generatedAt: new Date().toISOString(),
    fleetStats: fleetStats ?? null,
    selectedCharger:
      selectedCharger && {
        id: selectedCharger.id,
        name: selectedCharger.name,
        code: selectedCharger.code,
        location: selectedCharger.location,
        status: selectedCharger.status,
        riskScore: selectedCharger.riskScore,
        temperature: selectedCharger.temperature,
        voltage: selectedCharger.voltage,
        uptime: selectedCharger.uptime,
        riskHistory: selectedCharger.riskHistory.slice(-7),
        voltageHistory: selectedCharger.voltageHistory.slice(-12),
        tempHistory: selectedCharger.tempHistory.slice(-12),
      },
    mentionedChargers,
    topRiskChargers,
    activeIncidents,
    allChargersSummary,
  }
}

function coerceAzureContent(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text
          return typeof text === "string" ? text : ""
        }
        if (part && typeof part === "object" && "content" in part) {
          return coerceAzureContent((part as { content?: unknown }).content)
        }
        return ""
      })
      .join("")
      .trim()
  }
  if (content && typeof content === "object") {
    if ("text" in content) {
      return coerceAzureContent((content as { text?: unknown }).text)
    }
    if ("content" in content) {
      return coerceAzureContent((content as { content?: unknown }).content)
    }
    if ("value" in content) {
      return coerceAzureContent((content as { value?: unknown }).value)
    }
  }
  return ""
}

function extractAzureResponseContent(data: any): string {
  const direct = coerceAzureContent(data?.choices?.[0]?.message?.content)
  if (direct) return direct

  const refusal = coerceAzureContent(data?.choices?.[0]?.message?.refusal)
  if (refusal) return refusal

  const outputText = coerceAzureContent(data?.output_text)
  if (outputText) return outputText

  const output = coerceAzureContent(data?.output)
  if (output) return output

  if (Array.isArray(data?.choices)) {
    for (const choice of data.choices) {
      const alt = coerceAzureContent(choice?.message?.content)
      if (alt) return alt
      const altRefusal = coerceAzureContent(choice?.message?.refusal)
      if (altRefusal) return altRefusal
    }
  }

  return ""
}

async function callAzureChatCompletion(params: {
  url: string
  apiKey: string
  messages: TriageMessage[]
  maxCompletionTokens: number
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": params.apiKey,
      },
      body: JSON.stringify({
        messages: params.messages,
        max_completion_tokens: params.maxCompletionTokens,
        model: process.env.AZURE_OPENAI_MODEL ?? "gpt-5",
      }),
      signal: controller.signal,
    })

    const data = (await response.json()) as any
    if (!response.ok) {
      const detail =
        typeof data?.error?.message === "string"
          ? data.error.message
          : JSON.stringify(data)
      throw new Error(`Azure OpenAI request failed (${response.status}): ${detail}`)
    }

    return {
      data,
      content: extractAzureResponseContent(data),
      finishReason: data?.choices?.[0]?.finish_reason ?? null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: Request) {
  const azureUrl = process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY

  if (!azureUrl || !azureApiKey) {
    return NextResponse.json(
      { error: "Missing Azure OpenAI credentials. Set AZURE_OPENAI_CHAT_COMPLETIONS_URL and AZURE_OPENAI_API_KEY." },
      { status: 500 }
    )
  }

  let body: TriageRequestBody
  try {
    body = (await request.json()) as TriageRequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
  }

  const messages = sanitizeMessages(body.messages)
  const latestUserMessage = [...messages].reverse().find((msg) => msg.role === "user")

  if (!latestUserMessage) {
    return NextResponse.json({ error: "At least one user message is required" }, { status: 400 })
  }

  const chargers = Array.isArray(body.chargers) ? body.chargers : []
  const incidents = Array.isArray(body.incidents) ? body.incidents : []
  const context = buildContextSnapshot({
    chargers,
    incidents,
    fleetStats: body.fleetStats,
    preloadedChargerId: body.preloadedChargerId,
    latestUserPrompt: latestUserMessage.content,
  })

  const systemPrompt = [
    "You are Ampera AI Triage, a fleet operations assistant for EV chargers.",
    "Answer ONLY using the provided live context (derived from telemetry and model predictions).",
    "If data is missing, say it is unavailable instead of guessing.",
    "Be concise, operational, and specific.",
    "When discussing chargers, reference charger name/code and risk status when possible.",
    "If the user asks for prioritization, rank chargers by risk and include why.",
    "If the user asks for a summary, include counts and the most actionable items.",
  ].join(" ")

  const azureMessages: TriageMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: `LIVE_CONTEXT_JSON:\n${JSON.stringify(context)}` },
    ...messages,
  ]

  try {
    let result = await callAzureChatCompletion({
      url: azureUrl,
      apiKey: azureApiKey,
      messages: azureMessages,
      maxCompletionTokens: 2400,
    })

    let content = result.content

    if (!content) {
      // Retry once with smaller context if the model consumed completion tokens but emitted no visible text.
      const compactContext = buildContextSnapshot({
        chargers,
        incidents,
        fleetStats: body.fleetStats,
        preloadedChargerId: body.preloadedChargerId,
        latestUserPrompt: latestUserMessage.content,
        compact: true,
      })

      const retryMessages: TriageMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "system", content: `LIVE_CONTEXT_JSON:\n${JSON.stringify(compactContext)}` },
        ...messages,
      ]

      result = await callAzureChatCompletion({
        url: azureUrl,
        apiKey: azureApiKey,
        messages: retryMessages,
        maxCompletionTokens: 3200,
      })
      content = result.content
    }

    if (!content) {
      throw new Error(
        `Azure OpenAI returned an empty response (finish_reason: ${result.finishReason ?? "unknown"})`
      )
    }

    const mentionedIds = new Set<string>([
      ...extractChargerMentions(latestUserMessage.content),
      ...extractChargerMentions(content),
    ])
    const validIds = chargers.map((charger) => charger.id)
    const mentionedChargerIds = [...mentionedIds].filter((id) => validIds.includes(id))

    return NextResponse.json({
      content,
      mentionedChargerIds,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI triage error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
