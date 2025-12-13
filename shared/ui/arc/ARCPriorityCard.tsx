"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ARCPriorityCardProps {
  result: any | null;
}

export default function ARCPriorityCard({ result }: ARCPriorityCardProps) {
  if (!result || !result.priority) return null;

  const { level, score, reason } = result.priority;

  return (
    <Card
      className="text-xs"
      style={{
        borderColor: "#D0B89A",
        backgroundColor: "#F2E5D2",
      }}
    >
      <CardHeader className="py-2">
        <CardTitle
          className="text-xs font-semibold"
          style={{ color: "#8C6239" }}
        >
          Priority
        </CardTitle>
      </CardHeader>
      <CardContent className="py-1 space-y-1">
        <p className="font-semibold">
          {level} <span className="text-[11px]">({score}/100)</span>
        </p>
        <p className="text-[11px] text-gray-700">{reason}</p>
      </CardContent>
    </Card>
  );
}
