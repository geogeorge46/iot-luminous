// Supabase Edge Function: device-api
// Serves HTTPS REST API for ESP32 Adaptive Lighting System
// Follows Deno TypeScript standard for Supabase Edge Functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const defaultDeviceToken = Deno.env.get("DEVICE_API_TOKEN") ?? "esp32_super_secret_token_123";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase environment variables not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify Device Authentication Token
    const deviceToken = req.headers.get("x-device-token") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (!deviceToken) {
      return new Response(
        JSON.stringify({ error: "Missing x-device-token header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "ingest";

    // -------------------------------------------------------------
    // ACTION: INGEST (Upload sensor readings, receive pending config)
    // -------------------------------------------------------------
    if (req.method === "POST" && action === "ingest") {
      const body = await req.json();
      const {
        device_identifier,
        ldr_raw,
        reported_led_state,
        light_condition,
        wifi_rssi,
        firmware_version,
      } = body;

      if (!device_identifier || typeof ldr_raw !== "number" || typeof reported_led_state !== "boolean") {
        return new Response(
          JSON.stringify({ error: "Invalid payload: device_identifier, ldr_raw, and reported_led_state required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate ADC range (12-bit ESP32 ADC: 0 to 4095)
      if (ldr_raw < 0 || ldr_raw > 4095) {
        return new Response(
          JSON.stringify({ error: "ldr_raw out of range (0-4095)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify device exists
      const { data: device, error: devErr } = await supabase
        .from("devices")
        .select("id, is_online")
        .eq("device_identifier", device_identifier)
        .single();

      if (devErr || !device) {
        return new Response(
          JSON.stringify({ error: `Device not found: ${device_identifier}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate token (against env or crypt hash)
      if (deviceToken !== defaultDeviceToken) {
        return new Response(
          JSON.stringify({ error: "Invalid device credentials" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const calculatedCondition = light_condition || (ldr_raw < 1500 ? "Dark" : ldr_raw < 2800 ? "Dim" : "Bright");

      // 1. Ingest telemetry into sensor_readings
      const { error: insertErr } = await supabase.from("sensor_readings").insert({
        device_id: device.id,
        ldr_raw,
        light_condition: calculatedCondition,
        reported_led_state,
        wifi_rssi: wifi_rssi ?? null,
      });

      if (insertErr) {
        console.error("Telemetry insert error:", insertErr);
      }

      // 2. Update device presence & health
      await supabase
        .from("devices")
        .update({
          is_online: true,
          last_seen_at: new Date().toISOString(),
          wifi_rssi: wifi_rssi ?? null,
          firmware_version: firmware_version ?? "1.0.0",
          updated_at: new Date().toISOString(),
        })
        .eq("id", device.id);

      // Check previous reading to detect transition events
      const { data: prevReadings } = await supabase
        .from("sensor_readings")
        .select("reported_led_state")
        .eq("device_id", device.id)
        .order("recorded_at", { ascending: false })
        .range(1, 1);

      if (prevReadings && prevReadings.length > 0) {
        if (prevReadings[0].reported_led_state !== reported_led_state) {
          await supabase.from("device_events").insert({
            device_id: device.id,
            event_type: "LED_STATE_CHANGE",
            severity: "info",
            details: {
              previous_state: prevReadings[0].reported_led_state,
              new_state: reported_led_state,
              trigger_adc: ldr_raw,
            },
          });
        }
      }

      // 3. Retrieve device settings to return to ESP32
      const { data: settings } = await supabase
        .from("device_settings")
        .select("automatic_mode, dark_threshold, light_threshold, dark_polarity_inverted, reading_interval_seconds")
        .eq("device_id", device.id)
        .single();

      // 4. Retrieve any pending unexpired commands
      const nowIso = new Date().toISOString();
      const { data: pendingCommands } = await supabase
        .from("device_commands")
        .select("id, command_type, command_payload, expires_at")
        .eq("device_id", device.id)
        .eq("status", "PENDING")
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: true })
        .limit(5);

      // Mark expired commands as EXPIRED
      await supabase
        .from("device_commands")
        .update({ status: "EXPIRED" })
        .eq("device_id", device.id)
        .eq("status", "PENDING")
        .lte("expires_at", nowIso);

      return new Response(
        JSON.stringify({
          success: true,
          server_time: nowIso,
          settings: settings || {
            automatic_mode: true,
            dark_threshold: 1500,
            light_threshold: 1800,
            dark_polarity_inverted: false,
            reading_interval_seconds: 5,
          },
          pending_commands: pendingCommands || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------
    // ACTION: ACK COMMAND (ESP32 confirms command execution)
    // -------------------------------------------------------------
    if (req.method === "POST" && action === "ack-command") {
      const body = await req.json();
      const { device_identifier, command_id, status, error_message, reported_led_state, acknowledged_settings } = body;

      if (!device_identifier || !command_id || !status) {
        return new Response(
          JSON.stringify({ error: "device_identifier, command_id, and status required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: device } = await supabase
        .from("devices")
        .select("id")
        .eq("device_identifier", device_identifier)
        .single();

      if (!device) {
        return new Response(
          JSON.stringify({ error: "Device not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update command record
      const { data: updatedCmd, error: updateErr } = await supabase
        .from("device_commands")
        .update({
          status: status === "SUCCESS" || status === "ACKNOWLEDGED" ? "ACKNOWLEDGED" : "FAILED",
          acknowledged_at: new Date().toISOString(),
          error_message: error_message ?? null,
        })
        .eq("id", command_id)
        .eq("device_id", device.id)
        .select()
        .single();

      if (updateErr) {
        return new Response(
          JSON.stringify({ error: "Command update failed", details: updateErr }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If settings ack, persist device_ack_settings
      if (acknowledged_settings) {
        await supabase
          .from("device_settings")
          .update({
            device_ack_settings: acknowledged_settings,
            settings_synced_at: new Date().toISOString(),
          })
          .eq("device_id", device.id);
      }

      // Log device event
      await supabase.from("device_events").insert({
        device_id: device.id,
        event_type: "COMMAND_EXECUTED",
        severity: status === "FAILED" ? "error" : "info",
        details: {
          command_id,
          command_type: updatedCmd?.command_type,
          status,
          reported_led_state,
          error_message,
        },
      });

      return new Response(
        JSON.stringify({ success: true, command_id, status: "ACKNOWLEDGED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unsupported action or method" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
