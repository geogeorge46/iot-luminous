# ESP32 Adaptive Lighting System — Circuit Schematics & Wiring

## 1. Pin Assignment Summary

| Component | ESP32 Pin | Signal Type | Notes |
|---|---|---|---|
| **LDR (Light Dependent Resistor)** | **GPIO 34** | Analog Input (ADC1_CH6) | Input-only pin. Unaffected by Wi-Fi. |
| **LED Indicator / Light Actuator** | **GPIO 23** | Digital Output | Connected through a 220Ω - 330Ω resistor. |
| **PIR Motion Sensor (HC-SR501)** | **GPIO 19** | Digital Input | **RESERVED FOR PHASE 2** (Inactive in v1.0.0). |

---

## 2. LDR Voltage Divider Schematic

The LDR resistance varies inversely with light intensity. To convert this variable resistance into a measurable voltage, we arrange it in a voltage divider with a 10 kΩ fixed resistor.

### Option A: Standard Polarity (Default)
In this configuration, darker surroundings result in **lower ADC values**:

```
        3.3V
         │
       ┌─┴─┐
       │   │  LDR (GL5528 or similar)
       │   │
       └─┬─┘
         ├──────────────> To ESP32 GPIO 34 (ADC1_CH6)
       ┌─┴─┐
       │   │  10 kΩ Resistor (Pull-down)
       │   │
       └─┬─┘
         │
        GND
```

* Daylight: LDR resistance drops (~1kΩ) → Voltage near GPIO 34 rises toward 2.8V - 3.2V (ADC 3200 - 3900).
* Darkness: LDR resistance rises (>100kΩ) → Voltage near GPIO 34 drops toward 0.3V (ADC 300 - 800).

---

### Option B: Inverted Polarity
If you wire the 10 kΩ resistor to 3.3V and the LDR to GND:

```
        3.3V
         │
       ┌─┴─┐
       │   │  10 kΩ Resistor (Pull-up)
       │   │
       └─┬─┘
         ├──────────────> To ESP32 GPIO 34 (ADC1_CH6)
       ┌─┴─┐
       │   │  LDR
       │   │
       └─┬─┘
         │
        GND
```

* In darkness, the LDR resistance spikes, pulling the ADC voltage **higher**.
* If you wire your circuit this way, simply enable **"Inverted Polarity"** in the Dashboard Device Settings.

---

## 3. LED Actuator Circuit

```
   ESP32 GPIO 23 ───────[ 220Ω Resistor ]───────( Anode [+] )
                                                   LED
   ESP32 GND     ───────────────────────────────( Cathode [-] )
```

* Forward voltage of typical 5mm white/blue LED: ~3.0V.
* Resistor formula: $R = \frac{V_{esp32} - V_f}{I_f} = \frac{3.3V - 2.0V}{0.015A} \approx 86\Omega$ to $220\Omega$.
* Using 220Ω protects the ESP32 GPIO pin (max 12mA).

---

## 4. Phase 2: HC-SR501 PIR Motion Sensor (Planned)

```
   HC-SR501 VCC ───────> 5V (VIN on DevKit)
   HC-SR501 GND ───────> GND
   HC-SR501 OUT ───────> GPIO 19
```

> **Note**: In Phase 1, the firmware initializes GPIO 19 with an internal pull-down and does not evaluate motion pulses.
