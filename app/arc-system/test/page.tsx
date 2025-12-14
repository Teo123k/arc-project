"use client"

import { useState } from "react"

export default function ARCTestPage() {
  const [text, setText] = useState("")
  const [reply, setReply] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    setReply(null)

    try {
      const res = await fetch("/api/arc/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention: text }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.reply || "Request failed")
      }

      const data = await res.json()
      setReply(data.reply)
    } catch (e: any) {
      setError(e.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold">ARC Chat Test</h1>

      <textarea
        className="border rounded p-2 w-full min-h-[120px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Say something to ARC..."
      />

      <button
        onClick={submit}
        disabled={loading || !text.trim()}
        className="border rounded px-4 py-2 text-sm disabled:opacity-50"
      >
        {loading ? "Thinking..." : "Send to ARC"}
      </button>

      {error && <div className="text-sm text-red-600">Error: {error}</div>}

      {reply && (
        <div className="border rounded p-3 bg-gray-50 text-sm whitespace-pre-wrap">
          {reply}
        </div>
      )}
    </div>
  )
}
