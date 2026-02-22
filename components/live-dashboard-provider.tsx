"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  chargers as mockChargers,
  incidents as mockIncidents,
  fleetStats as mockFleetStats,
  type Charger,
  type Incident,
} from "@/lib/charger-data"

type FleetStats = typeof mockFleetStats

type LiveDashboardPayload = {
  chargers: Charger[]
  incidents: Incident[]
  fleetStats: FleetStats
  generatedAt?: string
  source?: "supabase" | "fallback"
  latestTimestamp?: string | null
}

type LiveDashboardContextValue = {
  chargers: Charger[]
  incidents: Incident[]
  fleetStats: FleetStats
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  generatedAt: string | null
  latestTimestamp: string | null
  refresh: () => Promise<void>
}

const LiveDashboardContext = createContext<LiveDashboardContextValue | null>(null)

async function fetchLiveDashboard(): Promise<LiveDashboardPayload> {
  const response = await fetch("/api/live-dashboard", { cache: "no-store" })
  if (!response.ok) {
    let message = `Live data request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(message)
  }
  return (await response.json()) as LiveDashboardPayload
}

export function LiveDashboardProvider({ children }: { children: React.ReactNode }) {
  const [chargers, setChargers] = useState<Charger[]>(mockChargers)
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents)
  const [fleetStats, setFleetStats] = useState<FleetStats>(mockFleetStats)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [latestTimestamp, setLatestTimestamp] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const requestInFlightRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const applyPayload = useCallback((payload: LiveDashboardPayload) => {
    setChargers(Array.isArray(payload.chargers) ? payload.chargers : [])
    setIncidents(Array.isArray(payload.incidents) ? payload.incidents : [])
    setFleetStats(payload.fleetStats ?? mockFleetStats)
    setGeneratedAt(payload.generatedAt ?? null)
    setLatestTimestamp(payload.latestTimestamp ?? null)
  }, [])

  const runRefresh = useCallback(async (initial: boolean) => {
    if (requestInFlightRef.current) return
    requestInFlightRef.current = true

    if (initial) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const payload = await fetchLiveDashboard()
      if (!mountedRef.current) return
      applyPayload(payload)
      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : "Failed to load live dashboard data")
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
      requestInFlightRef.current = false
    }
  }, [applyPayload])

  useEffect(() => {
    void runRefresh(true)
    const interval = window.setInterval(() => {
      void runRefresh(false)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [runRefresh])

  const refresh = useCallback(async () => {
    await runRefresh(false)
  }, [runRefresh])

  const value = useMemo<LiveDashboardContextValue>(
    () => ({
      chargers,
      incidents,
      fleetStats,
      isLoading,
      isRefreshing,
      error,
      generatedAt,
      latestTimestamp,
      refresh,
    }),
    [chargers, incidents, fleetStats, isLoading, isRefreshing, error, generatedAt, latestTimestamp, refresh]
  )

  return <LiveDashboardContext.Provider value={value}>{children}</LiveDashboardContext.Provider>
}

export function useDashboardData() {
  const context = useContext(LiveDashboardContext)
  if (!context) {
    throw new Error("useDashboardData must be used within LiveDashboardProvider")
  }
  return context
}
