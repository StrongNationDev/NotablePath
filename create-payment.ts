import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  // ---------------------------------------------------------
  // 1. CORS
  // ---------------------------------------------------------

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Method not allowed. Use POST.",
      },
      405,
    );
  }

  try {
    // ---------------------------------------------------------
    // 2. Environment variables
    // ---------------------------------------------------------

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const callbackUrl = Deno.env.get("PAYMENT_CALLBACK_URL") ||
      "http://localhost:8000/payment/callback/";
      // "https://notablepath.online/payment/callback/";
    const supabaseServiceRoleKey =
      Deno.env.get("NP_SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("NP_SERVICE_ROLE_KEY");
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!supabaseUrl) {
      return jsonResponse(
        { ok: false, error: "Supabase URL is unavailable." },
        500,
      );
    }

    if (!supabaseServiceRoleKey) {
      return jsonResponse(
        { ok: false, error: "Server database key is not configured." },
        500,
      );
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        { ok: false, error: "Authentication is required." },
        401,
      );
    }

    if (!paystackSecretKey) {
      return jsonResponse(
        { ok: false, error: "Paystack is not configured." },
        500,
      );
    }

    // ---------------------------------------------------------
    // 3. Privileged Supabase client
    // ---------------------------------------------------------
    //
    // This client runs only inside the Edge Function.
    // It bypasses RLS, so all authorization checks below
    // must be performed explicitly by this function.
    //

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const accessToken = authorization.slice("Bearer ".length).trim();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData.user?.email) {
      return jsonResponse(
        { ok: false, error: "Your secure session is invalid or expired." },
        401,
      );
    }

    // ---------------------------------------------------------
    // 4. Read request body
    // ---------------------------------------------------------

    let body: {
      offer_id?: string;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: "Request body must be valid JSON.",
        },
        400,
      );
    }

    const offerId = body.offer_id;

    if (!offerId || typeof offerId !== "string") {
      return jsonResponse(
        {
          ok: false,
          error: "offer_id is required.",
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // 5. Validate UUID format
    // ---------------------------------------------------------

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(offerId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid offer_id.",
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // 6. Find the requested offer
    // ---------------------------------------------------------

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .select("id, client_id, title, description, service_type, amount, currency, status, expires_at")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) {
      console.error(
        "Offer lookup error:",
        offerError,
      );

      return jsonResponse(
        {
          ok: false,
          error: "Unable to retrieve the offer.",
          detail: offerError.message,
        },
        500,
      );
    }

    if (!offer) {
      return jsonResponse(
        {
          ok: false,
          error: "Offer was not found.",
        },
        404,
      );
    }

    if (!offer.client_id) {
      return jsonResponse(
        { ok: false, error: "This offer is not associated with a client." },
        400,
      );
    }

    const { data: offerClient, error: offerClientError } = await supabaseAdmin
      .from("clients")
      .select("id, display_name, primary_email, status")
      .eq("id", offer.client_id)
      .maybeSingle();

    if (offerClientError) {
      console.error("Offer ownership lookup error:", offerClientError);
      return jsonResponse({ ok: false, error: "Unable to verify offer ownership." }, 500);
    }

    if (!offerClient || offerClient.primary_email?.toLowerCase() !== userData.user.email.toLowerCase()) {
      return jsonResponse(
        { ok: false, error: "You are not authorized to pay for this offer." },
        403,
      );
    }

    // ---------------------------------------------------------
    // 7. Check offer status
    // ---------------------------------------------------------
    //
    // Based on your actual offer_status enum:
    //
    // draft
    // sent
    // accepted
    // declined
    // expired
    // cancelled
    //
    // We allow payment for sent or accepted offers.
    //

    const offerStatus = String(
      offer.status || "",
    ).toLowerCase();

    const payableStatuses = [
      "sent",
      "accepted",
    ];

    if (!payableStatuses.includes(offerStatus)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This offer is not currently available for payment.",
          offer_status: offer.status,
        },
        409,
      );
    }

    // ---------------------------------------------------------
    // 8. Check offer expiration
    // ---------------------------------------------------------

    if (offer.expires_at) {
      const expiresAt =
        new Date(offer.expires_at);

      if (
        Number.isFinite(expiresAt.getTime()) &&
        expiresAt.getTime() <= Date.now()
      ) {
        return jsonResponse(
          {
            ok: false,
            error: "This payment offer has expired.",
          },
          409,
        );
      }
    }

    // ---------------------------------------------------------
    // 9. Validate client relationship
    // ---------------------------------------------------------

    const client = offerClient;

    // ---------------------------------------------------------
    // 10. Get the actual client email
    // ---------------------------------------------------------
    //
    // Your actual clients table uses:
    // primary_email
    //

    const clientEmail = client.primary_email;

    if (
      !clientEmail ||
      typeof clientEmail !== "string"
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The client does not have a usable primary email address.",
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // 11. Validate amount
    // ---------------------------------------------------------

    const amount = Number(offer.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The offer has an invalid payment amount.",
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // 12. Validate currency
    // ---------------------------------------------------------

    const currency = String(offer.currency || "").toUpperCase();

    if (currency !== "NGN") {
      return jsonResponse(
        {
          ok: false,
          error:
            "This platform currently accepts payments in NGN only.",
          currency,
        },
        400,
      );
    }

    // Paystack expects the amount in the currency's
    // smallest unit.
    //
    // NGN 250,000 -> 25,000,000 kobo
    //

    const paystackAmount =
      Math.round(amount * 100);

    // ---------------------------------------------------------
    // 13. Create unique payment reference
    // ---------------------------------------------------------

    const reference =
      `NP_${offer.id}_${crypto
        .randomUUID()
        .replaceAll("-", "")}`;

    // ---------------------------------------------------------
    // 14. Initialize Paystack transaction
    // ---------------------------------------------------------

    const paystackResponse =
      await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${paystackSecretKey}`,
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email: clientEmail,

            amount:
              String(paystackAmount),

            currency,

            reference,

            callback_url: callbackUrl,

            metadata: {
              offer_id: offer.id,

              client_id:
                offer.client_id,

              service:
                offer.title ||
                "NotablePath Service",

              platform:
                "NotablePath",

              custom_fields: [
                {
                  display_name:
                    "NotablePath Offer",

                  variable_name:
                    "offer_id",

                  value:
                    String(offer.id),
                },

                {
                  display_name:
                    "Service",

                  variable_name:
                    "service",

                  value:
                    String(
                      offer.title ||
                      "NotablePath Service",
                    ),
                },
              ],
            },
          }),
        },
      );

    const paystackData =
      await paystackResponse.json();

    // ---------------------------------------------------------
    // 15. Validate Paystack response
    // ---------------------------------------------------------

    if (
      !paystackResponse.ok ||
      !paystackData.status
    ) {
      console.error(
        "Paystack initialization failed:",
        paystackData,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            paystackData.message ||
            "Paystack could not initialize the transaction.",
        },
        502,
      );
    }

    const transaction =
      paystackData.data;

    if (
      !transaction ||
      !transaction.authorization_url
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Paystack initialized the transaction but did not return a checkout URL.",
        },
        502,
      );
    }

    // ---------------------------------------------------------
    // 16. Save payment record
    // ---------------------------------------------------------

    const {
      data: payment,
      error: paymentError,
    } = await supabaseAdmin
      .from("payments")
      .insert({
        offer_id: offer.id,

        client_id:
          offer.client_id,

        amount,

        currency,

        provider:
          "paystack",

        provider_reference:
          transaction.reference ||
          reference,

        status:
          "pending",
      })
      .select()
      .single();

    if (paymentError) {
      console.error(
        "Payment record creation error:",
        paymentError,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Payment was initialized but NotablePath could not create its payment record. Please contact support.",
        },
        500,
      );
    }

    // ---------------------------------------------------------
    // 17. Return checkout information
    // ---------------------------------------------------------

    return jsonResponse({
      ok: true,

      message:
        "Payment initialized successfully.",

      payment_id:
        payment.id,

      offer_id:
        offer.id,

      reference:
        transaction.reference ||
        reference,

      authorization_url:
        transaction.authorization_url,

      access_code:
        transaction.access_code ||
        null,

      amount,

      currency,

      status:
        "pending",
    });
  } catch (error) {
    console.error(
      "Unexpected create-payment error:",
      error,
    );

    return jsonResponse(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500,
    );
  }
});
