import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";

function logGoogleError(label: string, error: unknown) {
  const err = error as {
    message?: string;
    status?: number;
    code?: unknown;
    response?: { status?: number };
  };
  const status =
    err?.response?.status ??
    (typeof err?.status === "number" ? err.status : undefined) ??
    (typeof err?.code === "number" ? err.code : undefined);
  console.error(label, err?.message ?? "unknown", status !== undefined ? `status=${status}` : "");
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const calendarId = searchParams.get("calendarId") || "primary";

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logGoogleError("Delete event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete event" },
      { status: 500 }
    );
  }
}