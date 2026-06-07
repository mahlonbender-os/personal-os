import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const USER_ID = 'b0572935-26c9-44b5-8645-229bf5b78743';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: Fetch all warranties for the user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('warranties')
      .select('*')
      .eq('user_id', USER_ID)
      .order('expiration_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Add or update a warranty record
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, itemName, purchaseDate, expirationDate, vendor, cost, notes } = body;

    if (!itemName) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    
    const payload = {
      user_id: USER_ID,
      item_name: itemName,
      purchase_date: purchaseDate || null,
      expiration_date: expirationDate || null,
      vendor: vendor || null,
      cost: cost !== undefined && cost !== null ? Number(cost) : null,
      notes: notes || null,
    };

    let result;
    if (id) {
      // Update existing record
      result = await supabase
        .from('warranties')
        .update(payload)
        .eq('id', id)
        .eq('user_id', USER_ID)
        .select();
    } else {
      // Insert new record
      result = await supabase
        .from('warranties')
        .insert([payload])
        .select();
    }

    if (result.error) throw result.error;

    return NextResponse.json(result.data[0], {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a specific warranty record
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Warranty record ID is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('warranties')
      .delete()
      .eq('id', id)
      .eq('user_id', USER_ID);

    if (error) throw error;

    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}