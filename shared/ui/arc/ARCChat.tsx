"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

export interface ARCUpdate {
  focus?: string;
  nextStep?: string;
}

interface ARCChatProps {
  onARCUpdate?: (update: ARCUpdate) => void;
}

/* ---------- helpers ---------- */

function extractFocusSoftly(text: string): string | null {
  const sentence = text
    .replace(/\n+/g, " ")
    .split(/[.!?]/)
    .map(s => s.trim())
    .find(s => s.length > 10);

  return sentence ? sentence.slice(0, 120) : null;
}

function extractNextStepSoftly(text: string): string | null {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  return lines[0] ? lines[0].slice(0, 180) : null;
}

function humanizeReply(raw: string) {
  if (!raw) {
    return {
      message: "",
      focus: null,
      nextStep: null,
    };
  }

  const clean = raw.trim();

  let text = clean
    .replace(/^(FOCUS|DECISION|PLAN|NEXT|CHAT):?/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Soften overly formal or system-like opening phrases
  text = text.replace(
    /^(Sure\.?|Certainly\.?|Of course\.?|Absolutely\.?|Let's begin\.?|Let us begin\.?|Here's the plan\.?|Here is the plan\.?)/i,
    ""
  );

  // Normalize casual human openings
  text = text.replace(/^(Hi\.?|Hello\.?|Hey\.?)\s+/i, "Hey — ");

  text = text.trim();

  // Remove common robotic openers that repeat across replies
  text = text.replace(
    /^(Alright|Okay|Sure|Let's)\b[^\n]*\n?/i,
    ""
  );

  // De-duplicate repeated sentences (exact or near-exact)
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const s of sentences) {
    const key = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(s);
    }
  }

  text = deduped.join(" ").trim();

  return {
    message:
      text || "Hey — what's on your mind?",
    focus: extractFocusSoftly(clean),
    nextStep: extractNextStepSoftly(clean),
  };
}

/* ---------- component ---------- */

export default function ARCChat({ onARCUpdate }: ARCChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* keep scroll pinned */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* keep input focused */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function callARC(userText: string) {
    return fetch("/api/arc/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: userText }
        ],
      }),
    });
  }

  async function handleSend() {
    if (sending) return;

    const userText = input.trim();
    if (!userText) return;

    // optimistic UI
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    setInput("");
    setSending(true);

    requestAnimationFrame(() => inputRef.current?.focus());

    try {
      let res = await callARC(userText);

      // 🔁 ONE safe retry for dev-mode 404 / 405
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        await new Promise(r => setTimeout(r, 300));
        res = await callARC(userText);
      }

      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content:
              "I briefly lost connection. Say that again and we’ll continue.",
          },
        ]);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const raw = String(data?.reply ?? "");

      const { message, focus, nextStep } = humanizeReply(raw);

      if (onARCUpdate && (focus || nextStep)) {
        onARCUpdate({
          focus: focus ?? undefined,
          nextStep: nextStep ?? undefined,
        });
      }

      setMessages(prev => [...prev, { role: "assistant", content: message }]);
    } catch (err) {
      console.error("ARC chat error:", err);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something briefly interrupted me. Let’s keep going.",
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto flex flex-col px-1 text-[13px]">
        <div className="flex-1" />

        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded-md max-w-[90%] mb-2 whitespace-pre-line ${
              m.role === "user"
                ? "self-end bg-[#D8C5A3] text-black"
                : "self-start bg-[#F1D7B6] text-[#4A331D]"
            }`}
          >
            {m.content}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <input
        ref={inputRef}
        className="border rounded p-2 mt-3 text-black"
        placeholder={sending ? "ARC is thinking..." : "Talk to ARC..."}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSend();
          }
        }}
      />
    </div>
  );
}