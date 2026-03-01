import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const isProduction = (Deno.env.get('MIDTRANS_IS_PRODUCTION') || 'false') === 'true';
const midtransApiBaseUrl = isProduction
  ? 'https://app.midtrans.com'
  : 'https://app.sandbox.midtrans.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { order_id, gross_amount, customer_name, customer_phone } = await req.json();

    if (!order_id || !gross_amount) {
      return new Response(JSON.stringify({ error: 'order_id and gross_amount are required' }), {
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

    const encodedKey = btoa(`${serverKey}:`);

    const midtransResponse = await fetch(`${midtransApiBaseUrl}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${encodedKey}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: order_id.toString(),
          gross_amount,
        },
        customer_details: {
          first_name: customer_name,
          phone: customer_phone,
        },
      }),
    });

    const data = await midtransResponse.json();

    if (!midtransResponse.ok || !data?.token) {
      return new Response(JSON.stringify({ error: data?.error_messages?.join(', ') || data?.status_message || 'Failed to create Midtrans token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ token: data.token, redirect_url: data.redirect_url }), {
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