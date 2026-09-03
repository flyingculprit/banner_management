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

function isValidDeliverableEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const cleaned = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(cleaned);
}

export async function POST(req: Request) {
  try {
    let razorpay_order_id = '';
    let razorpay_payment_id = '';
    let razorpay_signature = '';
    let space_id = '';
    let advertiser_id = '';
    let duration_months = 1;
    let total_amount = 0;
    let banner_image_url: string | null = null;
    let isFormRedirect = false;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      razorpay_order_id = body.razorpay_order_id;
      razorpay_payment_id = body.razorpay_payment_id;
      razorpay_signature = body.razorpay_signature;
      space_id = body.space_id;
      advertiser_id = body.advertiser_id;
      duration_months = Number(body.duration_months) || 1;
      total_amount = Number(body.total_amount) || 0;
      banner_image_url = body.banner_image_url || null;
    } else {
      isFormRedirect = true;
      const formData = await req.formData();
      razorpay_order_id = formData.get('razorpay_order_id') as string;
      razorpay_payment_id = formData.get('razorpay_payment_id') as string;
      razorpay_signature = formData.get('razorpay_signature') as string;
      banner_image_url = (formData.get('banner_image_url') as string) || null;
    }

    console.log('[Payment Verify Route] Processing payment:', {
      razorpay_payment_id,
      razorpay_order_id,
      space_id,
      banner_image_url,
    });

    const supabaseAdmin = getAdminSupabase();

    // 1. Signature verification
    if (process.env.RAZORPAY_KEY_SECRET && razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        console.error('[Payment Verify] Signature mismatch');
        if (isFormRedirect) {
          return NextResponse.redirect(new URL('/dashboard/advertiser?error=invalid_signature', req.url));
        }
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
      }
    }

    // Resolve space fallback if redirect payload is missing IDs
    if (!space_id || !advertiser_id) {
      const { data: recentSpaces } = await supabaseAdmin
        .from('spaces')
        .select('*')
        .eq('is_rented', false)
        .limit(1);
      if (recentSpaces && recentSpaces.length > 0) {
        space_id = space_id || recentSpaces[0].id;
        total_amount = total_amount || recentSpaces[0].monthly_rate * duration_months;
      }
    }

    // Compute start_date and end_date to satisfy NOT NULL constraints
    const startDateObj = new Date();
    const endDateObj = new Date();
    endDateObj.setMonth(endDateObj.getMonth() + (Number(duration_months) || 1));

    const start_date = startDateObj.toISOString().split('T')[0];
    const end_date = endDateObj.toISOString().split('T')[0];

    // 2. Insert booking record with banner creative image and required dates
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .insert({
        space_id,
        advertiser_id: advertiser_id || null,
        duration_months: Number(duration_months) || 1,
        total_amount: Number(total_amount),
        payment_status: 'paid',
        payment_id: razorpay_payment_id,
        status: 'active',
        start_date,
        end_date,
        banner_image_url: banner_image_url,
        ad_image_url: banner_image_url,
      })
      .select()
      .single();

    if (bookingErr) {
      console.error('[Payment Verify] Booking database insert error:', bookingErr);
      if (isFormRedirect) {
        return NextResponse.redirect(new URL('/dashboard/advertiser?error=booking_insert_failed', req.url));
      }
      return NextResponse.json({ error: bookingErr.message }, { status: 500 });
    }

    // 3. Mark space as rented
    await supabaseAdmin
      .from('spaces')
      .update({ is_rented: true })
      .eq('id', space_id);

    // 4. Retrieve Space Details
    const { data: spaceData } = await supabaseAdmin
      .from('spaces')
      .select('area, city, owner_id')
      .eq('id', space_id)
      .maybeSingle();

    let ownerEmail: string | null = null;
    let ownerName: string = 'Billboard Owner';
    let advertiserEmail: string | null = null;
    let advertiserName: string = 'Advertiser';
    let adminEmail: string | null = null;

    // 5. Retrieve Owner Email
    if (spaceData?.owner_id) {
      const { data: ownProf } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', spaceData.owner_id)
        .maybeSingle();

      ownerName = ownProf?.full_name || ownerName;
      ownerEmail = ownProf?.email || null;

      if (!ownerEmail) {
        const { data: ownAuth } = await supabaseAdmin.auth.admin.getUserById(spaceData.owner_id);
        ownerEmail = ownAuth?.user?.email || null;
      }
    }

    // 6. Retrieve Advertiser Email
    if (advertiser_id) {
      const { data: advProf } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', advertiser_id)
        .maybeSingle();

      advertiserName = advProf?.full_name || advertiserName;
      advertiserEmail = advProf?.email || null;

      if (!advertiserEmail) {
        const { data: advAuth } = await supabaseAdmin.auth.admin.getUserById(advertiser_id);
        advertiserEmail = advAuth?.user?.email || null;
      }
    }

    // 7. Retrieve Admin Email
    const { data: adminProf } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (adminProf?.email) {
      adminEmail = adminProf.email;
    } else if (adminProf?.id) {
      const { data: adminAuth } = await supabaseAdmin.auth.admin.getUserById(adminProf.id);
      adminEmail = adminAuth?.user?.email || null;
    }

    if (!adminEmail) {
      adminEmail = 'hdaprojectofficial@gmail.com';
    }

    const refNumber = booking?.id ? String(booking.id).slice(0, 8).toUpperCase() : 'REC-' + Date.now().toString().slice(-6);
    const area = spaceData?.area || 'Prime Billboard';
    const city = spaceData?.city || 'Location';
    const billDate = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    console.log('[Payment Verify] Sending emails to resolved DB users:', {
      advertiser: advertiserEmail,
      owner: ownerEmail,
      admin: adminEmail,
    });

    const emailTasks: Promise<any>[] = [];

    // A. Email to Advertiser
    if (isValidDeliverableEmail(advertiserEmail)) {
      emailTasks.push(
        transporter.sendMail({
          from: `"AdFlex Platform" <${process.env.SMTP_USER}>`,
          to: advertiserEmail!,
          subject: `Payment Receipt & Tax Invoice #${refNumber} - ${area}, ${city}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #4f46e5; margin: 0 0 10px 0;">Payment Confirmed & Billboard Booked!</h2>
              <p style="font-size: 14px;">Dear <strong>${advertiserName}</strong>, your payment of <strong>₹${Number(total_amount).toLocaleString('en-IN')}</strong> has been received.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; line-height: 1.8;">
                <div><strong>Invoice Ref:</strong> #${refNumber}</div>
                <div><strong>Billboard:</strong> ${area}, ${city}</div>
                <div><strong>Rental Period:</strong> ${duration_months} Month(s) (${start_date} to ${end_date})</div>
                <div><strong>Payment Ref:</strong> ${razorpay_payment_id}</div>
                <div><strong>Date:</strong> ${billDate}</div>
                ${banner_image_url ? `<div><strong>Banner Creative:</strong> <a href="${banner_image_url}" target="_blank" style="color:#4f46e5;">View Uploaded Ad</a></div>` : ''}
              </div>
              <p style="font-size: 12px; color: #64748b;">You can coordinate installation and maintenance with the owner via Tenant Chat.</p>
            </div>
          `,
        })
      );
    }

    // B. Email to Space Owner
    if (isValidDeliverableEmail(ownerEmail)) {
      emailTasks.push(
        transporter.sendMail({
          from: `"AdFlex Bookings" <${process.env.SMTP_USER}>`,
          to: ownerEmail!,
          subject: `[Billboard Rented] Payment Received for ${area}, ${city} (#${refNumber})`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #15803d; margin: 0 0 10px 0;">Your Billboard Has Been Booked!</h2>
              <p style="font-size: 14px;">Hello <strong>${ownerName}</strong>,</p>
              <p style="font-size: 14px;">An advertiser has booked your billboard at <strong>${area}, ${city}</strong> for <strong>${duration_months} Month(s)</strong>.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; line-height: 1.8;">
                <div><strong>Booking Ref:</strong> #${refNumber}</div>
                <div><strong>Gross Value:</strong> ₹${Number(total_amount).toLocaleString('en-IN')}</div>
                <div><strong>Advertiser:</strong> ${advertiserName}</div>
                <div><strong>Payout:</strong> Secured in Escrow</div>
                ${banner_image_url ? `<div><strong>Ad Creative:</strong> <a href="${banner_image_url}" target="_blank" style="color:#15803d;">Download Graphic</a></div>` : ''}
              </div>
            </div>
          `,
        })
      );
    }

    // C. Email to Platform Administrator
    if (isValidDeliverableEmail(adminEmail)) {
      emailTasks.push(
        transporter.sendMail({
          from: `"AdFlex Alerts" <${process.env.SMTP_USER}>`,
          to: adminEmail!,
          subject: `[Admin Alert] Booking Payment Confirmed: #${refNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h3 style="margin-top: 0;">New Rental Transaction Completed</h3>
              <p><strong>Booking Ref:</strong> #${refNumber}</p>
              <p><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
              <p><strong>Total Amount:</strong> ₹${Number(total_amount).toLocaleString('en-IN')}</p>
              <p><strong>Billboard:</strong> ${area}, ${city}</p>
              <p><strong>Advertiser:</strong> ${advertiserName} (${advertiserEmail})</p>
              <p><strong>Owner:</strong> ${ownerName} (${ownerEmail})</p>
              ${banner_image_url ? `<p><strong>Ad Graphic:</strong> <a href="${banner_image_url}" target="_blank">View File</a></p>` : ''}
            </div>
          `,
        })
      );
    }

    await Promise.allSettled(emailTasks);

    if (isFormRedirect) {
      return NextResponse.redirect(new URL('/dashboard/advertiser/banners', req.url));
    }

    return NextResponse.json({ success: true, booking });
  } catch (err: any) {
    console.error('[Payment Verify Route] Error:', err);
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}