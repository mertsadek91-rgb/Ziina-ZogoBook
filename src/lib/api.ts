import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(err: unknown, status = 400) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status });
  }
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status });
}
