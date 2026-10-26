-- Migration: 20261026_init_adaptive_lighting.sql
-- Complete Adaptive Lighting System Database Schema
-- Supports ESP32 with LDR, LED, and Phase 2 PIR sensor architecture

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_identifier TEXT UNIQUE NOT NULL,
    device_secret_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'ESP32 Lighting Controller',
    firmware_version TEXT DEFAULT '1.0.0',
    is_online BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    wifi_rssi INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Device Settings Table
CREATE TABLE IF NOT EXISTS public.device_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    automatic_mode BOOLEAN NOT NULL DEFAULT true,
    dark_threshold INTEGER NOT NULL DEFAULT 1500 CHECK (dark_threshold >= 0 AND dark_threshold <= 4095),
    light_threshold INTEGER NOT NULL DEFAULT 1800 CHECK (light_threshold >= 0 AND light_threshold <= 4095),
    dark_polarity_inverted BOOLEAN NOT NULL DEFAULT false, -- false: lower ADC = darker, true: higher ADC = darker
    reading_interval_seconds INTEGER NOT NULL DEFAULT 5 CHECK (reading_interval_seconds >= 2 AND reading_interval_seconds <= 300),
    device_ack_settings JSONB DEFAULT NULL, -- confirmed settings reported back by ESP32
    settings_synced_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_device_settings_device_id UNIQUE (device_id)
);

-- 3. Sensor Readings Table (Timeseries / Ingestion)
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    ldr_raw INTEGER NOT NULL CHECK (ldr_raw >= 0 AND ldr_raw <= 4095),
    light_condition TEXT NOT NULL CHECK (light_condition IN ('Bright', 'Dim', 'Dark')),
    reported_led_state BOOLEAN NOT NULL,
    wifi_rssi INTEGER,
    -- Reserved fields for Phase 2 PIR motion sensor (nullable in current Phase 1)
    pir_motion_detected BOOLEAN DEFAULT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Device Commands Table (Remote commands like manual override, threshold update)
CREATE TABLE IF NOT EXISTS public.device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    command_type TEXT NOT NULL CHECK (command_type IN ('SET_LED', 'SET_MODE', 'SET_SETTINGS', 'REBOOT')),
    command_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'FAILED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    error_message TEXT
);

-- 5. Device Events Table (State transitions, connectivity, mode changes)
CREATE TABLE IF NOT EXISTS public.device_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for high-performance telemetry querying
CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_time 
    ON public.sensor_readings (device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_commands_pending 
    ON public.device_commands (device_id, status) 
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_device_events_device_time 
    ON public.device_events (device_id, created_at DESC);

-- Realtime publication configuration
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_events;

-- Enable Row Level Security (RLS)
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;

-- Anonymous and Authenticated read policies for the Dashboard
-- (In a single-tenant or authenticated dashboard context, allow authenticated & anon dashboard read access)
CREATE POLICY "Allow public read access to devices"
    ON public.devices FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to device_settings"
    ON public.device_settings FOR SELECT
    USING (true);

CREATE POLICY "Allow public update access to device_settings"
    ON public.device_settings FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public read access to sensor_readings"
    ON public.sensor_readings FOR SELECT
    USING (true);

CREATE POLICY "Allow public read and insert on device_commands"
    ON public.device_commands FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public read access to device_events"
    ON public.device_events FOR SELECT
    USING (true);

-- Seed Initial Default Device & Settings for Quickstart
INSERT INTO public.devices (
    device_identifier, 
    device_secret_hash, 
    name, 
    firmware_version, 
    is_online, 
    last_seen_at
) VALUES (
    'ESP32-LIGHT-001',
    crypt('esp32_super_secret_token_123', gen_salt('bf')),
    'Living Room Adaptive Light',
    '1.0.0',
    false,
    NULL
) ON CONFLICT (device_identifier) DO NOTHING;

INSERT INTO public.device_settings (
    device_id,
    automatic_mode,
    dark_threshold,
    light_threshold,
    dark_polarity_inverted,
    reading_interval_seconds
) 
SELECT 
    id, 
    true, 
    1500, 
    1800, 
    false, 
    5 
FROM public.devices 
WHERE device_identifier = 'ESP32-LIGHT-001'
ON CONFLICT (device_id) DO NOTHING;
