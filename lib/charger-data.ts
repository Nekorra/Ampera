export type ChargerStatus = "healthy" | "warning" | "critical"

export interface Charger {
  id: string
  name: string
  code: string
  location: string
  lat: number
  lng: number
  status: ChargerStatus
  riskScore: number
  riskHistory: number[]
  temperature: number
  voltage: number
  uptime: number
  energyDelivered: number
  lastUpdated: string
  voltageHistory: number[]
  tempHistory: number[]
}

export interface Incident {
  id: string
  chargerId: string
  chargerName: string
  chargerCode: string
  location: string
  severity: "warning" | "critical"
  status: "active" | "acknowledged" | "resolved"
  title: string
  description: string
  detailedDescription: string
  metric: string
  threshold: number
  currentValue: number
  timeAgo: string
  timestamp: string
  timeline: { event: string; time: string }[]
  aiRecommendation: string
}

const locations = [
  { name: "Lot A - Downtown", lat: 40.7128, lng: -74.006 },
  { name: "Lot B - Midtown", lat: 40.7549, lng: -73.984 },
  { name: "Lot C - Uptown", lat: 40.7831, lng: -73.9712 },
  { name: "Lot D - East Side", lat: 40.7282, lng: -73.9907 },
  { name: "Lot E - West Village", lat: 40.7336, lng: -74.0027 },
  { name: "Lot F - Financial District", lat: 40.7074, lng: -74.0113 },
  { name: "Lot G - SoHo", lat: 40.7233, lng: -73.9985 },
  { name: "Lot H - Chelsea", lat: 40.7465, lng: -74.0014 },
]

// Deterministic PRNG so SSR and client hydration render identical mock values.
let rngState = 0x2f6e2b1
function seededRandom(): number {
  rngState = (1664525 * rngState + 1013904223) >>> 0
  return rngState / 4294967296
}

function generateVoltageHistory(): number[] {
  const base = 235 + seededRandom() * 10
  return Array.from({ length: 24 }, () =>
    Math.round((base + (seededRandom() - 0.5) * 8) * 100) / 100
  )
}

function generateTempHistory(): number[] {
  const base = 30 + seededRandom() * 15
  return Array.from({ length: 24 }, () =>
    Math.round((base + (seededRandom() - 0.5) * 5) * 10) / 10
  )
}

function generateRiskHistory(base: number): number[] {
  return Array.from({ length: 7 }, () =>
    Math.round((base + (seededRandom() - 0.5) * 10) * 100) / 100
  )
}

export const chargers: Charger[] = [
  // 19 Healthy chargers
  ...Array.from({ length: 19 }, (_, i) => {
    const loc = locations[i % locations.length]
    const riskScore = Math.round((5 + seededRandom() * 20) * 100) / 100
    return {
      id: `charger-${i + 1}`,
      name: `Charger ${i + 1}`,
      code: `CHG-${String(i + 1).padStart(3, "0")}`,
      location: loc.name,
      lat: loc.lat + (seededRandom() - 0.5) * 0.01,
      lng: loc.lng + (seededRandom() - 0.5) * 0.01,
      status: "healthy" as ChargerStatus,
      riskScore,
      riskHistory: generateRiskHistory(riskScore),
      temperature: Math.round((28 + seededRandom() * 10) * 10) / 10,
      voltage: Math.round((236 + seededRandom() * 8) * 100) / 100,
      uptime: Math.round((95 + seededRandom() * 5) * 10) / 10,
      energyDelivered: Math.round(seededRandom() * 200 * 10) / 10,
      lastUpdated: "2 min ago",
      voltageHistory: generateVoltageHistory(),
      tempHistory: generateTempHistory(),
    }
  }),
  // 5 Warning chargers
  ...Array.from({ length: 5 }, (_, i) => {
    const idx = 19 + i
    const loc = locations[(idx + 2) % locations.length]
    const riskScore = Math.round((40 + seededRandom() * 25) * 100) / 100
    return {
      id: `charger-${idx + 1}`,
      name: `Charger ${idx + 1}`,
      code: `CHG-${String(idx + 1).padStart(3, "0")}`,
      location: loc.name,
      lat: loc.lat + (seededRandom() - 0.5) * 0.01,
      lng: loc.lng + (seededRandom() - 0.5) * 0.01,
      status: "warning" as ChargerStatus,
      riskScore,
      riskHistory: generateRiskHistory(riskScore),
      temperature: Math.round((38 + seededRandom() * 8) * 10) / 10,
      voltage: Math.round((228 + seededRandom() * 6) * 100) / 100,
      uptime: Math.round((85 + seededRandom() * 8) * 10) / 10,
      energyDelivered: Math.round(seededRandom() * 150 * 10) / 10,
      lastUpdated: "5 min ago",
      voltageHistory: generateVoltageHistory(),
      tempHistory: generateTempHistory(),
    }
  }),
  // 3 Critical chargers
  ...Array.from({ length: 3 }, (_, i) => {
    const idx = 24 + i
    const loc = locations[(idx + 4) % locations.length]
    const riskScore = Math.round((70 + seededRandom() * 25) * 100) / 100
    return {
      id: `charger-${idx + 1}`,
      name: `Charger ${idx + 1}`,
      code: `CHG-${String(idx + 1).padStart(3, "0")}`,
      location: loc.name,
      lat: loc.lat + (seededRandom() - 0.5) * 0.01,
      lng: loc.lng + (seededRandom() - 0.5) * 0.01,
      status: "critical" as ChargerStatus,
      riskScore,
      riskHistory: generateRiskHistory(riskScore),
      temperature: Math.round((45 + seededRandom() * 10) * 10) / 10,
      voltage: Math.round((218 + seededRandom() * 10) * 100) / 100,
      uptime: Math.round((60 + seededRandom() * 20) * 10) / 10,
      energyDelivered: Math.round(seededRandom() * 80 * 10) / 10,
      lastUpdated: "1 min ago",
      voltageHistory: generateVoltageHistory(),
      tempHistory: generateTempHistory(),
    }
  }),
]

export const incidents: Incident[] = [
  {
    id: "inc-1",
    chargerId: "charger-25",
    chargerName: "Charger 25",
    chargerCode: "CHG-025",
    location: "Lot F - Financial District",
    severity: "critical",
    status: "active",
    title: "Critical voltage drop detected",
    description: "Voltage drop detected — 218V (threshold: 230V)",
    detailedDescription:
      "Charger 25 has experienced a significant voltage drop over the past 3 hours, falling from 238V to 218V. This is well below the safe operating threshold of 230V and may indicate a power supply issue or faulty internal component.",
    metric: "voltage",
    threshold: 230,
    currentValue: 218,
    timeAgo: "14 min ago",
    timestamp: "2026-02-21T09:46:00Z",
    timeline: [
      { event: "Voltage anomaly detected", time: "09:32 AM" },
      { event: "Alert flagged as critical", time: "09:35 AM" },
      { event: "Operator Kaushik notified", time: "09:36 AM" },
      { event: "Automated diagnostics initiated", time: "09:38 AM" },
    ],
    aiRecommendation:
      "Based on current trends, voltage is expected to fall below safe threshold within ~2 hours. Immediate inspection recommended. Consider shutting down this charger to prevent hardware damage.",
  },
  {
    id: "inc-2",
    chargerId: "charger-26",
    chargerName: "Charger 26",
    chargerCode: "CHG-026",
    location: "Lot G - SoHo",
    severity: "critical",
    status: "active",
    title: "Overheating detected",
    description: "Temperature spike — 52.3C (threshold: 45C)",
    detailedDescription:
      "Charger 26 temperature has risen sharply from 38C to 52.3C in the last hour. This exceeds the maximum safe operating temperature of 45C and could result in thermal shutdown or component damage.",
    metric: "temperature",
    threshold: 45,
    currentValue: 52.3,
    timeAgo: "8 min ago",
    timestamp: "2026-02-21T09:52:00Z",
    timeline: [
      { event: "Temperature spike detected", time: "09:44 AM" },
      { event: "Alert flagged as critical", time: "09:46 AM" },
      { event: "Operator Kaushik notified", time: "09:47 AM" },
    ],
    aiRecommendation:
      "Temperature is rising at 2.1C per 15 minutes. At this rate, thermal shutdown will trigger within 45 minutes. Recommend immediate power reduction or shutdown. Check ventilation and cooling system.",
  },
  {
    id: "inc-3",
    chargerId: "charger-20",
    chargerName: "Charger 20",
    chargerCode: "CHG-020",
    location: "Lot C - Uptown",
    severity: "warning",
    status: "active",
    title: "Voltage fluctuation detected",
    description: "Voltage instability — fluctuating between 228V-234V",
    detailedDescription:
      "Charger 20 has shown intermittent voltage fluctuations over the past 2 hours, oscillating between 228V and 234V. While still above critical threshold, this pattern often precedes more serious failures.",
    metric: "voltage",
    threshold: 230,
    currentValue: 229,
    timeAgo: "23 min ago",
    timestamp: "2026-02-21T09:37:00Z",
    timeline: [
      { event: "Voltage fluctuation pattern detected", time: "09:15 AM" },
      { event: "Alert flagged as warning", time: "09:20 AM" },
      { event: "Monitoring frequency increased", time: "09:22 AM" },
    ],
    aiRecommendation:
      "Voltage fluctuation pattern matches early-stage power supply degradation. Schedule inspection within 24 hours. Monitor closely for further deterioration.",
  },
  {
    id: "inc-4",
    chargerId: "charger-21",
    chargerName: "Charger 21",
    chargerCode: "CHG-021",
    location: "Lot D - East Side",
    severity: "warning",
    status: "active",
    title: "Elevated temperature",
    description: "Temperature rising — 42.8C (threshold: 45C)",
    detailedDescription:
      "Charger 21 temperature has gradually increased from 35C to 42.8C over the past 4 hours. Approaching the 45C warning threshold.",
    metric: "temperature",
    threshold: 45,
    currentValue: 42.8,
    timeAgo: "35 min ago",
    timestamp: "2026-02-21T09:25:00Z",
    timeline: [
      { event: "Temperature trend identified", time: "09:00 AM" },
      { event: "Alert flagged as warning", time: "09:10 AM" },
    ],
    aiRecommendation:
      "Temperature is rising at 0.8C per hour. At this rate, critical threshold will be reached in approximately 2.5 hours. Recommend proactive cooling system check.",
  },
  {
    id: "inc-5",
    chargerId: "charger-22",
    chargerName: "Charger 22",
    chargerCode: "CHG-022",
    location: "Lot E - West Village",
    severity: "warning",
    status: "active",
    title: "Uptime degradation",
    description: "Uptime dropped to 87.2% (threshold: 90%)",
    detailedDescription:
      "Charger 22 uptime has decreased from 96% to 87.2% over the past week due to repeated brief disconnections. Each disconnection lasts 2-5 minutes.",
    metric: "uptime",
    threshold: 90,
    currentValue: 87.2,
    timeAgo: "1 hr ago",
    timestamp: "2026-02-21T09:00:00Z",
    timeline: [
      { event: "Uptime dropped below 90%", time: "08:30 AM" },
      { event: "Alert flagged as warning", time: "08:45 AM" },
    ],
    aiRecommendation:
      "Disconnection pattern suggests network connectivity issues. Check cellular/WiFi module and network configuration. Pattern correlates with peak usage hours.",
  },
  {
    id: "inc-6",
    chargerId: "charger-27",
    chargerName: "Charger 27",
    chargerCode: "CHG-027",
    location: "Lot H - Chelsea",
    severity: "critical",
    status: "resolved",
    title: "Complete power failure",
    description: "Charger offline — 0V detected",
    detailedDescription:
      "Charger 27 experienced a complete power failure at 07:15 AM. Automated restart procedure was initiated and successfully restored power at 07:42 AM.",
    metric: "voltage",
    threshold: 230,
    currentValue: 0,
    timeAgo: "3 hrs ago",
    timestamp: "2026-02-21T07:15:00Z",
    timeline: [
      { event: "Complete power loss detected", time: "07:15 AM" },
      { event: "Alert flagged as critical", time: "07:15 AM" },
      { event: "Auto-restart initiated", time: "07:20 AM" },
      { event: "Power restored", time: "07:42 AM" },
      { event: "Incident resolved", time: "07:45 AM" },
    ],
    aiRecommendation:
      "Power failure was caused by a breaker trip. Breaker has been reset and charger is back online. Recommend electrical inspection to prevent recurrence.",
  },
]

export function getStatusColor(status: ChargerStatus): string {
  switch (status) {
    case "healthy":
      return "#00e5a0"
    case "warning":
      return "#f5a623"
    case "critical":
      return "#ff4d4d"
  }
}

export function getStatusBg(status: ChargerStatus): string {
  switch (status) {
    case "healthy":
      return "bg-[#00e5a0]/10 text-[#00e5a0]"
    case "warning":
      return "bg-[#f5a623]/10 text-[#f5a623]"
    case "critical":
      return "bg-[#ff4d4d]/10 text-[#ff4d4d]"
  }
}

export const fleetStats = {
  totalChargers: 27,
  healthy: 19,
  warning: 5,
  critical: 3,
  totalLocations: 8,
  healthScore: 73.4,
  totalEnergyToday: 2847.3,
}
