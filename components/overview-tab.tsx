"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getStatusColor, type Charger } from "@/lib/charger-data"
import { useDashboardData } from "@/components/live-dashboard-provider"
import { Spinner } from "@/components/ui/spinner"
import { AMPERA_DARK_MAP_STYLE } from "@/lib/ampera-map-style"
import { loadGoogleMapsApi } from "@/lib/google-maps-loader"
import { MapPin, Thermometer, Zap } from "lucide-react"

interface OverviewTabProps {
  onChargerClick: (charger: Charger) => void
  onViewAllChargers: () => void
}

const DATE_LABEL = "Saturday, 21 February 2026"

function AnimatedRing({
  value,
  max,
  color,
  label,
  size = 124,
}: {
  value: number
  max: number
  color: string
  label: string
  size?: number
}) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const maxArcLength = circumference * 0.78
  const progressRatio = max === 0 ? 0 : Math.min(Math.max(animatedValue / max, 0), 1)
  const progressArcLength = maxArcLength * progressRatio

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 140)
    return () => clearTimeout(timer)
  }, [value])

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-[220deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#242636"
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
          strokeDasharray={`${progressArcLength} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[38px] font-semibold leading-none text-white">{value}</p>
        <p className="mt-1 text-[13px] font-medium lowercase text-[#787A95]">{label}</p>
      </div>
    </div>
  )
}

function ScoreGauge({ score }: { score: number }) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 200)
    return () => clearTimeout(timer)
  }, [score])

  const healthLabel = animatedScore > 85 ? "Excellent" : animatedScore > 70 ? "Mostly Healthy" : animatedScore > 50 ? "Needs Attention" : "Critical"
  const normalizedScore = Math.max(0, Math.min(animatedScore, 100))
  const orbSize = 217
  const markerSize = 40

  // Map score to the visible blue "waterline" height by area, which matches the Figma look
  // more closely than a simple linear height fill.
  const getBlueFillHeight = (scorePercent: number) => {
    const fraction = Math.max(0, Math.min(scorePercent / 100, 1))
    if (fraction === 0) return 0
    if (fraction === 1) return orbSize

    const r = orbSize / 2
    const totalArea = Math.PI * r * r
    const targetTopCapArea = totalArea * (1 - fraction)

    const capArea = (h: number) => {
      if (h <= 0) return 0
      if (h >= 2 * r) return totalArea

      const term = Math.max(0, 2 * r * h - h * h)
      return r * r * Math.acos((r - h) / r) - (r - h) * Math.sqrt(term)
    }

    let low = 0
    let high = orbSize
    for (let i = 0; i < 22; i += 1) {
      const mid = (low + high) / 2
      if (capArea(mid) < targetTopCapArea) {
        low = mid
      } else {
        high = mid
      }
    }

    const topCapHeight = (low + high) / 2
    return orbSize - topCapHeight
  }

  const blueFillHeight = getBlueFillHeight(normalizedScore)

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-8 xl:flex-nowrap">
      <div
        className="relative shrink-0"
        style={{ width: orbSize, height: orbSize }}
        aria-label={`Health score ${animatedScore.toFixed(1)} percent`}
        role="img"
      >
        <div className="absolute inset-0 rounded-full bg-[#343444]" />

        <div
          className="absolute bottom-0 left-0 w-full overflow-hidden"
          style={{ height: blueFillHeight, transition: "height 1.2s ease-out" }}
        >
          <div
            className="absolute left-0 rounded-full bg-[#0277FA]"
            style={{ width: orbSize, height: orbSize, bottom: 0 }}
          />
        </div>

        <div
          className="absolute rounded-full bg-[#064D9D]"
          style={{
            width: markerSize,
            height: markerSize,
            right: 18,
            bottom: 34,
          }}
        />
      </div>

      <div>
        <p className="font-mono text-5xl font-semibold leading-none text-[#f3f5ff] 2xl:text-6xl">{animatedScore.toFixed(1)}%</p>
        <p className="mt-2 text-base text-[#8e94b9] 2xl:text-lg">{healthLabel}</p>
      </div>
    </div>
  )
}

function miniMarkerIcon(google: any, color: string) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 5,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#0d1225",
    strokeWeight: 2,
  }
}

function miniPopupHtml(charger: Charger) {
  return `
    <div style="min-width:150px;padding:2px 2px 0 2px;font-family:DM Sans, Arial, sans-serif;color:#1f2338;">
      <div style="font-size:13px;font-weight:700;line-height:1.2;">${charger.name}</div>
      <div style="margin-top:4px;font-size:11px;color:#5f6588;">${charger.code} · ${charger.location}</div>
      <div style="margin-top:6px;font-size:11px;color:#5f6588;">Risk ${charger.riskScore.toFixed(1)} · ${charger.status}</div>
    </div>
  `
}

function FleetMapPanel({
  chargers,
  onChargerClick,
}: {
  chargers: Charger[]
  onChargerClick: (charger: Charger) => void
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const googleRef = useRef<any>(null)
  const infoWindowRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [isLoadingMap, setIsLoadingMap] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!mapElRef.current) return

    setIsLoadingMap(true)
    loadGoogleMapsApi()
      .then((google) => {
        if (cancelled || !mapElRef.current) return
        googleRef.current = google

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapElRef.current, {
            center: { lat: 38.581572, lng: -121.4944 },
            zoom: 11,
            styles: AMPERA_DARK_MAP_STYLE,
            disableDefaultUI: true,
            clickableIcons: false,
            draggable: true,
            scrollwheel: true,
            disableDoubleClickZoom: false,
            keyboardShortcuts: false,
            gestureHandling: "greedy",
            backgroundColor: "#0a0a0f",
          })
        }
        if (!infoWindowRef.current) {
          infoWindowRef.current = new google.maps.InfoWindow()
        }

        setMapReady(true)
        setMapError(null)
        setIsLoadingMap(false)
      })
      .catch((error) => {
        if (cancelled) return
        setMapReady(false)
        setMapError(error instanceof Error ? error.message : "Failed to load map")
        setIsLoadingMap(false)
      })

    return () => {
      cancelled = true
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const google = googleRef.current
    if (!map || !google || !mapReady) return

    for (const marker of markersRef.current) {
      marker.setMap(null)
    }
    markersRef.current = []

    if (!chargers.length) return

    const bounds = new google.maps.LatLngBounds()
    chargers.forEach((charger) => {
      const marker = new google.maps.Marker({
        position: { lat: charger.lat, lng: charger.lng },
        map,
        title: charger.name,
        icon: miniMarkerIcon(google, getStatusColor(charger.status)),
      })
      marker.addListener("mouseover", () => {
        if (!infoWindowRef.current) return
        infoWindowRef.current.setContent(miniPopupHtml(charger))
        infoWindowRef.current.open({ map, anchor: marker, shouldFocus: false })
      })
      marker.addListener("mouseout", () => {
        infoWindowRef.current?.close()
      })
      marker.addListener("click", () => onChargerClick(charger))
      markersRef.current.push(marker)
      bounds.extend(marker.getPosition())
    })

    google.maps.event.trigger(map, "resize")
    map.fitBounds(bounds, 36)
    google.maps.event.addListenerOnce(map, "idle", () => {
      if (!map) return
      const zoom = map.getZoom() ?? 11
      if (zoom > 13) map.setZoom(13)
    })
  }, [chargers, mapReady, onChargerClick])

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[34px] border border-[#2f3456] bg-[#12162a] xl:h-[640px] 2xl:h-[688px]">
      <div ref={mapElRef} className="h-full w-full" />
      {isLoadingMap && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-[#0a0d17]/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-xl border border-[#303558] bg-[#242944]/90 px-4 py-2 text-sm text-[#eef0ff]">
            <Spinner className="size-4" />
            Loading map
          </div>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center bg-[#0a0d17]/80 p-6 text-center">
          <p className="max-w-xs text-sm text-[#a9afd0]">
            {mapError}. Add <code className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable maps.
          </p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[#070a14]/24" />
    </div>
  )
}

function ChargerCard({
  charger,
  onClick,
}: {
  charger: Charger
  onClick: () => void
}) {
  const color = getStatusColor(charger.status)
  const riskBarWidth = Math.min(charger.riskScore * 4, 100)

  return (
    <button
      onClick={onClick}
      className="group flex h-[244px] flex-col rounded-[26px] border border-[#303558] bg-[#222743] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#3d4470]"
      style={{ borderTopColor: color, borderTopWidth: "2px" }}
    >
      <div>
        <p className="text-base font-semibold text-[#eef0ff]">{charger.name}</p>
        <p className="mt-0.5 font-mono text-xs tracking-[0.08em] text-[#8e94b9]">{charger.code}</p>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-[#8e94b9]">
        <MapPin className="h-3.5 w-3.5" />
        {charger.location}
      </p>

      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[#eef0ff]">Risk Score</span>
          <span className="font-mono text-sm text-[#8e94b9]">{charger.riskScore.toFixed(2)}</span>
        </div>

        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#171b32]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${riskBarWidth}%`, backgroundColor: color }}
          />
        </div>

        <div className="h-px w-full bg-[#3b4164]" />

        <div className="mt-3 flex items-center gap-3 text-xs text-[#8e94b9]">
          <span className="inline-flex items-center gap-1">
            <Thermometer className="h-3 w-3" />
            {charger.temperature.toFixed(1)}C
          </span>
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {charger.voltage.toFixed(2)}V
          </span>
          <span className="font-mono">{charger.uptime.toFixed(1)}%</span>
        </div>
      </div>
    </button>
  )
}

export function OverviewTab({ onChargerClick, onViewAllChargers }: OverviewTabProps) {
  const { chargers, fleetStats } = useDashboardData()
  const visibleChargers = useMemo(
    () => [...chargers].sort((a, b) => b.riskScore - a.riskScore).slice(0, 4),
    [chargers]
  )

  const total = fleetStats.healthy + fleetStats.warning + fleetStats.critical

  return (
    <div className="grid h-full items-start gap-11 xl:grid-cols-[360px_minmax(0,1fr)]">
      <FleetMapPanel chargers={chargers} onChargerClick={onChargerClick} />

      <div className="flex min-h-0 flex-col xl:h-[644px] xl:max-w-[1080px] 2xl:h-[692px]">
        <div className="grid items-center gap-10 xl:grid-cols-[minmax(0,1fr)_540px]">
          <div className="w-full max-w-[420px] pt-1 text-left">
            <h2 className="whitespace-nowrap text-[68px] font-semibold leading-[0.98] text-[#f3f5ff] 2xl:text-[76px]">Health Score</h2>
            <p className="mt-0.5 text-base text-[#8087ad]">{DATE_LABEL}</p>

            <div className="mt-2 flex w-full items-center justify-between gap-3">
              <AnimatedRing value={fleetStats.healthy} max={total} color="#45cc8a" label="healthy" />
              <AnimatedRing value={fleetStats.warning} max={total} color="#f3c53c" label="warning" />
              <AnimatedRing value={fleetStats.critical} max={total} color="#ee5550" label="critical" />
            </div>
          </div>

          <div className="flex h-[244px] items-center justify-center rounded-[30px] border border-[#303558] bg-[#242944] px-8 py-3">
            <ScoreGauge score={fleetStats.healthScore} />
          </div>
        </div>

        <div className="my-8 h-px bg-[#393f63]" />

        <div className="flex min-h-0 flex-1 flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-semibold text-[#f3f5ff]">Fleet Status</h3>
            <button
              onClick={onViewAllChargers}
              className="text-base text-[#8e94b9] transition-colors hover:text-[#eef0ff]"
            >
              View all
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {visibleChargers.map((charger) => (
              <ChargerCard key={charger.id} charger={charger} onClick={() => onChargerClick(charger)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
