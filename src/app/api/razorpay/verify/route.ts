import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Helper: Verify valid email format and ignore dummy domains/placeholders
function isValidDeliverableEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const cleaned = email.trim().toLowerCase();

  // Strict email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleaned)) return false;

  // Block commonly used dummy placeholders
  const dummyBlocklist = [
    'admin@gmail.com',
    'test@gmail.com',
    'example@gmail.com',
    'dummy@gmail.com',
    'user@gmail.com',
  ];

  if (dummyBlocklist.includes(cleaned)) {
    console.warn(`[Email Validator] Skipped deliverability for dummy email address: ${cleaned}`);
    return false;
  }

  return true;
}

export async function POST(req: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      space_id,
      advertiser_id,
      duration_months,
      total_amount,
    } = await req.json();

    console.log('[Payment Verify] Received verification request:', {
      razorpay_order_id,
      razorpay_payment_id,
      space_id,
      advertiser_id,
      total_amount,
    });

    // 1. Verify payment signature
    if (process.env.RAZORPAY_KEY_SECRET && razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
      }
    }

    const supabaseAdmin = getAdminSupabase();

    // 2. Insert active booking record
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .insert({
        space_id,
        advertiser_id,
        duration_months: Number(duration_months) || 1,
        total_amount: Number(total_amount),
        payment_status: 'paid',
        payment_id: razorpay_payment_id,
        status: 'active',
      })
      .select()
      .single();

    if (bookingErr) {
      console.error('[Payment Verify] Booking insert error:', bookingErr);
      return NextResponse.json({ error: bookingErr.message }, { status: 500 });
    }

    // 3. Mark billboard space as rented
    await supabaseAdmin
      .from('spaces')
      .update({ is_rented: true })
      .eq('id', space_id);

    // 4. Retrieve Space, Owner, and Advertiser details
    const { data: spaceData } = await supabaseAdmin
      .from('spaces')
      .select('area, city, owner_id')
      .eq('id', space_id)
      .single();

    let ownerEmail: string | null = null;
    let ownerName: string = 'Billboard Owner';
    let advertiserEmail: string | null = null;
    let advertiserName: string = 'Advertiser';

    // Fetch Owner Information
    if (spaceData?.owner_id) {
      const { data: ownProf } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', spaceData.owner_id)
        .maybeSingle();

      ownerName = ownProf?.full_name || ownerName;
      ownerEmail = ownProf?.email || null;

      if (!ownerEmail) {
        const { data: ownAuth } = await supabaseAdmin.auth.admin.getUserById(spaceData.owner_id);
        ownerEmail = ownAuth?.user?.email || null;
      }
    }

    // Fetch Advertiser Information
    if (advertiser_id) {
      const { data: advProf } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', advertiser_id)
        .maybeSingle();

      advertiserName = advProf?.full_name || advertiserName;
      advertiserEmail = advProf?.email || null;

      if (!advertiserEmail) {
        const { data: advAuth } = await supabaseAdmin.auth.admin.getUserById(advertiser_id);
        advertiserEmail = advAuth?.user?.email || null;
      }
    }

    // Admin email configuration with fallback to SMTP_USER to avoid dummy failure
    const rawAdminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    const adminEmail = isValidDeliverableEmail(rawAdminEmail) ? rawAdminEmail : process.env.SMTP_USER;

    const refNumber = booking.id ? String(booking.id).slice(0, 8).toUpperCase() : 'N/A';
    const area = spaceData?.area || 'Prime Location';
    const city = spaceData?.city || 'City Center';
    const billDate = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    console.log('[Payment Verify] Resolved Recipients:', {
      advertiser: { email: advertiserEmail, valid: isValidDeliverableEmail(advertiserEmail) },
      owner: { email: ownerEmail, valid: isValidDeliverableEmail(ownerEmail) },
      admin: { email: adminEmail, valid: isValidDeliverableEmail(adminEmail) },
    });

    const emailTasks: Promise<any>[] = [];

    // Email 1: Invoice to Advertiser
    if (isValidDeliverableEmail(advertiserEmail)) {
      emailTasks.push(
        transporter.sendMail({
          from: `"AdFlex Platform" <${process.env.SMTP_USER}>`,
          to: advertiserEmail!,
          subject: `Payment Invoice #${refNumber} - ${area}, ${city}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #4f46e5; margin: 0 0 8px 0;">Payment Receipt & Booking Confirmed</h2>
              <p style="font-size: 14px;">Hi <strong>${advertiserName}</strong>, your payment of <strong>₹${Number(total_amount).toLocaleString('en-IN')}</strong> has been received and verified.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; line-height: 1.8;">
                <div><strong>Invoice Ref:</strong> #${refNumber}</div>
                <div><strong>Space Location:</strong> ${area}, ${city}</div>
                <div><strong>Booking Term:</strong> ${duration_months} Month(s)</div>
                <div><strong>Payment Transaction ID:</strong> ${razorpay_payment_id}</div>
                <div><strong>Billing Date:</strong> ${billDate}</div>
              </div>
              
              <p style="font-size: 12px; color: #64748b;">You can track this billboard rental directly from your advertiser dashboard.</p>
            </div>
          `,
        })
      );
    }

    // Email 2: Rental Notice to Owner
    if (isValidDeliverableEmail(ownerEmail)) {
      emailTasks.push(
        transporter.sendMail({
          from: `"AdFlex Bookings" <${process.env.SMTP_USER}>`,
          to: ownerEmail!,
          subject: `[Billboard Rented] Payment Received for ${area}, ${city}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #15803d; margin: 0 0 8px 0;">Your Billboard Space Has Been Booked!</h2>
              <p style="font-size: 14px;">Hi <strong>${ownerName}</strong>,</p>
              <p style="font-size: 14px;">An advertiser has rented your billboard at <strong>${area}, ${city}</strong> for <strong>${duration_months} Month(s)</strong>.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; line-height: 1.8;">
                <div><strong>Booking Ref:</strong> #${refNumber}</div>
                <div><strong>Contract Value:</strong> ₹${Number(total_amount).toLocaleString('en-IN')}</div>
                <div><strong>Tenant:</strong> ${advertiserName} (${advertiserEmail || 'N/A'})</div>
                <div><strong>Escrow Status:</strong> Secured & Verified</div>
              </div>

              <p style="font-size: 12px; color: #64748b;">Visit your dashboard to coordinate flex delivery with the advertiser.</p>
            </div>
          `,
        })
      );
    }

    // Email 3: Audit Copy to Admin
    if (isValidDeliverableEmail(adminEmail)) {
      emailTasks.push(
        transporter.sendMail({
          from: `"AdFlex Alerts" <${process.env.SMTP_USER}>`,
          to: adminEmail!,
          subject: `[Admin Alert] Billboard Rented #${refNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h3 style="color: #0f172a; margin-top: 0;">New Billboard Rental Completed</h3>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.8;">
                <div><strong>Booking Reference:</strong> #${refNumber}</div>
                <div><strong>Board Space:</strong> ${area}, ${city}</div>
                <div><strong>Gross Amount:</strong> ₹${Number(total_amount).toLocaleString('en-IN')}</div>
                <div><strong>Advertiser:</strong> ${advertiserName} (${advertiserEmail || 'No Email'})</div>
                <div><strong>Space Owner:</strong> ${ownerName} (${ownerEmail || 'No Email'})</div>
                <div><strong>Transaction ID:</strong> ${razorpay_payment_id}</div>
              </div>
            </div>
          `,
        })
      );
    }

    // Use allSettled so one rejected email never stops the others
    const results = await Promise.allSettled(emailTasks);
    results.forEach((res, index) => {
      if (res.status === 'rejected') {
        console.error(`[Email Error] Task ${index} failed:`, res.reason);
      }
    });

    return NextResponse.json({ success: true, booking });
  } catch (err: any) {
    console.error('[Payment Verify] Server error:', err);
    return NextResponse.json({ error: err.message || 'Payment processing failed' }, { status: 500 });
  }
}