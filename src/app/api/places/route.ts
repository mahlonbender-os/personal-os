import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get('input');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!input || input.trim().length < 2) {
      return NextResponse.json({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error('Maps API key not configured');

    const params = new URLSearchParams({
      input: input.trim(),
      key: apiKey,
      language: 'en',
    });

    // If we have coordinates, bias results toward that location
    // radius is in meters — 50000 = ~31 miles
    if (lat && lng) {
      params.set('location', `${lat},${lng}`);
      params.set('radius', '50000');
    }

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    );

    if (!res.ok) throw new Error('Places API request failed');

    const data = await res.json();

    const predictions = (data.predictions || []).map((p: {
      place_id: string;
      description: string;
      structured_formatting: {
        main_text: string;
        secondary_text: string;
      };
    }) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));

    return NextResponse.json({ predictions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}