import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

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
    const body = await req.json();
    const { action, paymentId, txid, gameId, winnerUid, paymentIds } = body;
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

    // ── Payout Action ──
    if (action === "payout") {
      console.log(`Processing payout for winner: ${winnerUid}, game: ${gameId}, paymentIds:`, paymentIds);

      if (!gameId || !winnerUid || !paymentIds || !Array.isArray(paymentIds) || paymentIds.length < 2) {
        return new Response(
          JSON.stringify({ error: "Missing or invalid payout parameters. At least 2 payment IDs are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Initialize Supabase admin client
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // 1. Double-spending check
      const { data: existing, error: selectError } = await supabaseAdmin
        .from("processed_payouts")
        .select("payment_id")
        .in("payment_id", paymentIds);

      if (selectError) {
        console.error("Database query error:", selectError);
        return new Response(
          JSON.stringify({ error: "Database error during duplicate check: " + selectError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existing && existing.length > 0) {
        const usedIds = existing.map(x => x.payment_id).join(", ");
        return new Response(
          JSON.stringify({ error: `Payment ID(s) already processed: ${usedIds}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Cryptographic/Network Validation of payments with Pi Network API
      let winnerIsParticipant = false;
      for (const id of paymentIds) {
        if (id.startsWith("fake_ticket_")) {
          winnerIsParticipant = true;
          continue;
        }

        console.log(`Validating payment ${id} via Pi API...`);
        const getResponse = await fetch(`https://api.minepi.com/v2/payments/${id}`, {
          headers: {
            "Authorization": `Key ${apiKey}`
          }
        });

        if (!getResponse.ok) {
          const errText = await getResponse.text();
          console.error(`Pi API Verification Error for ${id}:`, errText);
          return new Response(
            JSON.stringify({ error: `Failed to verify payment ${id} with Pi Network: ${errText}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const payment = await getResponse.json();
        
        const isCompleted = payment.status === "completed" || payment.status?.completed === true;
        if (!isCompleted) {
          return new Response(
            JSON.stringify({ error: `Payment ${id} is not fully completed on the blockchain.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (Number(payment.amount) !== 2.0) {
          return new Response(
            JSON.stringify({ error: `Payment ${id} has invalid amount: ${payment.amount}. Expected 2.0 Pi.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const payerUid = payment.uid || payment.user_uid;
        if (payerUid === winnerUid) {
          winnerIsParticipant = true;
        }
      }

      if (!winnerIsParticipant) {
        return new Response(
          JSON.stringify({ error: "The winner UID is not a participant in any of the provided payment tickets." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Mark payment IDs as processed in DB to prevent concurrent requests
      const inserts = paymentIds.map(id => ({
        payment_id: id,
        recipient_uid: winnerUid,
        game_id: gameId,
        amount: 3.75
      }));

      const { error: insertError } = await supabaseAdmin
        .from("processed_payouts")
        .insert(inserts);

      if (insertError) {
        console.error("Database insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Database error during lock: " + insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allFake = paymentIds.every(id => id.startsWith("fake_ticket_"));
      if (allFake) {
        console.log("All tickets are fake/simulated. Simulating successful payout.");
        return new Response(
          JSON.stringify({ success: true, message: "Simulated payout successful" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4. Create App-to-User (A2U) Payout (3.75 Pi)
      try {
        console.log(`Initiating App-to-User payment of 3.75 Pi to ${winnerUid}...`);
        const createResponse = await fetch("https://api.minepi.com/v2/payments", {
          method: "POST",
          headers: {
            "Authorization": `Key ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            payment: {
              amount: 3.75,
              memo: `Winner payout for game ${gameId}`,
              metadata: { gameId },
              uid: winnerUid
            }
          })
        });

        if (!createResponse.ok) {
          const errText = await createResponse.text();
          console.error("A2U creation error:", errText);
          throw new Error(`Failed to create payout payment: ${errText}`);
        }

        const createdPayment = await createResponse.json();
        const payoutPaymentId = createdPayment.identifier || createdPayment.id;
        console.log(`Payout payment created with ID: ${payoutPaymentId}. Approving...`);

        // Approve payout
        const approveResponse = await fetch(`https://api.minepi.com/v2/payments/${payoutPaymentId}/approve`, {
          method: "POST",
          headers: {
            "Authorization": `Key ${apiKey}`,
            "Content-Type": "application/json"
          }
        });

        if (!approveResponse.ok) {
          const errText = await approveResponse.text();
          console.error("A2U approval error:", errText);
          throw new Error(`Failed to approve payout payment: ${errText}`);
        }

        const approvedPayment = await approveResponse.json();
        console.log("Payout payment approved on blockchain. Polling for txid...");

        let txid = approvedPayment.transaction?.txid;
        if (!txid) {
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const getResponse = await fetch(`https://api.minepi.com/v2/payments/${payoutPaymentId}`, {
              headers: { "Authorization": `Key ${apiKey}` }
            });
            if (getResponse.ok) {
              const p = await getResponse.json();
              if (p.transaction?.txid) {
                txid = p.transaction.txid;
                break;
              }
            }
          }
        }

        if (!txid) {
          throw new Error("Blockchain transaction ID not found after approval polling.");
        }

        // Complete payout
        console.log(`Completing payout payment with txid: ${txid}`);
        const completeResponse = await fetch(`https://api.minepi.com/v2/payments/${payoutPaymentId}/complete`, {
          method: "POST",
          headers: {
            "Authorization": `Key ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ txid })
        });

        if (!completeResponse.ok) {
          const errText = await completeResponse.text();
          console.error("A2U completion error:", errText);
          throw new Error(`Failed to complete payout payment: ${errText}`);
        }

        const completedPayment = await completeResponse.json();
        console.log("A2U Payout completed successfully!");

        return new Response(
          JSON.stringify({ success: true, payment: completedPayment }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (payoutError) {
        console.error("A2U Payout Execution Failed. Reverting database locks:", payoutError);
        await supabaseAdmin
          .from("processed_payouts")
          .delete()
          .in("payment_id", paymentIds);

        return new Response(
          JSON.stringify({ error: `Payout transaction failed: ${payoutError.message}. Database lock reverted.` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
