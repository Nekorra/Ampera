let googleMapsPromise: Promise<any> | null = null

function getApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
}

export function loadGoogleMapsApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"))
  }

  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google)
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    return Promise.reject(
      new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
    )
  }

  if (googleMapsPromise) return googleMapsPromise

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("ampera-google-maps-api") as HTMLScriptElement | null

    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).google))
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps API")))
      return
    }

    const script = document.createElement("script")
    script.id = "ampera-google-maps-api"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => resolve((window as any).google)
    script.onerror = () => reject(new Error("Failed to load Google Maps API"))
    document.head.appendChild(script)
  })

  return googleMapsPromise
}
