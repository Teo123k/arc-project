"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function ARCChatPage() {
  const params = useSearchParams()
  const router = useRouter()

  const intent = params.get("intent")

  const [reply, setReply] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!intent) {
      router.replace("/arc-system/intent")
    }
  }, [intent, router])

  async function start() {
    if (!intent) return

    setLoading(true)

    const res = await fetch("/api/arc/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: intent }],
      }),
    })

    const data = await res.json()
    setReply(data.reply)
    setLoading(false)
  }

  if (!intent) {
    return null
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">ARC</h1>
      <p className="text-sm text-gray-500">Intent: {intent}</p>

      <button
        onClick={start}
        disabled={loading}
        className="border rounded px-4 py-2 text-sm"
      >
        {loading ? "Thinking..." : "Start"}
      </button>

      {reply && (
        <div className="border rounded p-3 bg-gray-50 text-sm whitespace-pre-wrap">
          {reply}
        </div>
      )}
    </div>
  )
}
