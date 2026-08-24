import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

// ---------------------------------------------------------
// Convert hexadecimal string to bytes
// ---------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(
    hex.length / 2,
  );

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(
      hex.slice(i * 2, i * 2 + 2),
      16,
    );
  }

  return bytes;
}

function isValidHexSignature(value: string): boolean {
  return value.length === 128 && /^[0-9a-f]+$/i.test(value);
}

// ---------------------------------------------------------
// Constant-time comparison
// ---------------------------------------------------------

function constantTimeEqual(
  a: Uint8Array,
  b: Uint8Array,
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

// ---------------------------------------------------------
// Generate Paystack HMAC SHA512 signature
// ---------------------------------------------------------

async function generateSignature(
  rawBody: string,
  secret: string,
): Promise<string> {
  const encoder =
    new TextEncoder();

  const keyData =
    encoder.encode(secret);

  const messageData =
    encoder.encode(rawBody);

  const cryptoKey =
    await crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "HMAC",
        hash: "SHA-512",
      },
      false,
      ["sign"],
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData,
    );

  const bytes =
    new Uint8Array(signature);

  return Array.from(bytes)
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

// ---------------------------------------------------------
// Main webhook
// ---------------------------------------------------------

Deno.serve(
  async (req: Request) => {
    // -------------------------------------------------------
    // 1. CORS
    // -------------------------------------------------------

    if (req.method === "OPTIONS") {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    // -------------------------------------------------------
    // 2. Only POST is accepted
    // -------------------------------------------------------

    if (req.method !== "POST" && req.method !== "GET") {
      return jsonResponse(
        {
          ok: false,
          error:
            "Method not allowed. Use GET or POST.",
        },
        405,
      );
    }

    try {
      // -----------------------------------------------------
      // 3. Get secrets
      // -----------------------------------------------------

      const paystackSecretKey =
        Deno.env.get(
          "PAYSTACK_SECRET_KEY",
        );

      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );

      const supabaseServiceRoleKey =
        Deno.env.get(
          "NP_SUPABASE_SERVICE_ROLE_KEY",
        ) ||
        Deno.env.get(
          "NP_SERVICE_ROLE_KEY",
        );

      if (!paystackSecretKey) {
        console.error(
          "PAYSTACK_SECRET_KEY is not configured.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Webhook secret is not configured.",
          },
          500,
        );
      }

      if (!supabaseUrl) {
        console.error(
          "SUPABASE_URL is not configured.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Supabase URL is not configured.",
          },
          500,
        );
      }

      if (!supabaseServiceRoleKey) {
        console.error("NP_SUPABASE_SERVICE_ROLE_KEY is not configured.");
        return jsonResponse({ ok: false, error: "Supabase service-role key is not configured." }, 500);
      }

      // -----------------------------------------------------
      // 4. Read RAW request body
      // -----------------------------------------------------
      //
      // IMPORTANT:
      // We must calculate the signature from the raw body,
      // not from JSON.stringify(parsedBody).
      //

      let event: any;
      let rawBody = "";

      if (req.method === "GET") {
        const reference = new URL(req.url).searchParams.get("reference") ||
          new URL(req.url).searchParams.get("trxref");
        if (!reference) {
          return jsonResponse({ ok: false, error: "Payment reference is required." }, 400);
        }

        const verifyResponse = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
        );
        const verifyData = await verifyResponse.json();
        if (!verifyResponse.ok || !verifyData.status || !verifyData.data) {
          return jsonResponse({ ok: false, error: verifyData.message || "Unable to verify payment." }, 502);
        }
        event = { event: "charge.success", data: verifyData.data };
      } else {
        rawBody = await req.text();

        // -----------------------------------------------------
        // 5. Get Paystack signature
        // -----------------------------------------------------

        const signature =
          req.headers.get(
            "x-paystack-signature",
          );

        if (!signature) {
        console.error(
          "Missing x-paystack-signature header.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Missing Paystack signature.",
          },
          401,
        );
        }

        if (!isValidHexSignature(signature)) {
        console.error("Malformed Paystack webhook signature.");
        return jsonResponse(
          {
            ok: false,
            error: "Invalid webhook signature.",
          },
          401,
        );
        }

      // -----------------------------------------------------
      // 6. Verify signature
      // -----------------------------------------------------

        const expectedSignature =
          await generateSignature(
            rawBody,
            paystackSecretKey,
          );

        const signatureMatches =
          constantTimeEqual(
            hexToBytes(
              signature,
            ),
            hexToBytes(
              expectedSignature,
            ),
          );

        if (!signatureMatches) {
        console.error(
          "Invalid Paystack webhook signature.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Invalid webhook signature.",
          },
          401,
        );
        }

      // -----------------------------------------------------
      // 7. Parse webhook JSON
      // -----------------------------------------------------

        try {
          event = JSON.parse(rawBody);
        } catch {
        return jsonResponse(
          {
            ok: false,
            error:
              "Invalid JSON payload.",
          },
          400,
        );
        }
      }

      console.log(
        "Paystack webhook event:",
        event.event,
      );

      // -----------------------------------------------------
      // 8. We currently process successful charges
      // -----------------------------------------------------
      //
      // Paystack's successful payment webhook event is:
      //
      // charge.success
      //
      // Other events are acknowledged but ignored for now.
      //

      if (
        event.event !==
        "charge.success"
      ) {
        return jsonResponse({
          ok: true,
          message:
            "Event received but no action was required.",
          event:
            event.event || null,
        });
      }

      // -----------------------------------------------------
      // 9. Get transaction data
      // -----------------------------------------------------

      const transaction =
        event.data;

      if (
        !transaction ||
        typeof transaction !==
          "object"
      ) {
        console.error(
          "Webhook did not contain transaction data.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Transaction data is missing.",
          },
          400,
        );
      }

      const reference =
        transaction.reference;

      if (
        !reference ||
        typeof reference !==
          "string"
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Transaction reference is missing.",
          },
          400,
        );
      }

      // -----------------------------------------------------
      // 10. Create privileged Supabase client
      // -----------------------------------------------------

      const supabaseAdmin =
        createClient(
          supabaseUrl,
          supabaseServiceRoleKey,
        );

      // -----------------------------------------------------
      // 11. Find our payment record
      // -----------------------------------------------------

      const {
        data: payment,
        error: paymentLookupError,
      } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq(
          "provider",
          "paystack",
        )
        .eq(
          "provider_reference",
          reference,
        )
        .maybeSingle();

      if (paymentLookupError) {
        console.error(
          "Payment lookup error:",
          paymentLookupError,
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Unable to find payment record.",
          },
          500,
        );
      }

      if (!payment) {
        console.error(
          "No payment found for reference:",
          reference,
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Payment record not found.",
          },
          404,
        );
      }

      // -----------------------------------------------------
      // 12. Idempotency check
      // -----------------------------------------------------
      //
      // Paystack can retry webhook events.
      // If we already processed this payment successfully,
      // do not process it again.
      //

      if (
        payment.status ===
        "successful"
      ) {
        return jsonResponse({
          ok: true,
          message:
            "Payment was already processed.",
          payment_id:
            payment.id,
          reference,
        });
      }

      // -----------------------------------------------------
      // 13. Verify transaction directly with Paystack
      // -----------------------------------------------------
      //
      // We do NOT trust the webhook payload alone.
      //

      const verifyResponse =
        await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${paystackSecretKey}`,
            },
          },
        );

      const verifyData =
        await verifyResponse.json();

      if (
        !verifyResponse.ok ||
        !verifyData.status ||
        !verifyData.data
      ) {
        console.error(
          "Paystack transaction verification failed:",
          verifyData,
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Paystack transaction verification failed.",
          },
          502,
        );
      }

      const verified =
        verifyData.data;

      // -----------------------------------------------------
      // 14. Verify transaction status
      // -----------------------------------------------------

      if (
        verified.status !==
        "success"
      ) {
        console.error(
          "Transaction is not successful:",
          verified.status,
        );

        return jsonResponse(
          {
            ok: true,
            message:
              "Transaction has not been confirmed as successful.",
            transaction_status:
              verified.status,
          },
        );
      }

      // -----------------------------------------------------
      // 15. Verify reference
      // -----------------------------------------------------

      if (
        verified.reference !==
        reference
      ) {
        console.error(
          "Reference mismatch.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Transaction reference mismatch.",
          },
          400,
        );
      }

      // -----------------------------------------------------
      // 16. Verify amount
      // -----------------------------------------------------
      //
      // Our database stores the major currency unit.
      // Paystack verification returns the subunit.
      //

      const expectedAmount =
        Math.round(
          Number(payment.amount) *
            100,
        );

      const paidAmount =
        Number(
          verified.amount,
        );

      if (
        !Number.isFinite(
          expectedAmount,
        ) ||
        !Number.isFinite(
          paidAmount,
        ) ||
        expectedAmount !==
          paidAmount
      ) {
        console.error(
          "Amount mismatch:",
          {
            expectedAmount,
            paidAmount,
            paymentAmount:
              payment.amount,
            reference,
          },
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Payment amount does not match the offer amount.",
          },
          400,
        );
      }

      // -----------------------------------------------------
      // 17. Verify currency
      // -----------------------------------------------------

      const expectedCurrency =
        String(
          payment.currency,
        ).toUpperCase();

      const paidCurrency =
        String(
          verified.currency ||
            "",
        ).toUpperCase();

      if (
        expectedCurrency !==
        paidCurrency
      ) {
        console.error(
          "Currency mismatch:",
          {
            expectedCurrency,
            paidCurrency,
            reference,
          },
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Payment currency does not match the expected currency.",
          },
          400,
        );
      }

      // -----------------------------------------------------
      // 18. Load related offer
      // -----------------------------------------------------

      const {
        data: offer,
        error: offerError,
      } = await supabaseAdmin
        .from("offers")
        .select(
          "id, client_id, status, title",
        )
        .eq(
          "id",
          payment.offer_id,
        )
        .maybeSingle();

      if (offerError) {
        console.error(
          "Offer lookup error:",
          offerError,
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Unable to retrieve related offer.",
          },
          500,
        );
      }

      if (!offer) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Related offer was not found.",
          },
          404,
        );
      }

      // -----------------------------------------------------
      // 19. Verify client relationship
      // -----------------------------------------------------

      if (
        offer.client_id !==
        payment.client_id
      ) {
        console.error(
          "Client relationship mismatch.",
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Payment client does not match offer client.",
          },
          400,
        );
      }

      // -----------------------------------------------------
      // 20. Update payment as successful
      // -----------------------------------------------------

      const existingMetadata =
        payment.metadata &&
        typeof payment.metadata ===
          "object"
          ? payment.metadata
          : {};

      const updatedMetadata = {
        ...existingMetadata,

        paystack: {
          transaction_id:
            verified.id ??
            null,

          status:
            verified.status ??
            null,

          gateway_response:
            verified.gateway_response ??
            null,

          channel:
            verified.channel ??
            null,

          paid_at:
            verified.paid_at ??
            verified.paidAt ??
            null,

          verified_at:
            new Date().toISOString(),
        },
      };

      const {
        data: updatedPayment,
        error: paymentUpdateError,
      } = await supabaseAdmin
        .from("payments")
        .update({
          status:
            "successful",

          paid_at:
            verified.paid_at ??
            verified.paidAt ??
            new Date().toISOString(),

          metadata:
            updatedMetadata,
        })
        .eq(
          "id",
          payment.id,
        )
        .select()
        .single();

      if (paymentUpdateError) {
        console.error(
          "Payment update error:",
          paymentUpdateError,
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Payment was verified but could not be marked successful.",
          },
          500,
        );
      }

      // -----------------------------------------------------
      // 21. Final response
      // -----------------------------------------------------

      console.log(
        "Payment successfully confirmed:",
        {
          payment_id:
            payment.id,
          offer_id:
            payment.offer_id,
          reference,
        },
      );

      return jsonResponse({
        ok: true,

        message:
          "Payment successfully verified and recorded.",

        payment_id:
          updatedPayment.id,

        offer_id:
          updatedPayment.offer_id,

        reference,

        status:
          "successful",
      });
    } catch (error) {
      console.error(
        "Unexpected webhook error:",
        error,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unexpected webhook error.",
        },
        500,
      );
    }
  },
);
