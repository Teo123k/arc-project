"use client";
import { useState } from "react";

export default function EmailWidget() {
  const [expanded, setExpanded] = useState(false);
  const [full, setFull] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("friendly");
  const [recipients, setRecipients] = useState("");

  // ---------------- SMALL STATE ----------------
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        className="w-[160px] h-[120px] bg-white shadow-sm rounded-xl border border-neutral-200 p-3 cursor-pointer hover:shadow-md transition"
      >
        <div className="text-xl">✉️</div>
        <div className="font-semibold text-neutral-700 text-sm">Email Drafting</div>
        <div className="text-xs text-neutral-500 mt-1">Tap to open</div>
      </div>
    );
  }

  // ---------------- MEDIUM STATE ----------------
  if (!full) {
    return (
      <div className="w-full max-w-[420px] bg-white shadow-md rounded-xl border p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-bold">✉️ Email Drafting</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setFull(true)}
              className="text-xs px-2 py-1 rounded bg-neutral-200 hover:bg-neutral-300"
            >
              Expand
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="text-xs px-2 py-1 rounded bg-neutral-200 hover:bg-neutral-300"
            >
              Collapse
            </button>
          </div>
        </div>

        <input
          className="border rounded p-2 text-sm w-full mb-3"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <textarea
          className="border rounded p-2 text-sm w-full h-[100px] mb-3"
          placeholder="Write your message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="flex gap-3 mb-3 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={tone === "friendly"} onChange={() => setTone("friendly")} />
            Friendly
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={tone === "professional"} onChange={() => setTone("professional")} />
            Professional
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={tone === "persuasive"} onChange={() => setTone("persuasive")} />
            Persuasive
          </label>
        </div>

        <input
          className="border rounded p-2 text-sm w-full mb-3"
          placeholder="Recipients (comma separated)"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
        />

        <button className="px-4 py-2 rounded bg-neutral-900 text-white hover:bg-neutral-700 w-full">
          Rewrite Email with ARC
        </button>
      </div>
    );
  }

  // ---------------- FULL STATE ----------------
  return (
    <div className="w-full max-w-[680px] bg-white shadow-lg rounded-xl border p-5 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold">✉️ Advanced Email Workspace</h3>
        <button
          onClick={() => setFull(false)}
          className="text-xs px-2 py-1 rounded bg-neutral-200 hover:bg-neutral-300"
        >
          Back
        </button>
      </div>

      <p className="text-sm text-neutral-700 mb-4">
        Full email workflow tools (n8n sending pipeline, templates, contact management) will appear here.
      </p>

      <div className="p-4 rounded border border-neutral-300 text-sm text-neutral-500">
        (Full UI placeholder — ready for automation integration)
      </div>
    </div>
  );
}
