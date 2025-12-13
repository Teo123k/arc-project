"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ARCActionPanelProps {
  result: any | null;
}

export default function ARCActionPanel({ result }: ARCActionPanelProps) {
  if (!result || !result.action) return null;

  const { title, description } = result.action;

  return (
    <Card
      style={{
        borderColor: "#D0B89A",
        backgroundColor: "#F1D7B6",
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle style={{ color: "#8C6239" }} className="text-sm">
          ARC recommends this next
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-gray-800 mt-1">{description}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full border border-[#B07F4E]"
            style={{ backgroundColor: "#B07F4E", color: "white" }}
          >
            Take this action
          </Button>
          <Button
            variant="outline"
            className="w-full border border-[#B07F4E]"
            style={{ color: "#8C6239" }}
          >
            Break into smaller steps
          </Button>
          <Button
            variant="outline"
            className="w-full border border-[#C4A484]"
            style={{ color: "#8C6239" }}
          >
            Save for later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
