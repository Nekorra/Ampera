"use client"

import { useState, useMemo } from "react"
import { Search, MapPin, ChevronRight } from "lucide-react"
import { useDashboardData } from "@/components/live-dashboard-provider"
import {
  getStatusColor,
  getStatusBg,
  type Charger,
  type ChargerStatus,
} from "@/lib/charger-data"

interface ChargersTabProps {
  onChargerClick: (charger: Charger) => void
}

type FilterType = "all" | ChargerStatus
type SortType = "risk" | "uptime" | "name" | "location"

function SparkBars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-0.5" style={{ height: 24 }}>
      {data.slice(-6).map((val, i) => (
        <div
          key={i}
          className="w-1.5 rounded-t"
          style={{
            height: `${(val / max) * 100}%`,
            backgroundColor: color,
            opacity: 0.3 + (i / 6) * 0.7,
          }}
        />
      ))}
    </div>
  )
}

function SmallRing({
  value,
  color,
  size = 40,
}: {
  value: number
  color: string
  size?: number
}) {
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (value / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2a2a3a"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
    </div>
  )
}

export function ChargersTab({ onChargerClick }: ChargersTabProps) {
  const { chargers, fleetStats } = useDashboardData()
  const [filter, setFilter] = useState<FilterType>("all")
  const [sort, setSort] = useState<SortType>("risk")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    let list = [...chargers]

    if (filter !== "all") {
      list = list.filter((c) => c.status === filter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q)
      )
    }

    switch (sort) {
      case "risk":
        list.sort((a, b) => b.riskScore - a.riskScore)
        break
      case "uptime":
        list.sort((a, b) => a.uptime - b.uptime)
        break
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "location":
        list.sort((a, b) => a.location.localeCompare(b.location))
        break
    }

    return list
  }, [chargers, filter, sort, search])

  const filters: { id: FilterType; label: string; count?: number }[] = [
    { id: "all", label: "All", count: chargers.length },
    { id: "healthy", label: "Healthy", count: fleetStats.healthy },
    { id: "warning", label: "Warning", count: fleetStats.warning },
    { id: "critical", label: "Critical", count: fleetStats.critical },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Charger Fleet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fleetStats.totalChargers} chargers across{" "}
          {fleetStats.totalLocations} locations
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                filter === f.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.id !== "all" && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: getStatusColor(f.id as ChargerStatus),
                  }}
                />
              )}
              {f.label}
              <span className="ml-1 rounded-md bg-card px-1.5 py-0.5 font-mono text-xs">
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-40 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none"
          >
            <option value="risk">Sort by Risk Score</option>
            <option value="uptime">Sort by Uptime</option>
            <option value="name">Sort by Name</option>
            <option value="location">Sort by Location</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {filtered.map((charger, i) => {
          const color = getStatusColor(charger.status)
          return (
            <button
              key={charger.id}
              onClick={() => onChargerClick(charger)}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-border hover:shadow-lg hover:shadow-black/10"
              style={{
                animation: `fade-up 0.3s ease-out ${i * 30}ms both`,
                borderLeftColor:
                  charger.status !== "healthy" ? color : undefined,
                borderLeftWidth:
                  charger.status !== "healthy" ? "3px" : undefined,
              }}
            >
              {/* Status Ring */}
              <div className="relative flex items-center justify-center">
                <SmallRing value={100 - charger.riskScore} color={color} />
                <span className="absolute font-mono text-[10px] font-bold text-foreground">
                  {chargers.indexOf(charger) + 1}
                </span>
              </div>

              {/* Name */}
              <div className="w-36">
                <p className="text-sm font-semibold text-foreground">
                  {charger.name}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {charger.code}
                </p>
              </div>

              {/* Location */}
              <div className="flex w-44 items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {charger.location}
              </div>

              {/* Status Badge */}
              <span
                className={`w-20 rounded-full px-2.5 py-1 text-center text-xs font-medium capitalize ${getStatusBg(
                  charger.status
                )}`}
              >
                {charger.status}
              </span>

              {/* Risk Score */}
              <div className="flex w-28 items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 font-mono text-xs font-bold"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {charger.riskScore.toFixed(1)}
                </span>
                <SparkBars data={charger.riskHistory} color={color} />
              </div>

              {/* Voltage + Temp */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono">
                  {charger.voltage.toFixed(1)}V
                </span>
                <span className="font-mono">
                  {charger.temperature.toFixed(1)}C
                </span>
              </div>

              {/* Uptime */}
              <span className="w-16 text-right font-mono text-xs text-foreground">
                {charger.uptime.toFixed(1)}%
              </span>

              {/* Chevron */}
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
