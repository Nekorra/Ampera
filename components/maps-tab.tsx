"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { MapPin, Zap, Eye, EyeOff, Navigation } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useDashboardData } from "@/components/live-dashboard-provider"
import { AMPERA_DARK_MAP_STYLE } from "@/lib/ampera-map-style"
import { loadGoogleMapsApi } from "@/lib/google-maps-loader"
import {
  getStatusColor,
  getStatusBg,
  type Charger,
  type ChargerStatus,
} from "@/lib/charger-data"

interface MapsTabProps {
  onChargerClick: (charger: Charger) => void
}

const DEFAULT_CENTER = { lat: 38.581572, lng: -121.4944 }
const INITIAL_FOCUS_ZOOM = 12
const MIN_ZOOM = 8
const MAX_ZOOM = 17

function markerIcon(google: any, color: string, selected = false) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: selected ? 7 : 5.5,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: selected ? "#eef0ff" : "#0f1428",
    strokeWeight: selected ? 2.5 : 2,
  }
}

function popupHtml(charger: Charger) {
  return `
    <div style="min-width:160px;padding:2px 2px 0 2px;font-family:DM Sans, Arial, sans-serif;color:#1f2338;">
      <div style="font-size:13px;font-weight:700;line-height:1.2;">${charger.name}</div>
      <div style="margin-top:4px;font-size:11px;color:#5f6588;">${charger.code} · ${charger.location}</div>
      <div style="margin-top:6px;font-size:11px;color:#5f6588;">Risk ${charger.riskScore.toFixed(1)} · ${charger.status}</div>
    </div>
  `
}

export function MapsTab({ onChargerClick }: MapsTabProps) {
  const { chargers, fleetStats } = useDashboardData()
  const [showHealthy, setShowHealthy] = useState(true)
  const [showWarning, setShowWarning] = useState(true)
  const [showCritical, setShowCritical] = useState(true)
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(INITIAL_FOCUS_ZOOM)
  const [isLoadingMap, setIsLoadingMap] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const googleRef = useRef<any>(null)
  const infoWindowRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const hasAutoFocusedRef = useRef(false)

  const visibleChargers = useMemo(() => {
    return chargers.filter((c) => {
      if (c.status === "healthy" && !showHealthy) return false
      if (c.status === "warning" && !showWarning) return false
      if (c.status === "critical" && !showCritical) return false
      return true
    })
  }, [chargers, showHealthy, showWarning, showCritical])

  const alertChargers = useMemo(
    () => chargers.filter((c) => c.status === "warning" || c.status === "critical"),
    [chargers]
  )

  const selectedCharger = useMemo(
    () => chargers.find((charger) => charger.id === selectedChargerId) ?? null,
    [chargers, selectedChargerId]
  )

  const fitToChargers = useCallback((targetChargers: Charger[]) => {
    const map = mapRef.current
    const google = googleRef.current
    if (!map || !google || !targetChargers.length) return

    if (targetChargers.length === 1) {
      map.setCenter({ lat: targetChargers[0].lat, lng: targetChargers[0].lng })
      map.setZoom(Math.max(map.getZoom() ?? INITIAL_FOCUS_ZOOM, INITIAL_FOCUS_ZOOM))
      return
    }

    const bounds = new google.maps.LatLngBounds()
    for (const charger of targetChargers) {
      bounds.extend({ lat: charger.lat, lng: charger.lng })
    }
    map.fitBounds(bounds, 64)

    google.maps.event.addListenerOnce(map, "idle", () => {
      const z = map.getZoom() ?? INITIAL_FOCUS_ZOOM
      if (z > 13) map.setZoom(13)
      if (z < MIN_ZOOM) map.setZoom(MIN_ZOOM)
    })
  }, [])

  const openPopupForCharger = useCallback(
    (charger: Charger, options?: { pan?: boolean; zoom?: number }) => {
      const map = mapRef.current
      const google = googleRef.current
      const infoWindow = infoWindowRef.current
      const marker = markersRef.current.get(charger.id)
      if (!map || !google || !infoWindow || !marker) return

      if (options?.pan) {
        map.panTo({ lat: charger.lat, lng: charger.lng })
      }
      if (typeof options?.zoom === "number") {
        map.setZoom(options.zoom)
      }

      infoWindow.setContent(popupHtml(charger))
      infoWindow.open({ map, anchor: marker, shouldFocus: false })
    },
    []
  )

  const locateCharger = useCallback(
    (charger: Charger) => {
      setSelectedChargerId(charger.id)
      const currentZoom = mapRef.current?.getZoom() ?? INITIAL_FOCUS_ZOOM
      openPopupForCharger(charger, {
        pan: true,
        zoom: Math.max(currentZoom, INITIAL_FOCUS_ZOOM),
      })
    },
    [openPopupForCharger]
  )

  useEffect(() => {
    let cancelled = false

    if (!mapElRef.current) return

    setIsLoadingMap(true)
    loadGoogleMapsApi()
      .then((google) => {
        if (cancelled || !mapElRef.current) return
        googleRef.current = google

        if (!mapRef.current) {
          const map = new google.maps.Map(mapElRef.current, {
            center: DEFAULT_CENTER,
            zoom: INITIAL_FOCUS_ZOOM,
            styles: AMPERA_DARK_MAP_STYLE,
            disableDefaultUI: true,
            clickableIcons: false,
            backgroundColor: "#0a0a0f",
            gestureHandling: "greedy",
          })

          map.addListener("zoom_changed", () => {
            setZoomLevel(map.getZoom() ?? INITIAL_FOCUS_ZOOM)
          })

          mapRef.current = map
          infoWindowRef.current = new google.maps.InfoWindow()
        }

        setMapError(null)
        setIsLoadingMap(false)
      })
      .catch((error) => {
        if (cancelled) return
        setMapError(error instanceof Error ? error.message : "Failed to load map")
        setIsLoadingMap(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!visibleChargers.length) {
      setSelectedChargerId(null)
      return
    }

    setSelectedChargerId((prev) => {
      if (prev && visibleChargers.some((charger) => charger.id === prev)) return prev
      return visibleChargers[0].id
    })
  }, [visibleChargers])

  useEffect(() => {
    const map = mapRef.current
    const google = googleRef.current
    if (!map || !google) return

    const visibleIds = new Set(visibleChargers.map((charger) => charger.id))

    for (const [id, marker] of markersRef.current.entries()) {
      if (!visibleIds.has(id)) {
        marker.setMap(null)
        markersRef.current.delete(id)
      }
    }

    for (const charger of visibleChargers) {
      let marker = markersRef.current.get(charger.id)
      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: charger.lat, lng: charger.lng },
          map,
          title: charger.name,
          icon: markerIcon(google, getStatusColor(charger.status), charger.id === selectedChargerId),
        })

        marker.addListener("click", () => {
          const latest = (marker as any).__charger as Charger | undefined
          if (!latest) return
          setSelectedChargerId(latest.id)
          openPopupForCharger(latest, { pan: true, zoom: Math.max(map.getZoom() ?? INITIAL_FOCUS_ZOOM, INITIAL_FOCUS_ZOOM) })
          onChargerClick(latest)
        })

        marker.addListener("mouseover", () => {
          const latest = (marker as any).__charger as Charger | undefined
          if (!latest) return
          openPopupForCharger(latest)
        })

        markersRef.current.set(charger.id, marker)
      }

      ;(marker as any).__charger = charger
      marker.setPosition({ lat: charger.lat, lng: charger.lng })
      marker.setTitle(charger.name)
      marker.setMap(map)
      marker.setIcon(markerIcon(google, getStatusColor(charger.status), charger.id === selectedChargerId))
    }

    if (!hasAutoFocusedRef.current && visibleChargers.length > 0) {
      hasAutoFocusedRef.current = true
      const first = visibleChargers[0]
      setSelectedChargerId(first.id)
      map.setCenter({ lat: first.lat, lng: first.lng })
      map.setZoom(INITIAL_FOCUS_ZOOM)
      google.maps.event.addListenerOnce(map, "idle", () => {
        openPopupForCharger(first)
      })
    }

    if (visibleChargers.length === 0 && infoWindowRef.current) {
      infoWindowRef.current.close()
    }
  }, [visibleChargers, selectedChargerId, onChargerClick, openPopupForCharger])

  useEffect(() => {
    const google = googleRef.current
    if (!google) return

    for (const [id, marker] of markersRef.current.entries()) {
      const charger = (marker as any).__charger as Charger | undefined
      if (!charger) continue
      marker.setIcon(markerIcon(google, getStatusColor(charger.status), id === selectedChargerId))
    }

    if (selectedCharger) {
      openPopupForCharger(selectedCharger)
    }
  }, [selectedChargerId, selectedCharger, openPopupForCharger])

  if (chargers.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">No live charger locations available yet.</p>
      </div>
    )
  }

  return (
    <div className="relative flex" style={{ height: "calc(100vh - 80px)" }}>
      <div className="relative flex-1 overflow-hidden rounded-2xl bg-[#0a0a0f]">
        <div ref={mapElRef} className="h-full w-full" />

        {isLoadingMap && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[#0a0a0f]/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-4 py-2 text-sm text-foreground">
              <Spinner className="size-4" />
              Loading map…
            </div>
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 z-[6] flex items-center justify-center bg-[#0a0a0f]/85 p-6 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {mapError}. Add <code className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in
              <code className="ml-1 font-mono text-xs">.env.local</code> to enable the live map.
            </p>
          </div>
        )}

        <div className="absolute bottom-4 right-4 z-[4] flex flex-col gap-1">
          <button
            onClick={() => mapRef.current?.setZoom(Math.min((mapRef.current?.getZoom() ?? INITIAL_FOCUS_ZOOM) + 1, MAX_ZOOM))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary"
          >
            +
          </button>
          <button
            onClick={() => {
              if (visibleChargers.length) {
                fitToChargers(visibleChargers)
                setSelectedChargerId(visibleChargers[0].id)
                openPopupForCharger(visibleChargers[0])
              } else {
                mapRef.current?.setCenter(DEFAULT_CENTER)
                mapRef.current?.setZoom(INITIAL_FOCUS_ZOOM)
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Navigation className="h-4 w-4" />
          </button>
          <button
            onClick={() => mapRef.current?.setZoom(Math.max((mapRef.current?.getZoom() ?? INITIAL_FOCUS_ZOOM) - 1, MIN_ZOOM))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary"
          >
            -
          </button>
        </div>

        <div className="absolute bottom-4 left-4 z-[4] flex items-center gap-4 rounded-xl border border-border bg-card/85 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#00e5a0]" />
            <span className="text-xs text-muted-foreground">Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f5a623]" />
            <span className="text-xs text-muted-foreground">Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff4d4d]" />
            <span className="text-xs text-muted-foreground">Critical</span>
          </div>
        </div>
      </div>

      <div className="absolute left-4 top-4 flex w-[300px] flex-col gap-4 rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-xl" style={{ maxHeight: "calc(100% - 32px)" }}>
        <h2 className="text-lg font-bold text-foreground">Network Map</h2>

        <div className="rounded-xl border border-border bg-secondary p-3">
          <p className="text-xs text-muted-foreground">Selected Charger</p>
          <p className="mt-1 text-sm text-foreground">{selectedCharger?.name ?? "None"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Zoom {zoomLevel}</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Filter by Status</label>
          {(
            [
              { status: "healthy" as ChargerStatus, show: showHealthy, toggle: setShowHealthy },
              { status: "warning" as ChargerStatus, show: showWarning, toggle: setShowWarning },
              { status: "critical" as ChargerStatus, show: showCritical, toggle: setShowCritical },
            ] as const
          ).map(({ status, show, toggle }) => (
            <button
              key={status}
              onClick={() => toggle(!show)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${show ? "bg-secondary text-foreground" : "bg-transparent text-muted-foreground"}`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getStatusColor(status), opacity: show ? 1 : 0.3 }} />
                <span className="capitalize">{status}</span>
              </div>
              {show ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto">
          <label className="text-xs font-medium text-muted-foreground">Alerts ({alertChargers.length})</label>
          {alertChargers.length === 0 ? (
            <div className="rounded-xl border border-border bg-secondary p-3 text-xs text-muted-foreground">
              No warning/critical chargers right now.
            </div>
          ) : (
            alertChargers.map((charger) => (
              <div key={charger.id} className="flex items-center justify-between rounded-xl border border-border bg-secondary p-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(charger.status) }} />
                  <div>
                    <p className="text-xs font-medium text-foreground">{charger.name}</p>
                    <span className={`text-[10px] capitalize ${getStatusBg(charger.status)} rounded px-1 py-0.5`}>
                      {charger.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => locateCharger(charger)}
                  className="flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <MapPin className="h-3 w-3" />
                  Locate
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-auto rounded-xl border border-border bg-secondary p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Energy Delivered Today</span>
          </div>
          <p className="mt-1 font-mono text-xl font-bold text-foreground">{fleetStats.totalEnergyToday.toLocaleString()} MWh</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{visibleChargers.length} visible chargers</p>
        </div>
      </div>
    </div>
  )
}
