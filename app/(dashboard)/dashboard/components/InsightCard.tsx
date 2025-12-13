"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface InsightCardProps {
  focus: string;
  friction: string;
}

export default function InsightCard({ focus, friction }: InsightCardProps) {
  return (
    <Card
      style={{
        backgroundColor: "#F6EBDD",
        borderColor: "#DFC9AA",
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm" style={{ color: "#7A5430" }}>
          ARC Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>
          <span className="font-semibold">Focus:</span> {focus}
        </p>
        <p>
          <span className="font-semibold">Friction:</span>{" "}
          {friction || "None detected"}
        </p>
      </CardContent>
    </Card>
  );
}