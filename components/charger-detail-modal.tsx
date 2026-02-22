"use client"

import { useEffect, useState } from "react"
import { X, Thermometer, Zap, Clock, ArrowRight } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useDashboardData } from "@/components/live-dashboard-provider"
import { getStatusColor, getStatusBg, type Charger } from "@/lib/charger-data"

interface ChargerDetailModalProps {
  charger: Charger
  onClose: () => void
  onOpenInTriage: (chargerId: string) => void
}

function StatBox({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit: string
  color: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-bold text-foreground">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}

function RiskGauge({ score }: { score: number }) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 200)
    return () => clearTimeout(timer)
  }, [score])

  const getColor = (s: number) => {
    if (s < 25) return "#00e5a0"
    if (s < 50) return "#f5a623"
    return "#ff4d4d"
  }

  const color = getColor(animatedScore)
  const normalizedScore = Math.max(0, Math.min(animatedScore, 100))
  const radius = 50
  const strokeWidth = 10
  const centerX = 60
  const centerY = 60
  const semiCircumference = Math.PI * radius
  const dashOffset = semiCircumference * (1 - normalizedScore / 100)
  const gaugePath = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path
          d={gaugePath}
          fill="none"
          stroke="#2a2a3a"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {animatedScore > 0 && (
          <path
            d={gaugePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={semiCircumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        )}
      </svg>
      <span className="font-mono text-lg font-bold" style={{ color }}>
        {animatedScore.toFixed(2)}
      </span>
      <span className="text-xs text-muted-foreground">Risk Score</span>
    </div>
  )
}

function SparkBars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-1" style={{ height: 40 }}>
      {data.map((val, i) => (
        <div
          key={i}
          className="w-3 rounded-t"
          style={{
            height: `${(val / max) * 100}%`,
            backgroundColor: color,
            opacity: 0.4 + (i / data.length) * 0.6,
          }}
        />
      ))}
    </div>
  )
}

export function ChargerDetailModal({
  charger: initialCharger,
  onClose,
  onOpenInTriage,
}: ChargerDetailModalProps) {
  const { chargers } = useDashboardData()
  const charger =
    chargers.find((candidate) => candidate.id === initialCharger.id) ??
    initialCharger
  const color = getStatusColor(charger.status)

  const chartData = charger.voltageHistory.map((v, i) => ({
    index: i + 1,
    voltage: v,
    temperature: charger.tempHistory[i],
  }))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const aiInsight =
    charger.status === "critical"
      ? `Voltage has dropped ${(240 - charger.voltage).toFixed(1)}V from baseline over the last 6 hours. Temperature trending upward at ${charger.temperature.toFixed(1)}C. Recommend immediate inspection.`
      : charger.status === "warning"
      ? `${charger.name} shows early signs of degradation. Risk score has increased ${((charger.riskScore / 30) * 100 - 100).toFixed(0)}% this week. Schedule preventive maintenance within 24 hours.`
      : `${charger.name} is operating within normal parameters. All metrics are within safe thresholds. No action needed.`

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "fade-up 0.3s ease-out" }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground">
              {charger.name}
            </h2>
            <span className="font-mono text-sm text-muted-foreground">
              {charger.code}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusBg(
                charger.status
              )}`}
            >
              {charger.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatBox
            icon={Zap}
            label="Voltage"
            value={charger.voltage.toFixed(2)}
            unit="V"
            color="#3b82f6"
          />
          <StatBox
            icon={Thermometer}
            label="Temperature"
            value={charger.temperature.toFixed(1)}
            unit="C"
            color="#f5a623"
          />
          <StatBox
            icon={Clock}
            label="Uptime"
            value={charger.uptime.toFixed(1)}
            unit="%"
            color="#00e5a0"
          />
        </div>

        {/* Chart */}
        <div className="mb-6 rounded-xl border border-border bg-secondary p-4">
          <h3 className="mb-4 text-sm font-medium text-foreground">
            Last 24 Readings
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#2a2a3a" strokeDasharray="3 3" />
              <XAxis
                dataKey="index"
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
                name="Temp (C)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Score + Trend */}
        <div className="mb-6 flex items-center gap-8 rounded-xl border border-border bg-secondary p-4">
          <RiskGauge score={charger.riskScore} />
          <div className="flex-1">
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">
              Risk Trend (7 days)
            </h4>
            <SparkBars data={charger.riskHistory} color={color} />
          </div>
        </div>

        {/* AI Insight */}
        <div className="mb-6 rounded-xl border border-border bg-[#00e5a0]/5 p-4">
          <h4 className="mb-2 text-xs font-medium text-primary">
            AI Insight
          </h4>
          <p className="text-sm italic text-foreground/80">{aiInsight}</p>
        </div>

        {/* Action */}
        <button
          onClick={() => onOpenInTriage(charger.id)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Open in AI Triage
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
