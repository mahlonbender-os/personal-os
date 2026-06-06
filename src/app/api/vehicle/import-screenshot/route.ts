import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { imageBase64, imageType, importType } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const fuelPrompt = `Extract all fuel fill-up records from this screenshot image. This may be from GasBuddy, a fuel tracking app, or any fuel log.

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
Each object must have these exact fields:
- date: string in YYYY-MM-DD format (estimate year as 2025 or 2026 if unclear from context)
- gallons: number or null (total gallons pumped)
- price_per_gallon: number or null (price per gallon, e.g. 3.459)
- total_cost: number or null (total dollar amount paid)
- odometer: number or null (odometer reading in miles)
- station: string or null (gas station name and/or location)

Use null for any field not visible in the image. If no records are found, return [].`;

    const maintPrompt = `Extract all vehicle maintenance or service records from this screenshot image. This may be from Carfax, a dealership service history, AutoCare, or any maintenance tracking app.

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
Each object must have these exact fields:
- date: string in YYYY-MM-DD format (estimate year if unclear)
- service_type: string — choose the closest match from this list: Oil Change, Tire Rotation, Tire Replacement, Brake Service, Air Filter, Cabin Filter, Battery Replacement, Transmission Service, Coolant Flush, Inspection, Registration / Tags, Wiper Blades, Detailing, Alignment, Spark Plugs, Other
- mileage: number or null (odometer/mileage at time of service)
- cost: number or null (dollar amount paid)
- shop: string or null (shop or dealership name)
- notes: string or null (any additional details about the service)

Use null for any field not visible in the image. If no records are found, return [].`;

    const prompt = importType === 'fuel' ? fuelPrompt : maintPrompt;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageType || 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return NextResponse.json(
        { error: `Claude API error: ${anthropicRes.status}`, detail: errText },
        { status: 500 }
      );
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.find((c: any) => c.type === 'text')?.text || '[]';

    // Strip markdown fences if Claude added them despite instructions
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let records: any[];
    try {
      records = JSON.parse(cleaned);
      if (!Array.isArray(records)) records = [records];
    } catch {
      return NextResponse.json(
        { error: 'Could not parse AI response as JSON', raw: rawText },
        { status: 422 }
      );
    }

    // Sanitize: ensure required fields have sensible types
    const sanitized = records.map((r: any) => {
      if (importType === 'fuel') {
        return {
          date: typeof r.date === 'string' ? r.date : null,
          gallons: r.gallons != null ? Number(r.gallons) : null,
          price_per_gallon: r.price_per_gallon != null ? Number(r.price_per_gallon) : null,
          total_cost: r.total_cost != null ? Number(r.total_cost) : null,
          odometer: r.odometer != null ? Math.round(Number(r.odometer)) : null,
          station: typeof r.station === 'string' ? r.station : null,
        };
      } else {
        return {
          date: typeof r.date === 'string' ? r.date : null,
          service_type: typeof r.service_type === 'string' ? r.service_type : 'Other',
          mileage: r.mileage != null ? Math.round(Number(r.mileage)) : null,
          cost: r.cost != null ? Number(r.cost) : null,
          shop: typeof r.shop === 'string' ? r.shop : null,
          notes: typeof r.notes === 'string' ? r.notes : null,
        };
      }
    });

    return NextResponse.json(
      { records: sanitized },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}