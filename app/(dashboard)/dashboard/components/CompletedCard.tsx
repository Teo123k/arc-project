"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function CompletedCard() {
  return (
    <Card
      className="mt-3"
      style={{
        backgroundColor: "#E2F3D9",
        borderColor: "#B6D8A8",
      }}
    >
      <CardContent className="py-3 text-xs text-gray-800">
        🎉 Nice. You completed a step. You just moved one layer closer to your
        intention.
      </CardContent>
    </Card>
  );
}