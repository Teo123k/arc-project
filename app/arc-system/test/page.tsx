"use client"

import { useState } from "react"

export default function ARCTestPage() {
  const [text, setText] = useState<string>("")
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/intention/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Request failed")
      }

      const data = await res.json()
      setResponse(data)
    } catch (e: any) {
      setError(e.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold">ARC Intention Capture Test</h1>
      <p className="text-sm text-gray-500">
        Type an intention and send it to ARC. It will be stored in Supabase via /api/intention/capture.
      </p>
      <textarea
        className="border rounded p-2 w-full min-h-[120px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe your intention here..."
      />
      <button
        onClick={submit}
        disabled={loading || !text.trim()}
        className="border rounded px-4 py-2 text-sm disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send to ARC"}
      </button>
      {error && (
        <div className="text-sm text-red-600">
          Error: {error}
        </div>
      )}
      {response && (
        <pre className="text-xs bg-gray-100 rounded p-2 overflow-x-auto">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  )
}
