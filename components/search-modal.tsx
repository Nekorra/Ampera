"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, X } from "lucide-react"
import { getStatusBg, type Charger } from "@/lib/charger-data"
import { useDashboardData } from "@/components/live-dashboard-provider"
import { Spinner } from "@/components/ui/spinner"

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChargerSelect: (charger: Charger) => void
}

export function SearchModal({
  open,
  onOpenChange,
  onChargerSelect,
}: SearchModalProps) {
  const { chargers, isLoading } = useDashboardData()
  const [query, setQuery] = useState("")

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !open) {
        e.preventDefault()
        onOpenChange(true)
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) return chargers.slice(0, 8)
    const q = query.toLowerCase()
    return chargers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
    )
  }, [query, chargers])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-background/80 pt-[15vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chargers by name, ID, or location..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading chargers...
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No chargers found
            </p>
          ) : (
            results.map((charger) => (
              <button
                key={charger.id}
                onClick={() => onChargerSelect(charger)}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        charger.status === "healthy"
                          ? "#00e5a0"
                          : charger.status === "warning"
                          ? "#f5a623"
                          : "#ff4d4d",
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {charger.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {charger.code} · {charger.location}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusBg(
                    charger.status
                  )}`}
                >
                  {charger.status}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
