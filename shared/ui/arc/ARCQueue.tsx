"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ARCQueueProps {
  lastResult: any | null;
}

export default function ARCQueue({ lastResult }: ARCQueueProps) {
  if (!lastResult) return null;

  return (
    <Card
      className="mt-3"
      style={{ borderColor: "#D0B89A", backgroundColor: "#F4E9DA" }}
    >
      <CardHeader className="py-2">
        <CardTitle
          className="text-xs font-semibold"
          style={{ color: "#8C6239" }}
        >
          Current ARC focus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p>
          <span className="font-semibold">Intention:</span>{" "}
          {lastResult.intention}
        </p>
        {lastResult.friction && (
          <p>
            <span className="font-semibold">Friction:</span>{" "}
            {lastResult.friction}
          </p>
        )}
        {lastResult.action && (
          <p>
            <span className="font-semibold">Next step:</span>{" "}
            {lastResult.action.title}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
