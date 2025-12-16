"use client"

import { useRouter } from "next/navigation"

export default function ARCTestDisabled() {
  const router = useRouter()

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">ARC</h1>
      <p className="text-sm text-gray-500">
        Direct chat is disabled. Please choose an intent first.
      </p>

      <button
        onClick={() => router.push("/arc-system/intent")}
        className="border rounded px-4 py-2 text-sm"
      >
        Choose Intent
      </button>
    </div>
  )
}
