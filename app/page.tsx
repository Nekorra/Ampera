"use client"

import { useState, useCallback } from "react"
import { Navbar } from "@/components/navbar"
import { OverviewTab } from "@/components/overview-tab"
import { ChargersTab } from "@/components/chargers-tab"
import { IncidentsTab } from "@/components/incidents-tab"
import { AITriageTab } from "@/components/ai-triage-tab"
import { MapsTab } from "@/components/maps-tab"
import { ChargerDetailModal } from "@/components/charger-detail-modal"
import { SearchModal } from "@/components/search-modal"
import { LiveDashboardProvider, useDashboardData } from "@/components/live-dashboard-provider"
import { Spinner } from "@/components/ui/spinner"
import type { Charger } from "@/lib/charger-data"

export type TabId = "overview" | "chargers" | "incidents" | "ai-triage" | "maps"

export default function Home() {
  return (
    <LiveDashboardProvider>
      <DashboardShell />
    </LiveDashboardProvider>
  )
}

function DashboardShell() {
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [selectedCharger, setSelectedCharger] = useState<Charger | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [triageChargerId, setTriageChargerId] = useState<string | null>(null)
  const { isLoading, isRefreshing, error, latestTimestamp } = useDashboardData()

  const openChargerDetail = useCallback((charger: Charger) => {
    setSelectedCharger(charger)
  }, [])

  const closeChargerDetail = useCallback(() => {
    setSelectedCharger(null)
  }, [])

  const openInTriage = useCallback(
    (chargerId: string) => {
      setSelectedCharger(null)
      setTriageChargerId(chargerId)
      setActiveTab("ai-triage")
    },
    []
  )

  const navigateToChargers = useCallback(() => {
    setActiveTab("chargers")
  }, [])

  const isOverview = activeTab === "overview"

  return (
    <div className="h-screen overflow-hidden bg-[#1D1D29] px-4 py-4 sm:px-7 sm:py-6">
      <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSearchOpen={() => setSearchOpen(true)}
        />

        <div className="mt-3 flex min-h-[24px] items-center justify-end">
          {isRefreshing && !isLoading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#303558] bg-[#242944] px-3 py-1 text-xs text-[#9aa1c6]">
              <Spinner className="size-3.5" />
              Refreshing live data
            </div>
          ) : latestTimestamp ? (
            <p className="text-xs text-[#8087ad]">
              Live as of{" "}
              {new Date(latestTimestamp).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>

        <main className="mt-8 min-h-0 flex-1 xl:mt-10">
          <div className="relative h-full">
            <div
              key={activeTab}
              className={`h-full animate-fade-up ${isOverview ? "overflow-hidden" : "overflow-auto pr-1"}`}
              style={{ animationDuration: "0.3s" }}
            >
              {activeTab === "overview" && (
                <OverviewTab
                  onChargerClick={openChargerDetail}
                  onViewAllChargers={navigateToChargers}
                />
              )}
              {activeTab === "chargers" && (
                <ChargersTab onChargerClick={openChargerDetail} />
              )}
              {activeTab === "incidents" && <IncidentsTab />}
              {activeTab === "ai-triage" && (
                <AITriageTab preloadedChargerId={triageChargerId} />
              )}
              {activeTab === "maps" && (
                <MapsTab onChargerClick={openChargerDetail} />
              )}
            </div>

            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-[#1D1D29]/80 backdrop-blur-sm">
                <div className="flex items-center gap-3 rounded-2xl border border-[#303558] bg-[#242944] px-5 py-3 text-sm text-[#eef0ff]">
                  <Spinner className="size-4" />
                  Loading live dashboard data
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {error && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[70] max-w-md rounded-xl border border-[#5a3350] bg-[#2a1d2b]/95 px-4 py-3 text-sm text-[#f2d8e8] shadow-xl">
          Live data unavailable. Showing fallback data. {error}
        </div>
      )}

      {selectedCharger && (
        <ChargerDetailModal
          charger={selectedCharger}
          onClose={closeChargerDetail}
          onOpenInTriage={openInTriage}
        />
      )}

      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onChargerSelect={(charger) => {
          setSearchOpen(false)
          openChargerDetail(charger)
        }}
      />
    </div>
  )
}
