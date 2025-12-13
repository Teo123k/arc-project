"use client";

interface Message {
  role: "user" | "arc";
  content: string;
}

export default function ARCChatMessages({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col justify-end h-full space-y-2 overflow-y-auto pb-4">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`max-w-[90%] px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
            m.role === "user"
              ? "self-end bg-[#D8C5A3] text-black"
              : "self-start bg-[#F1D7B6] text-[#4A331D]"
          }`}
        >
          {m.content}
        </div>
      ))}
    </div>
  );
}
