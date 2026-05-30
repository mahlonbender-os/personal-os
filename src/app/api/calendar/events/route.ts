import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysAhead = parseInt(searchParams.get("days") || "14");

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + daysAhead);

    // Get list of all calendars first
    const calListResponse = await calendar.calendarList.list();
    const calendars = calListResponse.data.items || [];

    // Fetch events from all calendars
    const allEvents: any[] = [];

    for (const cal of calendars) {
      if (!cal.id) continue;
      try {
        const eventsResponse = await calendar.events.list({
          calendarId: cal.id,
          timeMin: now.toISOString(),
          timeMax: future.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });

        const events = eventsResponse.data.items || [];
        events.forEach((event) => {
          allEvents.push({
            id: event.id,
            calendarId: cal.id,
            calendarName: cal.summary,
            calendarColor: cal.backgroundColor,
            title: event.summary || "(No title)",
            description: event.description || null,
            location: event.location || null,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            allDay: !event.start?.dateTime,
            status: event.status,
            htmlLink: event.htmlLink,
          });
        });
      } catch (e) {
        // Skip calendars we can't read
        console.error(`Error fetching calendar ${cal.id}:`, e);
      }
    }

    // Sort all events by start time
    allEvents.sort((a, b) => {
      const aTime = new Date(a.start).getTime();
      const bTime = new Date(b.start).getTime();
      return aTime - bTime;
    });

    return NextResponse.json({ events: allEvents, calendars });
  } catch (error: any) {
    console.error("Calendar events error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch events" },
      { status: 500 }
    );
  }
}