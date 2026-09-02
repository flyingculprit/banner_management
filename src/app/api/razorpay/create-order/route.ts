import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { amount, spaceId, durationMonths, advertiserId } = await req.json();

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Razorpay keys not configured' }, { status: 500 });
    }

    const instance = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        spaceId: String(spaceId),
        durationMonths: String(durationMonths || 1),
        advertiserId: String(advertiserId || ''),
      },
    };

    const order = await instance.orders.create(options);
    return NextResponse.json(order);
  } catch (error: any) {
    console.error('[Create Order Error]:', error);
    return NextResponse.json({ error: error.message || 'Order creation failed' }, { status: 500 });
  }
}