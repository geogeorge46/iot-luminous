# iot-luminous — ESP32 + Supabase + React Adaptive Lighting Dashboard

A production-minded, full-stack IoT Adaptive Lighting System. Features an autonomous ESP32 microcontroller with ambient LDR light sensing, anti-flicker hysteresis control, secure HTTPS telemetry ingestion to Supabase Edge Functions, and a polished React + Vite + TypeScript dashboard with dark/light themes, live monitoring waveforms, analytics, calibration wizards, and an isolated Demo Mode.

---

## 1. System Architecture

```
 ┌──────────────────────┐               ┌────────────────────────┐
 │   ESP32 Microchip    │               │  Supabase Edge Backend │
 │                      │  HTTPS REST   │                        │
 │  • GPIO 34 (LDR ADC) ├──────────────>│  • Edge Function API   │
 │  • GPIO 23 (LED Out) │ (x-device-tok)│  • Postgres + RLS      │
 │  • Autonomous Logic  │<──────────────┤  • Realtime Engine     │
 │  • Non-volatile NVS  │  Config & Cmd │                        │
 └──────────────────────┘               └───────────┬────────────┘
                                                    │
                                         Realtime   │ WebSockets
                                         & REST     │
                                                    ▼
                                        ┌────────────────────────┐
                                        │  React Dashboard UI    │
                                        │                        │
                                        │  • Overview & Gauges   │
                                        │  • Live Recharts Wave  │
                                        │  • Duty Cycle History  │
                                        │  • Calibration Wizard  │
                                        │  • In-Browser Demo     │
                                        └────────────────────────┘
```

---

## 2. Directory Structure

```
.
├── frontend/                     # React + Vite + TypeScript Application
│   ├── src/
│   │   ├── components/           # Reusable UI cards, headers, drawers
│   │   ├── context/              # DeviceContext (Demo + Supabase) & ThemeContext
│   │   ├── pages/                # Overview, Monitoring, History, Controls, Settings
│   │   ├── lib/                  # Supabase client, utility calculations, CSV exporter
│   │   └── types/                # Strict TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── supabase/
│   ├── migrations/               # PostgreSQL schema, indexes, and RLS policies
│   │   └── 20261026_init_adaptive_lighting.sql
│   └── functions/
│       └── device-api/           # Deno Edge Function for ESP32 HTTPS ingestion
│           └── index.ts
├── firmware/
│   └── AdaptiveLightingESP32/    # ESP32 Arduino sketch
│       ├── AdaptiveLightingESP32.ino
│       └── config.h.example
├── docs/
│   ├── API_CONTRACT.md           # Wire format & JSON schema
│   ├── CIRCUIT_DIAGRAM.md        # Pinouts and voltage divider schematics
│   └── TROUBLESHOOTING.md        # Network, calibration, and command diagnostics
├── .env.example                  # Environment configuration template
└── README.md
```

---

## 3. Quickstart & Installation

### Step A: Launch Frontend (Demo Mode works immediately!)
You can test the full dashboard without any hardware or Supabase credentials using built-in **Demo Mode**:

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Open your browser to `http://localhost:3000`. You will see the interactive **DEMO DATA — NOT CONNECTED TO HARDWARE** banner with an ambient light slider, live waveforms, and simulated ESP32 responses.

---

### Step B: Configure Supabase Database & Edge Function

1. **Apply Database Migration**:
   In your Supabase project dashboard, navigate to the **SQL Editor** and execute the script in:
   `supabase/migrations/20261026_init_adaptive_lighting.sql`.
   This sets up `devices`, `sensor_readings`, `device_settings`, `device_commands`, `device_events`, and RLS policies.

2. **Deploy Edge Function**:
   Using the Supabase CLI:
   ```bash
   supabase functions deploy device-api --no-verify-jwt
   supabase secrets set DEVICE_API_TOKEN="esp32_super_secret_token_123"
   ```

3. **Configure Frontend Environment Variables**:
   In `frontend/`, create a `.env` file:
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

---

### Step C: Flash the ESP32 Hardware Node

1. Open `firmware/AdaptiveLightingESP32/AdaptiveLightingESP32.ino` in Arduino IDE or VS Code PlatformIO.
2. Ensure you have the `ArduinoJson` library installed (Library Manager -> search `ArduinoJson`).
3. Copy `config.h.example` to `config.h`:
   ```c
   #define WIFI_SSID           "Your-WiFi-SSID"
   #define WIFI_PASSWORD       "Your-WiFi-Password"
   #define SUPABASE_PROJECT_REF "your-project-ref"
   #define DEVICE_API_TOKEN    "esp32_super_secret_token_123"
   ```
4. Wire your hardware according to [docs/CIRCUIT_DIAGRAM.md](docs/CIRCUIT_DIAGRAM.md):
   - LDR voltage divider signal to **GPIO 34**.
   - LED anode through 220Ω resistor to **GPIO 23**; cathode to **GND**.
5. Select board **ESP32 Dev Module** and upload the sketch.

---

## 4. Key Engineering Features

- **Autonomous Local Control**: The ESP32 evaluates light thresholds using a non-blocking `millis()` loop. If Wi-Fi disconnects or Supabase is down, the lighting continues to trigger autonomously without interruption.
- **Anti-Flicker Hysteresis**: Separates turn-on and turn-off thresholds (e.g. Turn ON <= 1500; Turn OFF >= 1800) so twilight light fluctuations do not cause rapid flickering.
- **5-Step Interactive Calibration**: Built-in wizard in the dashboard captures bright and dark references, detects circuit polarity, and recommends optimal thresholds.
- **Command Expiration & Idempotency**: Remote manual commands expire after 30 seconds to prevent delayed actuation after device reconnection.
- **Phase 2 PIR Sensor Architecture**: Hardware pin GPIO 19 and database fields are reserved for future dual-sensor occupancy fusion.

---

## 5. Verification & Testing

- **Theme Toggle**: Test switching between charcoal dark mode and clean light mode in the header (persisted in `localStorage`).
- **Demo Slider**: Adjust the "Simulate Ambient ADC" slider in the top banner to watch the LED toggle when passing thresholds.
- **CSV Telemetry Export**: Go to **Sensor History** and click **Export CSV Report** to download telemetry archives.
- **Offline Safeguard**: When hardware disconnects, a top alert banner flags readings as stale and suspends remote overrides.
