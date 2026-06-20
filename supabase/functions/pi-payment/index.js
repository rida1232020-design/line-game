import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS Pre-flight Options Request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, paymentId, txid } = await req.json();
    const apiKey = Deno.env.get("PI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Server Configuration Error: PI_API_KEY environment variable is not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Payment Approve Action ──
    if (action === "approve") {
      console.log(`Approving payment ID: ${paymentId}`);
      const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
        method: "POST",
        headers: {
          "Authorization": `Key ${apiKey}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Pi SDK Approval Error:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to approve payment with Pi Network API APIs" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payment = await response.json();
      return new Response(
        JSON.stringify({ success: true, payment }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Payment Complete Action ──
    if (action === "complete") {
      console.log(`Completing payment ID: ${paymentId} with TxId: ${txid}`);
      const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
        method: "POST",
        headers: {
          "Authorization": `Key ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ txid })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Pi SDK Completion Error:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to complete payment with Pi Network API APIs" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payment = await response.json();
      return new Response(
        JSON.stringify({ success: true, payment }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Edge Function Server Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
