import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 101 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '14R8qfqvV_1ikRvKgPeXhfnqIPol7Xg6IJN8kdxUkP5g';
    
    // Scan rows 5 to 35 on your Accounts tab to ensure all cells match smoothly
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Accounts!B5:E35',
    });

    const rows = response.data.values || [];
    
    let homeValue = 0;
    let helocBalance = 0;
    let primaryMortgage = 0;

    rows.forEach((row) => {
      const name = row[0]?.toLowerCase().trim() || '';
      // Column E balance is index 3 relative to column B
      const balanceStr = row[3] ? String(row[3]).replace(/[^0-9.-]/g, '') : '0';
      const balance = Math.abs(parseFloat(balanceStr) || 0);

      // Explicit string detection matching your exact sheet rows text labels
      if (name.includes('home') || name.includes('zestimate')) {
        if (balance > 0) homeValue = balance;
      } else if (name.includes('heloc') || name.includes('members 1st')) {
        if (balance > 0) helocBalance = balance;
      } else if (name.includes('wells fargo') || name.includes('mortgage')) {
        if (balance > 0) primaryMortgage = balance;
      }
    });

    return NextResponse.json({
      homeValue,
      helocBalance,
      primaryMortgage,
      lastUpdated: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }),
    });
  } catch (error: any) {
    console.error('Real estate tracking engine error:', error);
    return NextResponse.json({ error: error.message || 'Internal processing error' }, { status: 500 });
  }
}