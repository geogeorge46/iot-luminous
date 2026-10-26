# Adaptive Lighting System — ESP32 & Supabase API Contract

This document specifies the exact JSON wire protocol and HTTPS REST contract between the ESP32 hardware node, Supabase Edge Functions, and the React Dashboard.

---

## 1. Authentication

Every request sent by the ESP32 to the Edge Function must present the device secret token via the HTTP header:

```http
x-device-token: esp32_super_secret_token_123
```
Alternatively, as a bearer token:
```http
Authorization: Bearer esp32_super_secret_token_123
```

---

## 2. Ingestion & Settings Polling Endpoint

- **Method**: `POST`
- **Path**: `/functions/v1/device-api?action=ingest`
- **Content-Type**: `application/json`

### ESP32 Request Payload

```json
{
  "device_identifier": "ESP32-LIGHT-001",
  "ldr_raw": 1342,
  "reported_led_state": true,
  "light_condition": "Dark",
  "wifi_rssi": -65,
  "firmware_version": "1.0.0",
  "pir_motion_detected": null
}
```

#### Field Specifications:
| Field | Type | Required | Description |
|---|---|---|---|
| `device_identifier` | string | Yes | Unique hardware serial or MAC identifier |
| `ldr_raw` | integer | Yes | 12-bit ADC value from 0 to 4095 |
| `reported_led_state` | boolean | Yes | Confirmed physical state on GPIO 23 |
| `light_condition` | string | Yes | One of `"Bright"`, `"Dim"`, `"Dark"` |
| `wifi_rssi` | integer | No | Wi-Fi signal strength in dBm |
| `firmware_version` | string | No | Semantic version string |
| `pir_motion_detected` | boolean / null | No | Reserved for Phase 2 PIR motion sensor |

### Server Response Payload (`200 OK`)

```json
{
  "success": true,
  "server_time": "2026-10-26T14:00:00.123Z",
  "settings": {
    "automatic_mode": true,
    "dark_threshold": 1500,
    "light_threshold": 1800,
    "dark_polarity_inverted": false,
    "reading_interval_seconds": 5
  },
  "pending_commands": [
    {
      "id": "e4f8d910-1234-4a5b-9cde-f1234567890a",
      "command_type": "SET_LED",
      "command_payload": { "state": true },
      "expires_at": "2026-10-26T14:00:30.000Z"
    }
  ]
}
```

---

## 3. Command Acknowledgment Endpoint

- **Method**: `POST`
- **Path**: `/functions/v1/device-api?action=ack-command`
- **Content-Type**: `application/json`

### ESP32 Request Payload

```json
{
  "device_identifier": "ESP32-LIGHT-001",
  "command_id": "e4f8d910-1234-4a5b-9cde-f1234567890a",
  "status": "ACKNOWLEDGED",
  "reported_led_state": true,
  "error_message": null
}
```

#### Allowed `status` values:
- `"ACKNOWLEDGED"`: The ESP32 successfully applied the command.
- `"FAILED"`: Command was rejected or failed (details in `error_message`).

### Server Response Payload (`200 OK`)

```json
{
  "success": true,
  "command_id": "e4f8d910-1234-4a5b-9cde-f1234567890a",
  "status": "ACKNOWLEDGED"
}
```

---

## 4. Supported Command Types

1. `SET_LED`: Manual LED state override.
   - Payload: `{ "state": true | false }`
2. `SET_MODE`: Switch between Automatic and Manual modes.
   - Payload: `{ "mode": "auto" | "manual" }`
3. `REBOOT`: Hardware watchdog restart.
   - Payload: `{}`
