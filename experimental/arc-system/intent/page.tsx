"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Domain = {
  label: string
  intents: {
    label: string
    payload: string
    description: string
  }[]
}

const DOMAINS: Domain[] = [
  {
    label: "Business",
    intents: [
      {
        label: "Find a low-risk idea",
        description: "I want a realistic business idea with low cost and risk.",
        payload: "Find a realistic, low-risk business idea and explain why it makes sense."
      },
      {
        label: "Choose a direction",
        description: "I have options but don’t know which to commit to.",
        payload: "Help me choose a business direction and recommend one path."
      },
      {
        label: "Plan execution",
        description: "I already have an idea and want to execute it.",
        payload: "Create a clear execution plan for my business idea."
      }
    ]
  },
  {
    label: "Life",
    intents: [
      {
        label: "Clarify goals",
        description: "I feel stuck and want clarity on what to focus on.",
        payload: "Help me clarify my priorities and decide what to focus on next."
      },
      {
        label: "Make a decision",
        description: "I’m torn between options.",
        payload: "Help me evaluate options and recommend a decision."
      }
    ]
  },
  {
    label: "Learning",
    intents: [
      {
        label: "Choose what to learn",
        description: "I want to learn something useful but don’t know what.",
        payload: "Help me decide what skill or topic to learn next."
      }
    ]
  }
]

export default function ARCIntentSelector() {
  const router = useRouter()
  const [domain, setDomain] = useState<Domain | null>(null)

  function startIntent(payload: string) {
    router.push(`/arc-system/chat?intent=${encodeURIComponent(payload)}`)
  }

  if (!domain) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold">Choose an area</h1>
        <p className="text-sm text-gray-500">
          What area do you want help with right now?
        </p>

        {DOMAINS.map((d) => (
          <button
            key={d.label}
            onClick={() => setDomain(d)}
            className="w-full border rounded p-4 text-left hover:bg-gray-50"
          >
            {d.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <button
        onClick={() => setDomain(null)}
        className="text-sm text-gray-500 underline"
      >
        ← Back
      </button>

      <h1 className="text-xl font-semibold">{domain.label}</h1>

      {domain.intents.map((i) => (
        <button
          key={i.label}
          onClick={() => startIntent(i.payload)}
          className="w-full border rounded p-4 text-left hover:bg-gray-50 space-y-1"
        >
          <div className="font-medium">{i.label}</div>
          <div className="text-sm text-gray-500">{i.description}</div>
        </button>
      ))}
    </div>
  )
}
