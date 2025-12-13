import { NextResponse } from "next/server"
import { createClient } from "@/supabase/server"
import type { Database } from "@/types/supabase"

export async function POST(req: Request) {
  const { text } = await req.json()

  if (!text) {
    return NextResponse.json({ error: "No intention text provided" }, { status: 400 })
  }

  const supabase = createClient<Database>()

  const { data, error } = await supabase
    .from("arc_intentions")
    .insert({
      intention: text,
      friction: null,
      action: null,
      priority: null,
      status: "captured"
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
