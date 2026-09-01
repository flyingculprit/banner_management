import { supabase } from '@/lib/supabase';

export async function sendPaymentInvoices({
  bookingId,
  spaceId,
  totalAmount,
  durationMonths,
  paymentId,
}: {
  bookingId: string;
  spaceId: string;
  totalAmount: number;
  durationMonths: number;
  paymentId?: string;
}) {
  try {
    // 1. Get logged-in advertiser user info
    const { data: authData } = await supabase.auth.getUser();
    const advertiserUser = authData?.user;

    // 2. Fetch billboard space basic info without broken profile joins
    const { data: spaceData } = await supabase
      .from('spaces')
      .select('id, area, city, owner_id')
      .eq('id', spaceId)
      .maybeSingle();

    // 3. Dispatch to email API route
    const response = await fetch('/api/email/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'PAYMENT_SUCCESS_BROADCAST',
        payload: {
          bookingId,
          spaceId,
          paymentId: paymentId || 'RZP_SUCCESS',
          totalAmount,
          durationMonths,
          area: spaceData?.area,
          city: spaceData?.city,
          advertiserId: advertiserUser?.id,
          advertiserEmail: advertiserUser?.email,
          advertiserName:
            advertiserUser?.user_metadata?.full_name || advertiserUser?.email?.split('@')[0] || 'Advertiser',
          ownerId: spaceData?.owner_id,
        },
      }),
    });

    const result = await response.json();
    console.log('[sendPaymentInvoices] Email response:', result);
    return result;
  } catch (error) {
    console.error('[sendPaymentInvoices] Error triggering payment emails:', error);
  }
}