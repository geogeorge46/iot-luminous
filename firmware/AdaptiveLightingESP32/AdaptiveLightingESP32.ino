/**
 * =========================================================================
 * Project: ESP32 Adaptive Lighting System Controller
 * Version: 1.1.0
 * Framework: Arduino ESP32
 * 
 * Hardware Connections:
 *   - LDR Voltage Divider: Signal to GPIO 34 (ADC1_CH6)
 *   - External Actuator LED: GPIO 23 through 220Ω resistor
 *   - Onboard Blue Indicator LED: GPIO 2
 *   - HC-SR501 PIR Motion Sensor: GPIO 19 (Reserved for Phase 2)
 * 
 * Features:
 *   - Autonomous local hysteresis decision loop (anti-flicker)
 *   - Bidirectional HTTPS sync with Supabase Edge Functions / Dashboard
 *   - Remote manual LED override (Turn ON / Turn OFF from anywhere)
 *   - Automatic Mode vs Manual Mode state switching
 *   - Dual LED indicator (External breadboard LED + Onboard Blue LED)
 * =========================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ─────────────────────────────────────────────────────────────
// 1. CONFIGURATION (Loads config.h if present, or uses defaults)
// ─────────────────────────────────────────────────────────────
#if __has_include("config.h")
  #include "config.h"
#else
  const char* WIFI_SSID     = "YOUR_WIFI_SSID";
  const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

  const char* SERVER_URL    = "https://milgueqksyqeaxfpnxad.supabase.co/functions/v1/device-api?action=ingest";
  const char* DEVICE_TOKEN  = "esp32_super_secret_token_123";
  const char* ANON_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbGd1ZXFrc3lxZWF4ZnBueGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMTg2ODgsImV4cCI6MjEwODU5NDY4OH0.jRlVOPxjWUcU924hY6m45YpZ_CRn2kJASB3CBUFYMwI";

  #define PIN_LDR_ADC         34   // LDR Sensor (Analog Input)
  #define PIN_EXTERNAL_LED    23   // External LED (through 220Ω resistor)
  #define PIN_ONBOARD_LED      2   // Built-in Blue LED on ESP32 board
#endif

// Operating Thresholds & State
int darkThreshold  = 1500;  // Turn ON when reading <= 1500
int lightThreshold = 1800;  // Turn OFF when reading >= 1800
bool isAutoMode    = true;  // Auto threshold mode vs Remote manual override
bool ledState      = false;

unsigned long lastTransmission = 0;
const unsigned long TRANSMIT_INTERVAL_MS = 3000; // Poll dashboard every 3 seconds for fast response

// ─────────────────────────────────────────────────────────────
// 2. SETUP
// ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(PIN_LDR_ADC, INPUT);
  pinMode(PIN_EXTERNAL_LED, OUTPUT);
  pinMode(PIN_ONBOARD_LED, OUTPUT);

  digitalWrite(PIN_EXTERNAL_LED, LOW);
  digitalWrite(PIN_ONBOARD_LED, LOW);

  analogSetAttenuation(ADC_11db);

  Serial.println("\n=============================================");
  Serial.println(" ESP32 Adaptive Lighting System Controller ");
  Serial.println(" Firmware v1.1.0 | Bidirectional IoT Sync ");
  Serial.println("=============================================");
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection Failed! Operating in local offline mode.");
  }
}

// ─────────────────────────────────────────────────────────────
// 3. TRANSMIT & RECEIVE DASHBOARD COMMANDS (HTTPS)
// ─────────────────────────────────────────────────────────────
void syncWithDashboard(int ldrValue, bool currentLed, const char* condition) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (http.begin(client, SERVER_URL)) {
    http.setTimeout(8000);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + ANON_KEY);
    http.addHeader("x-device-token", DEVICE_TOKEN);

    String payload = "{\"device_identifier\":\"ESP32-LIGHT-001\""
                     ",\"ldr_raw\":" + String(ldrValue) +
                     ",\"reported_led_state\":" + (currentLed ? "true" : "false") +
                     ",\"light_condition\":\"" + String(condition) + "\"" +
                     ",\"wifi_rssi\":" + String(WiFi.RSSI()) +
                     ",\"firmware_version\":\"1.1.0\"}";

    int httpCode = http.POST(payload);

    if (httpCode == 200 || httpCode == 201) {
      String response = http.getString();

      // 1. Check if user switched mode on Dashboard (Auto vs Manual)
      if (response.indexOf("\"automatic_mode\":false") != -1) {
        if (isAutoMode) {
          isAutoMode = false;
          Serial.println("[MODE] Dashboard switched to MANUAL OVERRIDE MODE!");
        }
      } else if (response.indexOf("\"automatic_mode\":true") != -1) {
        if (!isAutoMode) {
          isAutoMode = true;
          Serial.println("[MODE] Dashboard switched to AUTOMATIC THRESHOLD MODE!");
        }
      }

      // 2. Check for Remote "Turn ON" or "Turn OFF" Commands
      if (response.indexOf("\"command_type\":\"SET_LED\"") != -1) {
        if (response.indexOf("\"state\":true") != -1) {
          ledState = true;
          digitalWrite(PIN_EXTERNAL_LED, HIGH);
          digitalWrite(PIN_ONBOARD_LED, HIGH);
          Serial.println("\n>>> [REMOTE COMMAND] Dashboard turned LED ON! <<<");
        } else if (response.indexOf("\"state\":false") != -1) {
          ledState = false;
          digitalWrite(PIN_EXTERNAL_LED, LOW);
          digitalWrite(PIN_ONBOARD_LED, LOW);
          Serial.println("\n>>> [REMOTE COMMAND] Dashboard turned LED OFF! <<<");
        }
      }
    }

    http.end();
  }
}

// ─────────────────────────────────────────────────────────────
// 4. MAIN SENSOR & LIGHTING LOOP
// ─────────────────────────────────────────────────────────────
void loop() {
  // Read LDR (average 4 samples)
  int sum = 0;
  for (int i = 0; i < 4; i++) {
    sum += analogRead(PIN_LDR_ADC);
    delayMicroseconds(50);
  }
  int ldrRaw = sum / 4;

  const char* condition = (ldrRaw <= darkThreshold) ? "Dark" : (ldrRaw < lightThreshold ? "Dim" : "Bright");

  // Autonomous Hysteresis Lighting (runs only if in Automatic Mode)
  if (isAutoMode) {
    if (ldrRaw <= darkThreshold && !ledState) {
      ledState = true;
      digitalWrite(PIN_EXTERNAL_LED, HIGH);
      digitalWrite(PIN_ONBOARD_LED, HIGH);
      Serial.printf("[AUTO] Darkness detected (%d). LED ON.\n", ldrRaw);
    } else if (ldrRaw >= lightThreshold && ledState) {
      ledState = false;
      digitalWrite(PIN_EXTERNAL_LED, LOW);
      digitalWrite(PIN_ONBOARD_LED, LOW);
      Serial.printf("[AUTO] Daylight detected (%d). LED OFF.\n", ldrRaw);
    }
  }

  // Poll dashboard every 3 seconds for sensor upload and remote commands
  if (millis() - lastTransmission >= TRANSMIT_INTERVAL_MS) {
    syncWithDashboard(ldrRaw, ledState, condition);
    lastTransmission = millis();
  }

  delay(200);
}
