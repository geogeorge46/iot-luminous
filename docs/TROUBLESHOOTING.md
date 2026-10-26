# Troubleshooting Guide — ESP32 Adaptive Lighting System

This guide outlines diagnoses and resolutions for common IoT hardware, network, and dashboard issues.

---

## 1. Device Connection & Wi-Fi Issues

### Symptom: Dashboard displays "Device Offline" with a red banner
1. **Check Serial Monitor**:
   - Connect the ESP32 to your computer via USB and open Serial Monitor at **115200 baud**.
   - Check if Wi-Fi is stuck on `Connecting to SSID...`.
2. **Verify 2.4 GHz Band**:
   - The ESP32 only supports 2.4 GHz Wi-Fi networks (it does not connect to 5 GHz-only SSIDs).
3. **Inspect Edge Function URL**:
   - In `config.h`, confirm `SUPABASE_HOST` matches your exact Supabase project reference: `<your-project-ref>.supabase.co`.
4. **Autonomous Fallback**:
   - Even when Wi-Fi is disconnected, notice that the ESP32 continues to control the LED autonomously based on light levels! This is by design.

---

## 2. Threshold Calibration & LED Flickering

### Symptom: LED rapidly flickers when the room reaches sunset or dusk
- **Cause**: The turn-on and turn-off thresholds are too close together or identical (insufficient hysteresis).
- **Resolution**:
  - Open **Lighting Controls** in the dashboard.
  - Set a minimum gap of at least **250 to 400 ADC units** between the Turn-ON and Turn-OFF thresholds.
  - Example: Turn ON when reading falls below `1400`; Turn OFF when reading rises above `1750`.

### Symptom: LED turns ON in bright light and OFF in the dark
- **Cause**: Your LDR voltage divider has inverted polarity (the 10kΩ resistor is connected to 3.3V instead of GND).
- **Resolution**:
  - Run the **5-Step Interactive Calibration Wizard** in **Device Settings**. It will detect the inverted slope automatically and apply the correct polarity flag.
  - Or manually toggle **"Inverted Polarity"** under Lighting Controls.

---

## 3. Remote Commands Not Executing

### Symptom: Manual commands stay stuck in "Pending" status and expire after 30 seconds
- **Cause**: The ESP32 is either offline or the polling interval is longer than the command expiration window.
- **Resolution**:
  - Commands automatically expire after 30 seconds to prevent stale actuation (e.g., preventing a light from unexpectedly turning on hours later after a reconnect).
  - Check the device upload interval in **Device Settings**. Ensure it is set to **5 seconds** for responsive remote commands.
  - Confirm the `x-device-token` in `config.h` matches the token registered in your database or Supabase Edge Function environment.

---

## 4. HTTPS & SSL Certificate Validation

### Symptom: ESP32 Serial prints `[HTTPS] Ingest failed, code: -1`
- **Cause**: SSL handshake failure or network timeout.
- **Resolution**:
  - Ensure your ESP32 system clock is relatively synchronized or use the ISRG Root X1 CA certificate provided in `AdaptiveLightingESP32.ino`.
  - In development environments with internal proxies, `client.setInsecure()` can be used to bypass root certificate pinning during bench testing.

---

## 5. Demo Mode vs Production Live Mode

### Symptom: Why are readings changing when no hardware is plugged in?
- You are viewing **Demo Mode**! Look at the top banner. Demo Mode runs an authentic simulated photodiode engine directly in the browser so that frontend UI and charts can be thoroughly verified without physical hardware.
- Click **"Exit Demo"** in the top navigation bar to switch to live Supabase database telemetry.
