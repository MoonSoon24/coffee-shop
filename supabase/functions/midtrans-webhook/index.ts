import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type MidtransNotification = {
  order_id?: string;
  transaction_status?: string;
  fraud_status?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
};

const toSha512Hex = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const resolveOrderStatus = (transactionStatus?: string, fraudStatus?: string) => {
  if (transactionStatus === 'capture') {
    return fraudStatus === 'challenge' ? 'pending' : 'paid';
  }

  if (transactionStatus === 'settlement') {
    return 'paid';
  }

  if (transactionStatus === 'pending') {
    return 'pending';
  }

  if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
    return 'cancelled';
  }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const payload = (await req.json()) as MidtransNotification;
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = payload;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return new Response(JSON.stringify({ error: 'Invalid notification payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      return new Response(JSON.stringify({ error: 'MIDTRANS_SERVER_KEY is not set' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const expectedSignature = await toSha512Hex(`${order_id}${status_code}${gross_amount}${serverKey}`);
    if (expectedSignature !== signature_key) {
      return new Response(JSON.stringify({ error: 'Invalid Midtrans signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const nextStatus = resolveOrderStatus(transaction_status, fraud_status);
    if (!nextStatus) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Supabase environment variables are missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: payment, error: paymentLookupError } = await supabase
      .from('payments')
      .select('id, master_order_id')
      .eq('midtrans_transaction_id', order_id)
      .maybeSingle();

    if (paymentLookupError) throw paymentLookupError;
    if (!payment) {
      return new Response(JSON.stringify({ error: 'Payment record not found for order_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({ status: nextStatus })
      .eq('id', payment.id);

    if (paymentUpdateError) throw paymentUpdateError;

    const { data: orderRow, error: orderLookupError } = await supabase
      .from('orders')
      .select('id, type')
      .eq('id', payment.master_order_id)
      .maybeSingle();

    if (orderLookupError) throw orderLookupError;
    if (!orderRow) {
      return new Response(JSON.stringify({ error: 'Master order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const targetOrderStatus =
      nextStatus === 'paid' && orderRow.type === 'dine_in'
        ? 'active'
        : nextStatus;

    const { error: orderStatusError } = await supabase
      .from('orders')
      .update({ status: targetOrderStatus })
      .eq('id', payment.master_order_id);

    if (orderStatusError) throw orderStatusError;

    if (nextStatus === 'paid') {
      const batchId = crypto.randomUUID();
      const { error: itemsUpdateError } = await supabase
        .from('order_items')
        .update({
          payment_status: 'paid',
          batch_id: batchId,
        })
        .eq('order_id', payment.master_order_id)
        .eq('payment_status', 'unpaid');

      if (itemsUpdateError) throw itemsUpdateError;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});