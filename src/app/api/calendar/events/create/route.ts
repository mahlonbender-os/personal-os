import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, location, start, end, allDay, calendarId } = body;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const event: any = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
    };

    if (allDay) {
      event.start = { date: start };
      event.end = { date: end };
    } else {
      event.start = { dateTime: start, timeZone: "America/New_York" };
      event.end = { dateTime: end, timeZone: "America/New_York" };
    }

    const response = await calendar.events.insert({
      calendarId: calendarId || "primary",
      requestBody: event,
    });

    return NextResponse.json({ event: response.data });
  } catch (error: any) {
    console.error("Create event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create event" },
      { status: 500 }
    );
  }
}