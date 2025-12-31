"use client";

interface ARCOutputProps {
  result: any;
}

export default function ArcOutput({ result }: ARCOutputProps) {
  if (!result) return null;

  return (
    <div className="p-4 space-y-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-bold">ARC Pipeline Output</h2>

      <div className="p-3 border rounded-md bg-slate-50">
        <h3 className="font-semibold">Intention</h3>
        <p>{result.intention}</p>
      </div>

      <div className="p-3 border rounded-md bg-slate-50">
        <h3 className="font-semibold">Friction</h3>
        <p>{result.friction || "None"}</p>
      </div>

      <div className="p-3 border rounded-md bg-slate-50">
        <h3 className="font-semibold">Priority</h3>
        <p>{result.priority.level} ({result.priority.score}/100)</p>
        <small className="text-gray-600">{result.priority.reason}</small>
      </div>

      <div className="p-3 border rounded-md bg-slate-50">
        <h3 className="font-semibold">Next Action</h3>
        <p className="font-medium">{result.action.title}</p>
        <small className="text-gray-600">{result.action.description}</small>
      </div>

      <div className="p-3 border rounded-md bg-slate-50">
        <h3 className="font-semibold">Cognitive Options</h3>
        <ul className="list-disc list-inside text-sm">
          {result.reasoning.options.map((opt: string, index: number) => (
            <li key={index}>{opt}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
