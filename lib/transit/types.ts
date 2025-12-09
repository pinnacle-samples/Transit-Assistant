// Agency Mappings
export const AGENCY_NAMES: Record<string, string> = {
  SF: 'SF Muni',
  AC: 'AC Transit',
  BA: 'BART',
  CM: 'Caltrain',
  GG: 'Golden Gate',
  SC: 'SamTrans',
  VT: 'VTA',
};

// Stop Data
export interface StopData {
  stopId: string;
  stopName: string;
  stopCode?: string;
  lat: number;
  lon: number;
  agency: string;
  distance?: number; // in meters
  routeNames?: string[]; // Routes serving this stop
}

// Arrival Info - represents a single arrival event at a stop
export interface ArrivalInfo {
  routeName: string;
  routeNumber: string;
  nextArrival: number; // minutes
  vehicleId?: string;
  delay?: number; // seconds
  vehicleLat?: number;
  vehicleLon?: number;
}

// GTFS Realtime Types (used by wrapper/location.ts)
export interface VehiclePosition {
  id: string;
  routeId: string;
  tripId?: string;
  lat?: number;
  lon?: number;
  bearing?: number;
  speed?: number;
  timestamp?: number;
}

export interface StopArrival {
  stopId: string;
  routeId: string;
  tripId?: string;
  arrivalTime?: number;
  departureTime?: number;
  delay?: number;
}
