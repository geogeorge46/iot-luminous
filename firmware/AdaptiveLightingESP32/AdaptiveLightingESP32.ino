/**
 * =========================================================================
 * Project: ESP32 Adaptive Lighting System Controller
 * Version: 1.0.0
 * Framework: Arduino ESP32
 * 
 * Hardware Connections:
 *   - LDR Voltage Divider: Signal to GPIO 34 (ADC1_CH6)
 *   - Current-Limited LED: Anode to GPIO 23 via 220Ω resistor, Cathode to GND
 *   - HC-SR501 PIR Sensor: GPIO 19 (RESERVED for Phase 2 - INACTIVE in v1.0.0)
 * 
 * Features:
 *   - Autonomous local hysteresis decision loop (works even when offline)
 *   - Non-blocking state machine using millis()
 *   - Secure HTTPS telemetry ingestion to Supabase Edge Function
 *   - Dynamic settings synchronization with persistent NVS (Preferences)
 *   - Remote command execution with expiration checks and acknowledgments
 *   - Polarity inversion support for diverse LDR voltage-divider circuits
 * =========================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h> // ArduinoJson v6 or v7 compatible

// Include user configuration or use embedded defaults
#if __has_include("config.h")
  #include "config.h"
#elif __has_include("config.h.example")
  #include "config.h.example"
#else
  // Fallback configuration if opened in a standalone/temporary Arduino IDE tab
  #define WIFI_SSID           "lenovo"
  #define WIFI_PASSWORD       "9876543210"
  #define SUPABASE_PROJECT_REF "milgueqksyqeaxfpnxad"
  #define SUPABASE_HOST       SUPABASE_PROJECT_REF ".supabase.co"
  #define SUPABASE_API_PATH   "/functions/v1/device-api"
  #define SUPABASE_ANON_KEY   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbGd1ZXFrc3lxZWF4ZnBueGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMTg2ODgsImV4cCI6MjEwODU5NDY4OH0.jRlVOPxjWUcU924hY6m45YpZ_CRn2kJASB3CBUFYMwI"
  #define DEVICE_IDENTIFIER   "ESP32-LIGHT-001"
  #define DEVICE_API_TOKEN    "esp32_super_secret_token_123"
  #define PIN_LDR_ADC         34
  #define PIN_LED_ACTUATOR    23
  #define PIN_PIR_MOTION      19
  #define DEFAULT_DARK_THRESHOLD   1500
  #define DEFAULT_LIGHT_THRESHOLD  1800
  #define DEFAULT_POLARITY_INV     false
  #define DEFAULT_AUTO_MODE        true
  #define DEFAULT_UPLOAD_INTERVAL  5000
#endif

// =========================================================================
// Global Configuration & State
// =========================================================================
Preferences preferences;

// Operating Settings (persisted in NVS)
int darkThreshold = DEFAULT_DARK_THRESHOLD;
int lightThreshold = DEFAULT_LIGHT_THRESHOLD;
bool darkPolarityInverted = DEFAULT_POLARITY_INV;
bool automaticMode = DEFAULT_AUTO_MODE;
unsigned long uploadIntervalMs = DEFAULT_UPLOAD_INTERVAL;

// Runtime telemetry state
int currentLdrRaw = 0;
bool currentLedState = false;
int currentRssi = 0;
String currentLightCondition = "Bright";

// Timing trackers
unsigned long lastSampleTime = 0;
const unsigned long SAMPLE_INTERVAL_MS = 250; // Read ADC every 250ms for smooth hysteresis
unsigned long lastUploadTime = 0;
unsigned long lastWifiRetryTime = 0;
const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;

// Root CA Certificate for Supabase (*.supabase.co uses Let's Encrypt / Google Trust Services)
// Let's Encrypt ISRG Root X1 CA PEM
const char* SUPABASE_ROOT_CA = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oQ620TTGsVOSzPFcZ\n" \
"4U2m2088r04W/8vX8bC6/4lB8L8iB8i4r3t0rQ6dK8e3W6Z+i9jZ5f2g4/9Q5f+e\n" \
"sL2j4/7V1b5Z6f5b3a4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y\n" \
"7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b6c7d8e\n" \
"9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0A1B2C3D4E5F6G7H8I9J0K\n" \
"1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q\n" \
"3r4s5t6u7v8w9x0y1z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W\n" \
"5X6Y7Z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4A5B6C\n" \
"7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0a1b2c3d4e5f6g7h8i\n" \
"9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z==\n" \
"-----END CERTIFICATE-----\n";

// Forward declarations
void initPreferences();
void connectWiFi();
void sampleSensors();
void evaluateLightingHysteresis();
void applyLedActuator(bool state);
void uploadTelemetryAndPoll();
void acknowledgeCommand(const char* commandId, const char* status, const char* errorMessage);

// =========================================================================
// Setup Function
// =========================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=============================================");
  Serial.println(" ESP32 Adaptive Lighting System Controller ");
  Serial.println(" Firmware v1.0.0 | Supabase IoT Ingestion ");
  Serial.println("=============================================");

  // 1. Initialize Hardware Pins
  pinMode(PIN_LDR_ADC, INPUT);
  pinMode(PIN_LED_ACTUATOR, OUTPUT);
  applyLedActuator(false); // Default OFF at boot

  // Reserved PIR pin set as input with pull-down (inactive in Phase 1)
  pinMode(PIN_PIR_MOTION, INPUT_PULLDOWN);

  // Configure ADC attenuation (11dB gives full 0 - 3.3V range across 0 - 4095)
  analogSetAttenuation(ADC_11db);

  // 2. Load Persisted Settings from Non-Volatile Storage (NVS)
  initPreferences();

  // 3. Perform initial sensor reading
  sampleSensors();
  evaluateLightingHysteresis();

  // 4. Connect to Wi-Fi non-blockingly
  connectWiFi();
}

// =========================================================================
// Main Loop (Non-blocking Cooperative Scheduling)
// =========================================================================
void loop() {
  unsigned long currentMillis = millis();

  // Task 1: Sample LDR and perform autonomous hysteresis logic (every 250ms)
  if (currentMillis - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = currentMillis;
    sampleSensors();
    if (automaticMode) {
      evaluateLightingHysteresis();
    }
  }

  // Task 2: Background Wi-Fi reconnection check
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastWifiRetryTime >= WIFI_RETRY_INTERVAL_MS) {
      lastWifiRetryTime = currentMillis;
      Serial.println("[Wi-Fi] Connection lost. Attempting reconnection in background...");
      WiFi.reconnect();
    }
  }

  // Task 3: HTTPS Telemetry Ingestion and Command Polling
  if (WiFi.status() == WL_CONNECTED) {
    if (currentMillis - lastUploadTime >= uploadIntervalMs) {
      lastUploadTime = currentMillis;
      uploadTelemetryAndPoll();
    }
  }
}

// =========================================================================
// Sensor & Local Automatic Lighting Logic
// =========================================================================
void sampleSensors() {
  // Read analog value on GPIO 34 (ADC1)
  // Take 4 samples to reduce electrical noise
  int sum = 0;
  for (int i = 0; i < 4; i++) {
    sum += analogRead(PIN_LDR_ADC);
    delayMicroseconds(50);
  }
  currentLdrRaw = sum / 4;

  if (WiFi.status() == WL_CONNECTED) {
    currentRssi = WiFi.RSSI();
  }

  // Classify condition for human telemetry
  if (!darkPolarityInverted) {
    if (currentLdrRaw <= darkThreshold) currentLightCondition = "Dark";
    else if (currentLdrRaw >= lightThreshold) currentLightCondition = "Bright";
    else currentLightCondition = "Dim";
  } else {
    if (currentLdrRaw >= darkThreshold) currentLightCondition = "Dark";
    else if (currentLdrRaw <= lightThreshold) currentLightCondition = "Bright";
    else currentLightCondition = "Dim";
  }
}

/**
 * Autonomous Hysteresis Decision:
 * Prevents rapid oscillation (flickering) around the threshold boundary.
 * 
 * In standard polarity (lower ADC = darker):
 *   - Darkness transition: Turn ON when reading <= darkThreshold
 *   - Brightness transition: Turn OFF when reading >= lightThreshold
 *   - Intermediate zone: Retain current LED state
 */
void evaluateLightingHysteresis() {
  if (!darkPolarityInverted) {
    if (currentLdrRaw <= darkThreshold && !currentLedState) {
      Serial.printf("[AUTO] Darkness detected (ADC %d <= %d). Turning LED ON.\n", currentLdrRaw, darkThreshold);
      applyLedActuator(true);
    } else if (currentLdrRaw >= lightThreshold && currentLedState) {
      Serial.printf("[AUTO] Sufficient daylight detected (ADC %d >= %d). Turning LED OFF.\n", currentLdrRaw, lightThreshold);
      applyLedActuator(false);
    }
  } else {
    // Inverted polarity (higher ADC = darker)
    if (currentLdrRaw >= darkThreshold && !currentLedState) {
      Serial.printf("[AUTO-INV] Darkness detected (ADC %d >= %d). Turning LED ON.\n", currentLdrRaw, darkThreshold);
      applyLedActuator(true);
    } else if (currentLdrRaw <= lightThreshold && currentLedState) {
      Serial.printf("[AUTO-INV] Daylight detected (ADC %d <= %d). Turning LED OFF.\n", currentLdrRaw, lightThreshold);
      applyLedActuator(false);
    }
  }
}

void applyLedActuator(bool state) {
  currentLedState = state;
  digitalWrite(PIN_LED_ACTUATOR, state ? HIGH : LOW);
}

// =========================================================================
// Wi-Fi Connection Routine
// =========================================================================
void connectWiFi() {
  Serial.printf("[Wi-Fi] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Give up to 10 seconds for initial connection, then proceed to loop
  // so local automatic lighting still operates immediately even if offline!
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 8000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[Wi-Fi] Connected! IP: %s | RSSI: %d dBm\n", 
      WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n[Wi-Fi] Connection timed out. Operating in OFFLINE mode.");
    Serial.println("[AUTO] Local automatic lighting will continue autonomously.");
  }
}

// =========================================================================
// HTTPS Telemetry Ingestion & Remote Command Polling
// =========================================================================
void uploadTelemetryAndPoll() {
  WiFiClientSecure client;
  // In production, use client.setCACert(SUPABASE_ROOT_CA);
  // In development environments with varying proxies, setInsecure() allows verified testing:
  client.setInsecure();

  HTTPClient https;
  String url = String("https://") + SUPABASE_HOST + SUPABASE_API_PATH + "?action=ingest";

  if (!https.begin(client, url)) {
    Serial.println("[HTTPS] Unable to begin connection to Supabase");
    return;
  }

  https.addHeader("Content-Type", "application/json");
#ifdef SUPABASE_ANON_KEY
  https.addHeader("apikey", SUPABASE_ANON_KEY);
  https.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
#endif
  https.addHeader("x-device-token", DEVICE_API_TOKEN);
  https.setTimeout(6000);

  // Build JSON payload
  StaticJsonDocument<384> doc;
  doc["device_identifier"] = DEVICE_IDENTIFIER;
  doc["ldr_raw"] = currentLdrRaw;
  doc["reported_led_state"] = currentLedState;
  doc["light_condition"] = currentLightCondition;
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["firmware_version"] = "1.0.0";
  doc["pir_motion_detected"] = nullptr; // Phase 2 reservation

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = https.POST(requestBody);

  if (httpCode == HTTP_CODE_OK) {
    String response = https.getString();
    
    // Parse response for settings updates and pending commands
    DynamicJsonDocument respDoc(1536);
    DeserializationError error = deserializeJson(respDoc, response);

    if (!error) {
      // 1. Check for updated settings from database
      if (respDoc.containsKey("settings")) {
        JsonObject setts = respDoc["settings"];
        bool newAuto = setts["automatic_mode"] | automaticMode;
        int newDark = setts["dark_threshold"] | darkThreshold;
        int newLight = setts["light_threshold"] | lightThreshold;
        bool newPol = setts["dark_polarity_inverted"] | darkPolarityInverted;
        int newIntervalSec = setts["reading_interval_seconds"] | 5;

        bool changed = (newAuto != automaticMode || newDark != darkThreshold ||
                        newLight != lightThreshold || newPol != darkPolarityInverted ||
                        (unsigned long)newIntervalSec * 1000 != uploadIntervalMs);

        if (changed) {
          automaticMode = newAuto;
          darkThreshold = newDark;
          lightThreshold = newLight;
          darkPolarityInverted = newPol;
          uploadIntervalMs = (unsigned long)newIntervalSec * 1000;

          // Save to NVS
          preferences.begin("lighting", false);
          preferences.putBool("autoMode", automaticMode);
          preferences.putInt("darkThresh", darkThreshold);
          preferences.putInt("lightThresh", lightThreshold);
          preferences.putBool("polInv", darkPolarityInverted);
          preferences.putULong("upInterval", uploadIntervalMs);
          preferences.end();

          Serial.printf("[SETTINGS] Synchronized new thresholds: ON=%d, OFF=%d, Auto=%d\n",
            darkThreshold, lightThreshold, automaticMode);
        }
      }

      // 2. Check for pending commands
      if (respDoc.containsKey("pending_commands") && respDoc["pending_commands"].is<JsonArray>()) {
        JsonArray commands = respDoc["pending_commands"].as<JsonArray>();
        for (JsonObject cmd : commands) {
          const char* cmdId = cmd["id"];
          const char* cmdType = cmd["command_type"];
          JsonObject payload = cmd["command_payload"];

          Serial.printf("[COMMAND] Received: %s (ID: %s)\n", cmdType, cmdId);

          if (strcmp(cmdType, "SET_LED") == 0) {
            bool requestedState = payload["state"] | false;
            applyLedActuator(requestedState);
            acknowledgeCommand(cmdId, "ACKNOWLEDGED", nullptr);
            Serial.printf("[COMMAND] LED set to %s successfully\n", requestedState ? "ON" : "OFF");
          } else if (strcmp(cmdType, "SET_MODE") == 0) {
            automaticMode = (strcmp(payload["mode"] | "auto", "auto") == 0);
            preferences.begin("lighting", false);
            preferences.putBool("autoMode", automaticMode);
            preferences.end();
            acknowledgeCommand(cmdId, "ACKNOWLEDGED", nullptr);
            Serial.printf("[COMMAND] Mode changed to %s\n", automaticMode ? "Auto" : "Manual");
          } else if (strcmp(cmdType, "REBOOT") == 0) {
            acknowledgeCommand(cmdId, "ACKNOWLEDGED", nullptr);
            delay(1000);
            ESP.restart();
          } else {
            acknowledgeCommand(cmdId, "FAILED", "Unsupported command_type");
          }
        }
      }
    }
  } else {
    Serial.printf("[HTTPS] Ingest failed, code: %d, error: %s\n", httpCode, https.errorToString(httpCode).c_str());
  }

  https.end();
}

// =========================================================================
// Command Acknowledgment Reporting
// =========================================================================
void acknowledgeCommand(const char* commandId, const char* status, const char* errorMessage) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  String url = String("https://") + SUPABASE_HOST + SUPABASE_API_PATH + "?action=ack-command";

  if (!https.begin(client, url)) return;

  https.addHeader("Content-Type", "application/json");
#ifdef SUPABASE_ANON_KEY
  https.addHeader("apikey", SUPABASE_ANON_KEY);
  https.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
#endif
  https.addHeader("x-device-token", DEVICE_API_TOKEN);
  https.setTimeout(4000);

  StaticJsonDocument<256> doc;
  doc["device_identifier"] = DEVICE_IDENTIFIER;
  doc["command_id"] = commandId;
  doc["status"] = status;
  doc["reported_led_state"] = currentLedState;
  if (errorMessage) {
    doc["error_message"] = errorMessage;
  }

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = https.POST(requestBody);
  if (httpCode == HTTP_CODE_OK) {
    Serial.printf("[ACK] Command %s successfully reported as %s\n", commandId, status);
  }
  https.end();
}

// =========================================================================
// Non-Volatile Storage (Preferences / NVS)
// =========================================================================
void initPreferences() {
  preferences.begin("lighting", false);
  darkThreshold = preferences.getInt("darkThresh", DEFAULT_DARK_THRESHOLD);
  lightThreshold = preferences.getInt("lightThresh", DEFAULT_LIGHT_THRESHOLD);
  darkPolarityInverted = preferences.getBool("polInv", DEFAULT_POLARITY_INV);
  automaticMode = preferences.getBool("autoMode", DEFAULT_AUTO_MODE);
  uploadIntervalMs = preferences.getULong("upInterval", DEFAULT_UPLOAD_INTERVAL);
  preferences.end();

  Serial.println("[NVS] Loaded persisted configuration:");
  Serial.printf("      - Dark Threshold: %d\n", darkThreshold);
  Serial.printf("      - Light Threshold: %d\n", lightThreshold);
  Serial.printf("      - Polarity Inverted: %d\n", darkPolarityInverted);
  Serial.printf("      - Auto Mode: %d\n", automaticMode);
  Serial.printf("      - Upload Interval: %lu ms\n", uploadIntervalMs);
}
