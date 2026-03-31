import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // --- NEW: Save the payment_token to Supabase database ---
    
    // Create Supabase client using built-in edge function environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    // We pass the Authorization header from the client request so Row Level Security (RLS) policies are respected
    const authHeader = req.headers.get('Authorization');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    // Update the specific order in the 'orders' table
    const { error: dbError } = await supabase
      .from('orders')
      .update({ payment_token: data.token })
      .eq('id', order_id);

    if (dbError) {
      console.error('Failed to save payment_token to the database:', dbError);
      // We log the error but still return the token to the client so the user isn't completely blocked
    }
    // --------------------------------------------------------

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