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

    const location = lat && lng ? `${lat},${lng}` : '40.3356,-75.9269';

    const params = new URLSearchParams({
      input: input.trim(),
      key: apiKey,
      language: 'en',
      location,
      origin: location,
      rankby: 'distance',
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    );

    if (!res.ok) throw new Error('Places API request failed');

    const data = await res.json();

    // Get distance_meters from each prediction and sort by it
    const predictions = (data.predictions || [])
      .map((p: {
        place_id: string;
        description: string;
        distance_meters?: number;
        structured_formatting: {
          main_text: string;
          secondary_text: string;
        };
      }) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
        distanceMeters: p.distance_meters ?? 999999999,
      }))
      .sort((a: { distanceMeters: number }, b: { distanceMeters: number }) => 
        a.distanceMeters - b.distanceMeters
      );

    return NextResponse.json({ predictions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}