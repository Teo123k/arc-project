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

function extractFocusSoftly(text: string): string | null {
  if (!text) return null;

  const sentence = text
    .replace(/\n+/g, " ")
    .split(/[.!?]/)
    .map((s) => s.trim())
    .find((s) => s.length > 10);

  return sentence ? sentence.slice(0, 120) : null;
}

function extractNextStepSoftly(text: string): string | null {
  if (!text) return null;

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const candidate =
    lines.find((l) => /^(next|do this|try this|start with)/i.test(l)) ||
    lines.find((l) => /\b(today|now|first)\b/i.test(l)) ||
    lines[0];

  return candidate ? candidate.slice(0, 180) : null;
}

function humanizeReply(raw: string) {
  const clean = (raw || "").trim();

  const stripped = clean
    .replace(/^FOCUS:.*$/gim, "")
    .replace(/^DECISION:.*$/gim, "")
    .replace(/^PLAN:.*$/gim, "")
    .replace(/^STEPS:.*$/gim, "")
    .replace(/^NEXT:.*$/gim, "")
    .replace(/^CHAT:\s*/gim, "")
    .trim();

  return {
    message:
      stripped ||
      "Okay — tell me what you’re trying to get done, and I’ll guide you.",
    focus: extractFocusSoftly(clean),
    nextStep: extractNextStepSoftly(clean),
  };
}

export default function ARCChat({ onARCUpdate }: ARCChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // keep scroll pinned to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // keep input focused even after rerenders
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend() {
    if (sending) return;

    const userText = input.trim();
    if (!userText) return;

    // optimistic UI
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setInput("");
    setSending(true);

    // IMPORTANT: keep focus even while sending
    requestAnimationFrame(() => inputRef.current?.focus());

    try {
      const res = await fetch("/api/arc/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention: userText }),
      });

      const data = await res.json().catch(() => ({}));
      const raw = String(data?.reply ?? "");

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              raw ||
              "Something went wrong on my side. Let’s pause and try again.",
          },
        ]);
        return;
      }

      const { message, focus, nextStep } = humanizeReply(raw);

      if (onARCUpdate && (focus || nextStep)) {
        onARCUpdate({
          focus: focus ?? undefined,
          nextStep: nextStep ?? undefined,
        });
      }

      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong on my side. Let’s pause and try again.",
        },
      ]);
    } finally {
      setSending(false);
      // restore focus reliably
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col px-1 text-[13px]">
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
        // ✅ do NOT disable input; disabling is what commonly breaks focus
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSend();
          }
        }}
      />
    </div>
  );
}