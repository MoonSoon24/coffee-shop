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

    const orderId = Number(order_id);
    if (Number.isNaN(orderId)) {
      return new Response(JSON.stringify({ error: 'order_id must be numeric' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);

    if (error) throw error;

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