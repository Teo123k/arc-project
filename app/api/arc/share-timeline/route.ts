import { NextRequest, NextResponse } from "next/server";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type OperationStep = {
  id: string;
  time: string;
  task: string;
  duration: string;
  notes?: string;
  category?: "prep" | "cooking" | "service" | "cleanup";
  assignedTo?: string;
};

type ChefAssignment = {
  id: string;
  name: string;
  role: "head" | "chef" | "assistant";
};

type TimelineSharePayload = {
  eventName: string;
  eventDate?: string;
  serviceStart?: string;
  serviceEnd?: string;
  guestCount?: number;
  operations: OperationStep[];
  chefs: ChefAssignment[];
  taskAssignments: Record<string, string>;
};

// ────────────────────────────────────────────────────────────────────────────
// In-memory store for shared timelines (for demo purposes)
// In production, this would use a database or KV store
// ────────────────────────────────────────────────────────────────────────────

const sharedTimelines = new Map<string, { data: TimelineSharePayload; createdAt: number }>();

// Generate a short, URL-safe ID
function generateShareId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Clean up expired timelines (older than 7 days)
function cleanupExpiredTimelines() {
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  for (const [id, entry] of sharedTimelines.entries()) {
    if (now - entry.createdAt > maxAge) {
      sharedTimelines.delete(id);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST — Create a shareable timeline link
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as TimelineSharePayload;
    
    // Validate required fields
    if (!body.eventName || !body.operations || !Array.isArray(body.operations)) {
      return NextResponse.json(
        { error: "Invalid timeline data: eventName and operations are required" },
        { status: 400 }
      );
    }
    
    // Clean up old timelines
    cleanupExpiredTimelines();
    
    // Generate unique share ID
    let shareId = generateShareId();
    while (sharedTimelines.has(shareId)) {
      shareId = generateShareId();
    }
    
    // Store the timeline
    sharedTimelines.set(shareId, {
      data: {
        eventName: body.eventName,
        eventDate: body.eventDate,
        serviceStart: body.serviceStart,
        serviceEnd: body.serviceEnd,
        guestCount: body.guestCount,
        operations: body.operations,
        chefs: body.chefs || [],
        taskAssignments: body.taskAssignments || {},
      },
      createdAt: Date.now(),
    });
    
    // Build share URL
    const baseUrl = req.headers.get("origin") || "http://localhost:3000";
    const shareUrl = `${baseUrl}/timeline/${shareId}`;
    
    return NextResponse.json({
      success: true,
      shareId,
      shareUrl,
      expiresIn: "7 days",
    });
  } catch (error) {
    console.error("[share-timeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to create shareable link" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET — Retrieve a shared timeline by ID
// ────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get("id");
    
    if (!shareId) {
      return NextResponse.json(
        { error: "Share ID is required" },
        { status: 400 }
      );
    }
    
    const entry = sharedTimelines.get(shareId);
    
    if (!entry) {
      return NextResponse.json(
        { error: "Timeline not found or has expired" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      timeline: entry.data,
      createdAt: entry.createdAt,
    });
  } catch (error) {
    console.error("[share-timeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve timeline" },
      { status: 500 }
    );
  }
}

