"use client"

import { Search } from "lucide-react"
import type { TabId } from "@/app/page"

const tabs: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "chargers", label: "Chargers" },
  { id: "incidents", label: "Incidents" },
  { id: "ai-triage", label: "AI Triage" },
  { id: "maps", label: "Maps" },
]

interface NavbarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onSearchOpen: () => void
}

export function Navbar({ activeTab, onTabChange, onSearchOpen }: NavbarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex min-w-0 items-center gap-5 pl-2 sm:pl-3 lg:gap-7 xl:pl-4 2xl:pl-6">
        <img
          src="/Ampera_Logo.webp"
          alt="Ampera logo"
          className="h-16 w-16 shrink-0 object-contain"
        />

        <nav className="inline-flex items-center rounded-full bg-[#20253f] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors lg:px-6 ${
                activeTab === tab.id
                  ? "bg-[#2e3558] text-[#eef0ff]"
                  : "text-[#8d92b5] hover:text-[#eef0ff]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-5 lg:gap-7">
        <button
          onClick={onSearchOpen}
          className="flex h-14 min-w-[220px] items-center gap-3 rounded-full border border-[#2f3457] bg-[#20253f] px-5 text-[#8d92b5] transition-colors hover:text-[#eef0ff]"
        >
          <Search className="h-5 w-5" />
          <span className="text-base">Search</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="h-14 w-14 overflow-hidden rounded-full border border-[#3c4163] bg-[#2a2f4d]">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-fTJMP5ojun7CEfir3ZqEuu0KRpHqrj.png"
              alt="Kaushik Srinivas"
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          </div>

          <div className="leading-tight">
            <p className="text-lg font-medium text-[#eef0ff]">
              Kaushik Srinivas
            </p>
            <p className="text-sm text-[#8d92b5]">Operator</p>
          </div>
        </div>
      </div>
    </header>
  )
}
