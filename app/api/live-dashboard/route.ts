import { NextResponse } from "next/server"
import type { Charger, ChargerStatus, Incident } from "@/lib/charger-data"

export const dynamic = "force-dynamic"

type FleetStats = {
  totalChargers: number
  healthy: number
  warning: number
  critical: number
  totalLocations: number
  healthScore: number
  totalEnergyToday: number
}

type DashboardApiResponse = {
  chargers: Charger[]
  incidents: Incident[]
  fleetStats: FleetStats
  generatedAt: string
  source: "supabase" | "fallback"
  latestTimestamp: string | null
}

type TelemetryRow = {
  charger_id: string | number | null
  latitude: number | string | null
  longitude: number | string | null
  area: string | null
  voltage_v: number | string | null
  current_a: number | string | null
  temperature_c: number | string | null
  ambient_temp_c: number | string | null
  session_duration_min: number | string | null
  error_count: number | string | null
  risk_score: number | string | null
  health_status: string | null
  soc: number | string | null
  battery_temp_c: number | string | null
  charging_duration_min: number | string | null
  efficiency: number | string | null
  timestamp: string | null
}

type PredictionRow = {
  charger_id: string | number | null
  as_of_timestamp: string | null
  failure_prone: boolean | null
  normalized_risk_pct_100: number | string | null
  failure_risk_prob_norm: number | string | null
  failure_risk_prob_raw: number | string | null
  predicted_failure_pattern: string | null
  pattern_confidence: number | string | null
  risk_trend: string | null
  composite_risk: number | string | null
  updated_at: string | null
}

const TELEMETRY_SELECT = [
  "charger_id",
  "latitude",
  "longitude",
  "area",
  "voltage_v",
  "current_a",
  "temperature_c",
  "ambient_temp_c",
  "session_duration_min",
  "error_count",
  "risk_score",
  "health_status",
  "soc",
  "battery_temp_c",
  "charging_duration_min",
  "efficiency",
  "timestamp",
].join(",")

const PREDICTION_SELECT = [
  "charger_id",
  "as_of_timestamp",
  "failure_prone",
  "normalized_risk_pct_100",
  "failure_risk_prob_norm",
  "failure_risk_prob_raw",
  "predicted_failure_pattern",
  "pattern_confidence",
  "risk_trend",
  "composite_risk",
  "updated_at",
].join(",")

const STATUS_COLOR_THRESHOLDS = {
  warning: 50,
  critical: 75,
} as const

const AREA_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  "folsom": { lat: 38.677959, lng: -121.176058 },
  "sacramento-downtown": { lat: 38.581572, lng: -121.4944 },
  "sacramento downtown": { lat: 38.581572, lng: -121.4944 },
  "davis": { lat: 38.544907, lng: -121.740517 },
  "roseville": { lat: 38.752123, lng: -121.288006 },
  "west-sacramento": { lat: 38.58046, lng: -121.530235 },
  "west sacramento": { lat: 38.58046, lng: -121.530235 },
  "elk-grove": { lat: 38.408799, lng: -121.371618 },
  "elk grove": { lat: 38.408799, lng: -121.371618 },
  "unassigned": { lat: 38.581572, lng: -121.4944 },
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash >>> 0
}

function jitterFromSeed(seed: number): number {
  return ((seed % 10000) / 10000) * 2 - 1
}

function resolveCoordinates(
  latitudeRaw: unknown,
  longitudeRaw: unknown,
  areaRaw: string | null | undefined,
  chargerKey: string
): { lat: number; lng: number } {
  const lat = toNumber(latitudeRaw)
  const lng = toNumber(longitudeRaw)

  if (
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  ) {
    return { lat, lng }
  }

  const areaKey = (areaRaw ?? "unassigned").trim().toLowerCase()
  const base = AREA_FALLBACK_COORDS[areaKey] ?? AREA_FALLBACK_COORDS["unassigned"]
  const hash = hashString(`${chargerKey}:${areaKey}`)

  // Small deterministic jitter so stacked fallback markers remain visible.
  const latJitter = jitterFromSeed(hash) * 0.01
  const lngJitter = jitterFromSeed(hash >>> 8) * 0.01

  return {
    lat: round(base.lat + latJitter, 6),
    lng: round(base.lng + lngJitter, 6),
  }
}

function normalizeStatus(raw: string | null | undefined, riskScore: number): ChargerStatus {
  const value = (raw ?? "").trim().toLowerCase()
  if (["critical", "crit", "failed", "failure"].includes(value)) return "critical"
  if (["warning", "warn", "at_risk", "at risk", "degraded", "attention"].includes(value)) return "warning"

  if (riskScore >= STATUS_COLOR_THRESHOLDS.critical) return "critical"
  if (riskScore >= STATUS_COLOR_THRESHOLDS.warning) return "warning"
  if (["healthy", "normal", "ok", "good"].includes(value)) return "healthy"
  return "healthy"
}

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return "unknown"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "unknown"
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.max(0, Math.round(diffMs / 60000))
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`
}

function formatClockTime(iso: string | null | undefined): string {
  if (!iso) return "--:--"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "--:--"
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function deriveDisplayIds(rawChargerId: string): { id: string; name: string; code: string } {
  const match = rawChargerId.match(/(\d+)/)
  if (match) {
    const num = Number(match[1])
    if (Number.isFinite(num)) {
      return {
        id: `charger-${num}`,
        name: `Charger ${num}`,
        code: `CHG-${String(num).padStart(3, "0")}`,
      }
    }
  }

  const safe = rawChargerId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return {
    id: safe ? `charger-${safe}` : "charger-unknown",
    name: rawChargerId || "Charger",
    code: (rawChargerId || "UNK").toUpperCase(),
  }
}

function buildHistory(values: Array<number | null>, fallback: number, size: number, digits: number): number[] {
  const cleaned = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  let history = cleaned.slice(0, size).reverse()
  if (history.length === 0) {
    history = Array.from({ length: Math.min(size, 7) }, () => fallback)
  }
  while (history.length < Math.min(size, 6)) {
    history.unshift(history[0] ?? fallback)
  }
  return history.map((v) => round(v, digits))
}

function computeRiskScore(latestTelemetry: TelemetryRow | undefined, latestPrediction: PredictionRow | undefined): number {
  const normalized = toNumber(latestPrediction?.normalized_risk_pct_100)
  if (normalized !== null) return clamp(normalized, 0, 100)

  const composite = toNumber(latestPrediction?.composite_risk)
  if (composite !== null) {
    return clamp(composite <= 1 ? composite * 100 : composite, 0, 100)
  }

  const predProb = toNumber(latestPrediction?.failure_risk_prob_norm)
  if (predProb !== null) {
    return clamp(predProb <= 1 ? predProb * 100 : predProb, 0, 100)
  }

  const telemetryRisk = toNumber(latestTelemetry?.risk_score)
  if (telemetryRisk !== null) {
    return clamp(telemetryRisk <= 1 ? telemetryRisk * 100 : telemetryRisk, 0, 100)
  }

  return 0
}

function inferUptime(latestTelemetry: TelemetryRow | undefined, status: ChargerStatus): number {
  const efficiency = toNumber(latestTelemetry?.efficiency)
  if (efficiency !== null) {
    const pct = efficiency <= 1.5 ? efficiency * 100 : efficiency
    return round(clamp(pct, 40, 100), 1)
  }

  const errorCount = toNumber(latestTelemetry?.error_count) ?? 0
  const basePenalty = status === "critical" ? 28 : status === "warning" ? 12 : 2
  return round(clamp(100 - basePenalty - errorCount * 3, 40, 99.9), 1)
}

function inferEnergyDelivered(latestTelemetry: TelemetryRow | undefined): number {
  const voltage = toNumber(latestTelemetry?.voltage_v) ?? 0
  const current = toNumber(latestTelemetry?.current_a) ?? 0
  const durationMin =
    toNumber(latestTelemetry?.charging_duration_min) ??
    toNumber(latestTelemetry?.session_duration_min) ??
    0
  const kWh = (voltage * current * durationMin) / 60000
  return round(Math.max(kWh, 0), 1)
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return {
    apikey: key ?? "",
    Authorization: `Bearer ${key ?? ""}`,
    Accept: "application/json",
  }
}

async function fetchSupabaseRows<T>(table: string, select: string, orderColumn: string, limit: number): Promise<T[]> {
  const baseUrl = process.env.SUPABASE_URL
  const params = new URLSearchParams({
    select,
    order: `${orderColumn}.desc`,
    limit: String(limit),
  })

  const response = await fetch(`${baseUrl}/rest/v1/${table}?${params.toString()}`, {
    headers: supabaseHeaders(),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Supabase ${table} request failed (${response.status}): ${body}`)
  }

  return (await response.json()) as T[]
}

function groupByChargerId<T extends { charger_id: string | number | null }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    if (row.charger_id === null || row.charger_id === undefined) continue
    const key = String(row.charger_id)
    const bucket = grouped.get(key)
    if (bucket) bucket.push(row)
    else grouped.set(key, [row])
  }
  return grouped
}

function deriveIncident(charger: Charger, latestTelemetry: TelemetryRow | undefined, latestPrediction: PredictionRow | undefined): Incident | null {
  if (charger.status === "healthy") return null

  const temperature = charger.temperature
  const voltage = charger.voltage
  const risk = charger.riskScore
  const failurePattern = latestPrediction?.predicted_failure_pattern || "anomaly"

  let metric: Incident["metric"] = "risk"
  let threshold = charger.status === "critical" ? 75 : 50
  let currentValue = risk
  let title = charger.status === "critical" ? "Critical risk threshold exceeded" : "Elevated risk detected"
  let description = `Risk score at ${risk.toFixed(1)} (threshold: ${threshold})`
  let detailedDescription = `${charger.name} is currently reporting a ${charger.status} health state with a live composite risk score of ${risk.toFixed(1)}. Predictive signals indicate ${failurePattern}.`

  if (temperature >= 45 || (charger.status !== "healthy" && temperature >= 40)) {
    metric = "temperature"
    threshold = charger.status === "critical" ? 45 : 40
    currentValue = temperature
    title = charger.status === "critical" ? "Overheating detected" : "Elevated temperature"
    description = `Temperature at ${temperature.toFixed(1)}C (threshold: ${threshold}C)`
    detailedDescription = `${charger.name} temperature is ${temperature.toFixed(1)}C, which is ${charger.status === "critical" ? "above" : "approaching"} the configured threshold of ${threshold}C. ${failurePattern ? `Predicted pattern: ${failurePattern}.` : ""}`.trim()
  } else {
    const isLowVoltageDomain = voltage > 0 && voltage < 20
    const criticalVoltageThreshold = isLowVoltageDomain ? 3.65 : 230
    const warningVoltageThreshold = isLowVoltageDomain ? 3.75 : 235
    const isVoltageIncident =
      voltage > 0 &&
      (voltage <= criticalVoltageThreshold ||
        (charger.status !== "healthy" && voltage <= warningVoltageThreshold))

    if (isVoltageIncident) {
      metric = "voltage"
      threshold = charger.status === "critical" ? criticalVoltageThreshold : warningVoltageThreshold
      currentValue = voltage
      title = charger.status === "critical" ? "Voltage drop detected" : "Voltage fluctuation warning"
      description = `Voltage at ${voltage.toFixed(isLowVoltageDomain ? 2 : 1)}V (threshold: ${threshold}V)`
      detailedDescription = `${charger.name} is reporting ${voltage.toFixed(isLowVoltageDomain ? 2 : 1)}V. This is ${charger.status === "critical" ? "below" : "near"} the operating threshold (${threshold}V), and may indicate power instability.`
    }
  }

  const timestamp = latestTelemetry?.timestamp ?? latestPrediction?.as_of_timestamp ?? latestPrediction?.updated_at ?? new Date().toISOString()

  return {
    id: `${charger.id}-${metric}`,
    chargerId: charger.id,
    chargerName: charger.name,
    chargerCode: charger.code,
    location: charger.location,
    severity: charger.status === "critical" ? "critical" : "warning",
    status: "active",
    title,
    description,
    detailedDescription,
    metric,
    threshold,
    currentValue: round(currentValue, metric === "temperature" ? 1 : 2),
    timeAgo: formatTimeAgo(timestamp),
    timestamp,
    timeline: [
      { event: "Live telemetry ingested", time: formatClockTime(timestamp) },
      { event: `Status classified as ${charger.status}`, time: formatClockTime(timestamp) },
      { event: `Pattern scored: ${failurePattern || "anomaly"}`, time: formatClockTime(latestPrediction?.as_of_timestamp ?? latestPrediction?.updated_at ?? timestamp) },
    ],
    aiRecommendation:
      charger.status === "critical"
        ? `Prioritize immediate inspection for ${charger.name}. Live telemetry and prediction signals indicate elevated failure probability. Confirm power, cooling, and connector integrity before returning to service.`
        : `Schedule a preventive maintenance check for ${charger.name}. Continue monitoring live telemetry and prediction trend for escalation over the next 24 hours.`,
  }
}

function buildDashboardData(telemetryRows: TelemetryRow[], predictionRows: PredictionRow[]): DashboardApiResponse {
  const telemetryByCharger = groupByChargerId(telemetryRows)
  const predictionsByCharger = groupByChargerId(predictionRows)
  const chargerIds = new Set<string>([
    ...telemetryByCharger.keys(),
    ...predictionsByCharger.keys(),
  ])

  const chargers: Charger[] = []
  const incidents: Incident[] = []
  let latestTimestamp: string | null = null
  let totalEnergyKwh = 0

  for (const rawChargerId of chargerIds) {
    const telemetryHistory = telemetryByCharger.get(rawChargerId) ?? []
    const predictionHistory = predictionsByCharger.get(rawChargerId) ?? []
    const latestTelemetry = telemetryHistory[0]
    const latestPrediction = predictionHistory[0]

    const { id, name, code } = deriveDisplayIds(rawChargerId)

    const riskScore = round(computeRiskScore(latestTelemetry, latestPrediction), 2)
    const status = normalizeStatus(latestTelemetry?.health_status, riskScore)

    const coords = resolveCoordinates(
      latestTelemetry?.latitude,
      latestTelemetry?.longitude,
      latestTelemetry?.area,
      rawChargerId
    )
    const lat = coords.lat
    const lng = coords.lng
    const voltage = round(
      toNumber(latestTelemetry?.voltage_v) ?? 0,
      2
    )
    const temperature = round(
      toNumber(latestTelemetry?.temperature_c) ??
        toNumber(latestTelemetry?.battery_temp_c) ??
        toNumber(latestTelemetry?.ambient_temp_c) ??
        0,
      1
    )
    const uptime = inferUptime(latestTelemetry, status)
    const energyDelivered = inferEnergyDelivered(latestTelemetry)
    totalEnergyKwh += energyDelivered

    const telemetryTimestamps = telemetryHistory
      .map((row) => row.timestamp)
      .filter((ts): ts is string => Boolean(ts))
    const newestTs = telemetryTimestamps[0] ?? latestPrediction?.as_of_timestamp ?? latestPrediction?.updated_at ?? null
    if (newestTs && (!latestTimestamp || new Date(newestTs).getTime() > new Date(latestTimestamp).getTime())) {
      latestTimestamp = newestTs
    }

    const riskHistoryValues = predictionHistory.map((row) => {
      const normalized = toNumber(row.normalized_risk_pct_100)
      if (normalized !== null) return normalized
      const composite = toNumber(row.composite_risk)
      if (composite !== null) return composite <= 1 ? composite * 100 : composite
      const prob = toNumber(row.failure_risk_prob_norm)
      if (prob !== null) return prob <= 1 ? prob * 100 : prob
      return null
    })

    const fallbackRiskFromTelemetry = telemetryHistory.map((row) => {
      const tRisk = toNumber(row.risk_score)
      if (tRisk === null) return null
      return tRisk <= 1 ? tRisk * 100 : tRisk
    })

    const riskHistory = buildHistory(
      [...riskHistoryValues, ...fallbackRiskFromTelemetry],
      riskScore,
      7,
      2
    )

    const voltageHistory = buildHistory(
      telemetryHistory.map((row) => toNumber(row.voltage_v)),
      voltage,
      24,
      2
    )

    const tempHistory = buildHistory(
      telemetryHistory.map((row) =>
        toNumber(row.temperature_c) ?? toNumber(row.battery_temp_c) ?? toNumber(row.ambient_temp_c)
      ),
      temperature,
      24,
      1
    )

    const location = latestTelemetry?.area?.trim() || "Unknown location"
    const lastUpdatedIso = latestTelemetry?.timestamp ?? latestPrediction?.as_of_timestamp ?? latestPrediction?.updated_at ?? null

    const charger: Charger = {
      id,
      name,
      code,
      location,
      lat,
      lng,
      status,
      riskScore,
      riskHistory,
      temperature,
      voltage,
      uptime,
      energyDelivered,
      lastUpdated: formatTimeAgo(lastUpdatedIso),
      voltageHistory,
      tempHistory,
    }

    chargers.push(charger)

    const incident = deriveIncident(charger, latestTelemetry, latestPrediction)
    if (incident) incidents.push(incident)
  }

  chargers.sort((a, b) => b.riskScore - a.riskScore || a.name.localeCompare(b.name))
  incidents.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1
    return b.currentValue - a.currentValue
  })

  const healthy = chargers.filter((c) => c.status === "healthy").length
  const warning = chargers.filter((c) => c.status === "warning").length
  const critical = chargers.filter((c) => c.status === "critical").length
  const totalChargers = chargers.length
  const totalLocations = new Set(chargers.map((c) => c.location)).size
  const avgRisk = totalChargers
    ? chargers.reduce((sum, c) => sum + c.riskScore, 0) / totalChargers
    : 0

  const fleetStats: FleetStats = {
    totalChargers,
    healthy,
    warning,
    critical,
    totalLocations,
    healthScore: round(clamp(100 - avgRisk, 0, 100), 1),
    totalEnergyToday: round(totalEnergyKwh / 1000, 3),
  }

  return {
    chargers,
    incidents,
    fleetStats,
    generatedAt: new Date().toISOString(),
    source: "supabase",
    latestTimestamp,
  }
}

export async function GET() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    )
  }

  try {
    const [telemetryRows, predictionRows] = await Promise.all([
      fetchSupabaseRows<TelemetryRow>("telemetry_live", TELEMETRY_SELECT, "timestamp", 5000),
      fetchSupabaseRows<PredictionRow>("charger_predictions_live", PREDICTION_SELECT, "as_of_timestamp", 3000),
    ])

    const payload = buildDashboardData(telemetryRows, predictionRows)
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown live data error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
