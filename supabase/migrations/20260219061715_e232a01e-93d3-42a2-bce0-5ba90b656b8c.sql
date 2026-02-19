
-- ============================================
-- AIRPORT CONTROL MANAGEMENT SYSTEM - SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'atc', 'staff');
CREATE TYPE public.flight_status AS ENUM ('scheduled', 'boarding', 'delayed', 'departed', 'landed', 'cancelled', 'emergency');
CREATE TYPE public.runway_status AS ENUM ('available', 'occupied', 'maintenance', 'closed');
CREATE TYPE public.passenger_boarding_status AS ENUM ('checked_in', 'boarding', 'boarded', 'no_show');
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical', 'emergency');

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================
-- USER ROLES TABLE
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE POLICY "Users can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RUNWAYS TABLE
-- ============================================
CREATE TABLE public.runways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  length_meters INTEGER NOT NULL DEFAULT 3000,
  status runway_status NOT NULL DEFAULT 'available',
  surface_type TEXT NOT NULL DEFAULT 'asphalt',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.runways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view runways" ON public.runways
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and ATC can manage runways" ON public.runways
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'atc')
  );

-- ============================================
-- FLIGHTS TABLE
-- ============================================
CREATE TABLE public.flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number TEXT NOT NULL UNIQUE,
  airline TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  status flight_status NOT NULL DEFAULT 'scheduled',
  scheduled_departure TIMESTAMPTZ NOT NULL,
  scheduled_arrival TIMESTAMPTZ NOT NULL,
  actual_departure TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  runway_id UUID REFERENCES public.runways(id) ON DELETE SET NULL,
  gate TEXT,
  aircraft_type TEXT NOT NULL DEFAULT 'Boeing 737',
  capacity INTEGER NOT NULL DEFAULT 180,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view flights" ON public.flights
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and ATC can manage flights" ON public.flights
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'atc')
  );

CREATE POLICY "Staff can update flight status" ON public.flights
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'staff'));

-- ============================================
-- PASSENGERS TABLE
-- ============================================
CREATE TABLE public.passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  passport_number TEXT NOT NULL,
  seat_number TEXT,
  ticket_id TEXT NOT NULL UNIQUE DEFAULT 'TKT-' || upper(substr(md5(random()::text), 1, 8)),
  boarding_status passenger_boarding_status NOT NULL DEFAULT 'checked_in',
  nationality TEXT NOT NULL DEFAULT 'Unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view passengers" ON public.passengers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and staff can manage passengers" ON public.passengers
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'atc')
  );

-- ============================================
-- ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view activity" ON public.activity_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated can insert activity" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ALERTS TABLE
-- ============================================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'info',
  flight_id UUID REFERENCES public.flights(id) ON DELETE CASCADE,
  runway_id UUID REFERENCES public.runways(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view alerts" ON public.alerts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and ATC can manage alerts" ON public.alerts
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'atc')
  );

CREATE POLICY "Staff can insert alerts" ON public.alerts
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'atc') OR public.has_role(auth.uid(), 'staff')
  );

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  -- Default role: staff
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_flights_updated_at BEFORE UPDATE ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_runways_updated_at BEFORE UPDATE ON public.runways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_passengers_updated_at BEFORE UPDATE ON public.passengers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- REALTIME: Enable for live updates
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.flights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.runways;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passengers;

-- ============================================
-- SEED: Initial runways
-- ============================================
INSERT INTO public.runways (name, length_meters, status, surface_type, notes) VALUES
  ('Runway 01L', 3800, 'available', 'asphalt', 'Primary landing runway'),
  ('Runway 01R', 3600, 'available', 'asphalt', 'Primary takeoff runway'),
  ('Runway 19L', 3200, 'available', 'concrete', 'Secondary landing runway'),
  ('Runway 19R', 3000, 'available', 'concrete', 'Secondary runway'),
  ('Runway 10', 2800, 'maintenance', 'asphalt', 'Under maintenance');
