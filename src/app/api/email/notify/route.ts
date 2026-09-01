import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

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

export async function POST(req: Request) {
  try {
    const { type, payload } = await req.json();

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('[Email Error] SMTP credentials missing');
      return NextResponse.json(
        { error: 'SMTP credentials missing in environment variables.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = getAdminSupabase();

    // ==========================================================
    // 1. ADMIN APPROVES / REJECTS BOARD
    // ==========================================================
    if (type === 'BOARD_STATUS_UPDATE') {
      let { ownerEmail, ownerId, ownerName, area, city, status, remarks } = payload;
      const isApproved = status === 'approved';

      if (!ownerEmail && ownerId) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(ownerId);
        ownerEmail = userData?.user?.email;
      }

      if (!ownerEmail) {
        console.error('[Email Error] No email found for owner:', ownerId);
        return NextResponse.json({ error: 'Owner email address not found.' }, { status: 400 });
      }

      await transporter.sendMail({
        from: `"AdFlex Platform" <${process.env.SMTP_USER}>`,
        to: ownerEmail,
        subject: `[Billboard Update] Your Space Listing has been ${status.toUpperCase()} - ${area}, ${city}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="margin-bottom: 18px;">
              <span style="background-color: ${isApproved ? '#dcfce7' : '#ffe4e6'}; color: ${isApproved ? '#15803d' : '#be123c'}; font-size: 11px; font-weight: bold; padding: 5px 12px; border-radius: 9999px; text-transform: uppercase;">
                ${status}
              </span>
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Billboard Verification Status</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">Hello <strong>${ownerName || 'Board Owner'}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
              Your billboard space listing at <strong>${area}, ${city}</strong> has been reviewed and marked as 
              <strong style="color: ${isApproved ? '#15803d' : '#be123c'};">${status.toUpperCase()}</strong> by the platform administrator.
            </p>
            ${
              remarks
                ? `<div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 12px; margin: 16px 0; font-size: 13px; color: #475569;">
                    <strong>Admin Note:</strong> ${remarks}
                  </div>`
                : ''
            }
            ${
              isApproved
                ? `<p style="font-size: 14px; line-height: 1.6; color: #15803d; font-weight: 600;">
                    Your billboard is now active and published live across the advertiser marketplace!
                  </p>`
                : `<p style="font-size: 14px; line-height: 1.6; color: #64748b;">
                    Please log in to your owner dashboard to adjust specifications or verify evidence photos and resubmit.
                  </p>`
            }
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">AdFlex Outdoor Billboard Operations Team</p>
          </div>
        `,
      });

      return NextResponse.json({ success: true, message: 'Status email sent to owner.' });
    }

    // ==========================================================
    // 2. PAYMENT COMPLETED (BILL TO ADVERTISER, OWNER, AND ADMIN)
    // ==========================================================
    if (type === 'PAYMENT_SUCCESS_BROADCAST') {
      let {
        bookingId,
        spaceId,
        paymentId,
        totalAmount,
        durationMonths,
        advertiserEmail,
        advertiserName,
        ownerEmail,
        ownerName,
        area,
        city,
      } = payload;

      console.log('[Email API] Payment Broadcast triggered with:', {
        bookingId,
        spaceId,
        totalAmount,
        durationMonths,
        paymentId,
      });

      // 1. Resolve Space & Owner Details if missing
      if (spaceId && (!area || !city || !ownerEmail)) {
        const { data: spaceRow } = await supabaseAdmin
          .from('spaces')
          .select('area, city, owner_id')
          .eq('id', spaceId)
          .maybeSingle();

        if (spaceRow) {
          area = area || spaceRow.area;
          city = city || spaceRow.city;

          if (!ownerEmail && spaceRow.owner_id) {
            // First check profiles table
            const { data: ownerProf } = await supabaseAdmin
              .from('profiles')
              .select('full_name, email')
              .eq('id', spaceRow.owner_id)
              .maybeSingle();

            ownerName = ownerName || ownerProf?.full_name;
            ownerEmail = ownerProf?.email;

            // Fallback to auth.users if not in profiles
            if (!ownerEmail) {
              const { data: ownerAuth } = await supabaseAdmin.auth.admin.getUserById(
                spaceRow.owner_id
              );
              ownerEmail = ownerAuth?.user?.email;
            }
          }
        }
      }

      // 2. Resolve Booking & Advertiser Details if missing
      if (bookingId && (!totalAmount || !durationMonths || !advertiserEmail)) {
        const { data: bookingRow } = await supabaseAdmin
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .maybeSingle();

        if (bookingRow) {
          totalAmount = totalAmount || bookingRow.total_amount;
          durationMonths = durationMonths || bookingRow.duration_months;

          if (!advertiserEmail && bookingRow.advertiser_id) {
            const { data: advProf } = await supabaseAdmin
              .from('profiles')
              .select('full_name, email')
              .eq('id', bookingRow.advertiser_id)
              .maybeSingle();

            advertiserName = advertiserName || advProf?.full_name;
            advertiserEmail = advProf?.email;

            if (!advertiserEmail) {
              const { data: advAuth } = await supabaseAdmin.auth.admin.getUserById(
                bookingRow.advertiser_id
              );
              advertiserEmail = advAuth?.user?.email;
            }
          }
        }
      }

      const adminEmail = process.env.SMTP_USER;
      const refNumber = bookingId ? String(bookingId).slice(0, 8).toUpperCase() : 'REC-' + Date.now().toString().slice(-6);
      const billDate = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      console.log('[Email API] Target Emails:', {
        advertiserEmail,
        ownerEmail,
        adminEmail,
      });

      const emailPromises = [];

      // A. INVOICE / BILL TO ADVERTISER
      if (advertiserEmail) {
        emailPromises.push(
          transporter.sendMail({
            from: `"AdFlex Platform" <${process.env.SMTP_USER}>`,
            to: advertiserEmail,
            subject: `Payment Receipt & Invoice #${refNumber} - ${area || 'Billboard'}, ${city || ''}`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px;">
                  <h2 style="color: #4f46e5; margin: 0; font-size: 20px;">AdFlex Billboard Platform</h2>
                  <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Official Payment Confirmation & Tax Invoice</p>
                </div>

                <p style="font-size: 14px; line-height: 1.6;">Dear <strong>${advertiserName || 'Advertiser'}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.6;">Your payment has been successfully verified and your billboard slot is secured.</p>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
                  <thead>
                    <tr style="background-color: #f8fafc; text-align: left;">
                      <th style="padding: 10px; border: 1px solid #e2e8f0;">Particulars</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0;">Duration</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="padding: 10px; border: 1px solid #e2e8f0;">Billboard Space Rental (${area || 'Selected Space'}, ${city || ''})</td>
                      <td style="padding: 10px; border: 1px solid #e2e8f0;">${durationMonths || 1} Month(s)</td>
                      <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">₹${Number(totalAmount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr style="background-color: #f1f5f9; font-weight: bold;">
                      <td colspan="2" style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">Total Paid:</td>
                      <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; color: #4f46e5;">₹${Number(totalAmount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; color: #475569; margin-bottom: 20px;">
                  <p style="margin: 2px 0;"><strong>Invoice Ref:</strong> #${refNumber}</p>
                  <p style="margin: 2px 0;"><strong>Date:</strong> ${billDate}</p>
                  <p style="margin: 2px 0;"><strong>Transaction ID:</strong> ${paymentId || 'Prepaid Verified'}</p>
                  <p style="margin: 2px 0;"><strong>Status:</strong> Paid & Active</p>
                </div>

                <p style="font-size: 12px; color: #64748b; line-height: 1.6;">
                  You can now coordinate flex installation and creative updates directly with the space owner using Tenant Chat in your dashboard.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 10px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center;">AdFlex Marketplace Billing</p>
              </div>
            `,
          })
        );
      } else {
        console.warn('[Email Warning] No advertiser email found to send invoice.');
      }

      // B. RENTAL STATEMENT TO OWNER
      if (ownerEmail) {
        emailPromises.push(
          transporter.sendMail({
            from: `"AdFlex Bookings" <${process.env.SMTP_USER}>`,
            to: ownerEmail,
            subject: `[Billboard Rented] Payment Received for ${area || 'Board'}, ${city || ''} (#${refNumber})`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <div style="margin-bottom: 16px;">
                  <span style="background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 9999px;">
                    NEW RENTAL BOOKING
                  </span>
                </div>
                <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Your Billboard Has Been Booked!</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #334155;">Hello <strong>${ownerName || 'Billboard Owner'}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                  An advertiser has booked your billboard at <strong>${area || 'Billboard'}, ${city || ''}</strong> for <strong>${durationMonths || 1} Month(s)</strong>.
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 13px; line-height: 1.8;">
                  <div><strong>Booking Ref:</strong> #${refNumber}</div>
                  <div><strong>Advertiser:</strong> ${advertiserName || 'Verified Advertiser'}</div>
                  <div><strong>Gross Value:</strong> ₹${Number(totalAmount || 0).toLocaleString('en-IN')}</div>
                  <div><strong>Payout Status:</strong> Held in Escrow (Release on board mounting)</div>
                </div>

                <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
                  Log into your owner dashboard to coordinate flex mounting schedule via Tenant Chat.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 10px 0;" />
                <p style="font-size: 11px; color: #94a3b8;">AdFlex Partner Operations</p>
              </div>
            `,
          })
        );
      } else {
        console.warn('[Email Warning] No owner email found to send rental notice.');
      }

      // C. AUDIT RECORD TO ADMIN
      if (adminEmail) {
        emailPromises.push(
          transporter.sendMail({
            from: `"AdFlex System Alerts" <${process.env.SMTP_USER}>`,
            to: adminEmail,
            subject: `[Admin Alert] Booking Payment Confirmed: #${refNumber} (₹${Number(totalAmount || 0).toLocaleString('en-IN')})`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h3 style="color: #0f172a; margin-top: 0;">Rental Transaction Completed</h3>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.8;">
                  <div><strong>Booking ID:</strong> ${bookingId}</div>
                  <div><strong>Payment ID:</strong> ${paymentId || 'Direct'}</div>
                  <div><strong>Gross Amount:</strong> ₹${Number(totalAmount || 0).toLocaleString('en-IN')}</div>
                  <div><strong>Billboard Space:</strong> ${area || ''}, ${city || ''}</div>
                  <div><strong>Duration:</strong> ${durationMonths || 1} Month(s)</div>
                  <div><strong>Advertiser:</strong> ${advertiserName || 'N/A'} (${advertiserEmail || 'No Email'})</div>
                  <div><strong>Owner:</strong> ${ownerName || 'N/A'} (${ownerEmail || 'No Email'})</div>
                </div>
              </div>
            `,
          })
        );
      }

      await Promise.all(emailPromises);
      return NextResponse.json({
        success: true,
        message: 'Invoices dispatched to Advertiser, Owner, and Admin.',
      });
    }

    return NextResponse.json({ error: 'Unsupported notification event type.' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /email/notify] Dispatch Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to dispatch email' }, { status: 500 });
  }
}