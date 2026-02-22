"use client"

import { useEffect, useState, useMemo } from "react"
import { AlertTriangle, Circle, Clock, CheckCircle2, Shield } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { type Incident } from "@/lib/charger-data"
import { useDashboardData } from "@/components/live-dashboard-provider"
import { toast } from "sonner"

type IncidentFilter = "all" | "warning" | "critical" | "resolved"

export function IncidentsTab() {
  const { incidents, chargers } = useDashboardData()
  const [incidentList, setIncidentList] = useState<Incident[]>(incidents)
  const [filter, setFilter] = useState<IncidentFilter>("all")
  const [selectedId, setSelectedId] = useState<string>(incidents[0]?.id ?? "")

  useEffect(() => {
    setIncidentList(incidents)
    setSelectedId((prev) =>
      incidents.some((incident) => incident.id === prev) ? prev : (incidents[0]?.id ?? "")
    )
  }, [incidents])

  const filtered = useMemo(() => {
    if (filter === "all")
      return incidentList.filter((i) => i.status !== "resolved")
    if (filter === "resolved")
      return incidentList.filter((i) => i.status === "resolved")
    return incidentList.filter(
      (i) => i.severity === filter && i.status !== "resolved"
    )
  }, [filter, incidentList])

  const selected = incidentList.find((i) => i.id === selectedId) ?? filtered[0]
  const selectedCharger = selected
    ? chargers.find((charger) => charger.id === selected.chargerId)
    : undefined

  const handleAcknowledge = (id: string) => {
    setIncidentList((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "acknowledged" as const } : i
      )
    )
    toast.success("Incident acknowledged", {
      description: `Incident ${id} has been marked as acknowledged.`,
    })
  }

  const handleResolve = (id: string) => {
    setIncidentList((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "resolved" as const } : i
      )
    )
    toast.success("Incident resolved", {
      description: `Incident ${id} has been resolved and moved to the Resolved tab.`,
    })
  }

  const activeCount = incidentList.filter(
    (i) => i.status !== "resolved"
  ).length

  const filters: { id: IncidentFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "warning", label: "Warning" },
    { id: "critical", label: "Critical" },
    { id: "resolved", label: "Resolved" },
  ]

  const generateChartData = (incident: Incident, charger?: (typeof chargers)[number]) => {
    if (charger) {
      const voltageSeries = charger.voltageHistory.length
        ? charger.voltageHistory
        : [charger.voltage]
      const tempSeries = charger.tempHistory.length
        ? charger.tempHistory
        : [charger.temperature]
      const pointCount = Math.max(voltageSeries.length, tempSeries.length)

      return Array.from({ length: pointCount }, (_, i) => {
        const voltage =
          voltageSeries[i] ??
          voltageSeries[voltageSeries.length - 1] ??
          charger.voltage
        const temperature =
          tempSeries[i] ??
          tempSeries[tempSeries.length - 1] ??
          charger.temperature

        return {
          hour: `${i + 1}`,
          voltage,
          temperature,
        }
      })
    }

    const baseVoltage = incident.metric === "voltage" ? 240 : 236
    const baseTemp = incident.metric === "temperature" ? 35 : 30
    const seed = incident.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return Array.from({ length: 24 }, (_, i) => {
      const voltageNoise = ((Math.sin((seed + 1) * (i + 1) * 12.9898) * 43758.5453) % 1) - 0.5
      const tempNoise = ((Math.sin((seed + 11) * (i + 1) * 9.731) * 19341.331) % 1) - 0.5
      const voltageTrend =
        incident.metric === "voltage"
          ? baseVoltage - i * ((baseVoltage - incident.currentValue) / 24)
          : baseVoltage + voltageNoise * 1.5
      const tempTrend =
        incident.metric === "temperature"
          ? baseTemp + i * ((incident.currentValue - baseTemp) / 24)
          : baseTemp + tempNoise * 2
      return {
        hour: `${i}h`,
        voltage: voltageTrend + voltageNoise * 2.2,
        temperature: tempTrend + tempNoise * 1.4,
      }
    })
  }

  return (
    <div className="flex gap-6" style={{ minHeight: "calc(100vh - 80px)" }}>
      {/* Left - Feed */}
      <div className="flex w-[400px] shrink-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            Active Incidents
          </h1>
          <span className="rounded-lg bg-destructive/10 px-2 py-0.5 font-mono text-sm font-bold text-destructive">
            {activeCount}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === f.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-12">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">No incidents found</p>
            </div>
          ) : (
            filtered.map((incident) => (
              <button
                key={incident.id}
                onClick={() => setSelectedId(incident.id)}
                className={`flex gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:shadow-md ${
                  selectedId === incident.id
                    ? "border-primary/40 shadow-lg shadow-primary/5"
                    : "border-border"
                }`}
              >
                <div className="mt-0.5">
                  {incident.severity === "critical" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                      <Circle className="h-3 w-3 fill-destructive text-destructive" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {incident.chargerName}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {incident.chargerCode}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {incident.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {incident.timeAgo}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                        incident.status === "resolved"
                          ? "bg-primary/10 text-primary"
                          : incident.status === "acknowledged"
                          ? "bg-accent/10 text-accent"
                          : incident.severity === "critical"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right - Detail Panel */}
      {selected && (
        <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">
                {selected.chargerName}
              </h2>
              <span className="font-mono text-sm text-muted-foreground">
                {selected.location}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  selected.severity === "critical"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-warning/10 text-warning"
                }`}
              >
                {selected.severity}
              </span>
            </div>
            <h3 className="mt-2 text-foreground">{selected.title}</h3>
          </div>

          {/* Description */}
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {selected.detailedDescription}
          </p>

          {/* Timeline */}
          <div className="mb-6">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Event Timeline
            </h4>
            <div className="flex flex-col gap-0">
              {selected.timeline.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          i === selected.timeline.length - 1
                            ? selected.severity === "critical"
                              ? "#ff4d4d"
                              : "#f5a623"
                            : "#2a2a3a",
                        border:
                          i === selected.timeline.length - 1
                            ? "none"
                            : "2px solid #666680",
                      }}
                    />
                    {i < selected.timeline.length - 1 && (
                      <div className="h-8 w-px bg-border" />
                    )}
                  </div>
                  <div className="-mt-1">
                    <p className="text-sm text-foreground">{event.event}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="mb-6 rounded-xl border border-border bg-secondary p-4">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Voltage & Temperature Over Time
            </h4>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={generateChartData(selected, selectedCharger)}>
                <CartesianGrid stroke="#2a2a3a" strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  stroke="#666680"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  yAxisId="voltage"
                  stroke="#666680"
                  tick={{ fontSize: 10 }}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  yAxisId="temp"
                  orientation="right"
                  stroke="#666680"
                  tick={{ fontSize: 10 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#16161e",
                    border: "1px solid #2a2a3a",
                    borderRadius: "8px",
                    color: "#f0f0f0",
                    fontSize: 12,
                  }}
                />
                {(selected.metric === "voltage" || selected.metric === "temperature") && (
                  <ReferenceLine
                    yAxisId={selected.metric === "voltage" ? "voltage" : "temp"}
                    y={selected.threshold}
                    stroke="#ff4d4d"
                    strokeDasharray="6 3"
                    label={{
                      value: "Threshold",
                      position: "right",
                      fill: "#ff4d4d",
                      fontSize: 10,
                    }}
                  />
                )}
                <Line
                  yAxisId="voltage"
                  type="monotone"
                  dataKey="voltage"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Voltage (V)"
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#f5a623"
                  strokeWidth={2}
                  dot={false}
                  name="Temperature (C)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Actions */}
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => handleAcknowledge(selected.id)}
              disabled={
                selected.status === "acknowledged" ||
                selected.status === "resolved"
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              {selected.status === "acknowledged"
                ? "Acknowledged"
                : "Acknowledge"}
            </button>
            <button
              onClick={() => handleResolve(selected.id)}
              disabled={selected.status === "resolved"}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {selected.status === "resolved" ? "Resolved" : "Resolve"}
            </button>
          </div>

          {/* AI Recommendation */}
          <div className="rounded-xl border border-border bg-primary/5 p-4">
            <h4 className="mb-2 text-xs font-medium text-primary">
              AI Recommendation
            </h4>
            <p className="text-sm italic leading-relaxed text-foreground/80">
              {selected.aiRecommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
