-- GTFS Database Schema (Minimal - for real-time transit only)

-- Stops table - all we need for location-based queries
CREATE TABLE IF NOT EXISTS stops (
  stop_id TEXT PRIMARY KEY,
  stop_name TEXT NOT NULL,
  stop_code TEXT,
  stop_lat REAL NOT NULL,
  stop_lon REAL NOT NULL,
  stop_url TEXT,
  agency TEXT
);

-- Create spatial index for nearby stops queries
CREATE INDEX IF NOT EXISTS idx_stops_lat_lon ON stops(stop_lat, stop_lon);

-- Routes table - optional metadata for display (route colors, names, etc.)
CREATE TABLE IF NOT EXISTS routes (
  route_id TEXT PRIMARY KEY,
  route_short_name TEXT,
  route_long_name TEXT,
  route_type INTEGER,
  route_color TEXT,
  route_text_color TEXT,
  route_url TEXT,
  agency_id TEXT
);

-- Stop-Route mapping - which routes serve which stops
CREATE TABLE IF NOT EXISTS stop_routes (
  stop_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  PRIMARY KEY (stop_id, route_id),
  FOREIGN KEY (stop_id) REFERENCES stops(stop_id),
  FOREIGN KEY (route_id) REFERENCES routes(route_id)
);

-- Index for fast route lookups
CREATE INDEX IF NOT EXISTS idx_stop_routes_route ON stop_routes(route_id);