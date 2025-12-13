"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface RecommendationCardProps {
  title: string;
  description: string;
  onComplete?: () => void;
}

export default function RecommendationCard({
  title,
  description,
  onComplete,
}: RecommendationCardProps) {
  return (
    <Card
      style={{
        backgroundColor: "#F1D7B6",
        borderColor: "#D0B89A",
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm" style={{ color: "#8C6239" }}>
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
            onClick={onComplete}
          >
            Mark this step as done
          </Button>
          <Button
            variant="outline"
            className="w-full border border-[#B07F4E]"
            style={{ color: "#8C6239" }}
          >
            Break it into smaller steps
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}