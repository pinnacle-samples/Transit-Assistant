/**
 * Internal utility functions for 511 API
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { VehiclePosition, StopArrival } from './types';

const BASE_URL = 'https://api.511.org/transit';
const API_KEY = process.env.API_511_KEY || '';

/**
 * Fetch real-time arrivals for a specific stop from 511 API
 */
export async function fetchStopArrivals(
  stopId: string,
  agency: string = 'SF',
): Promise<StopArrival[]> {
  const url = `${BASE_URL}/TripUpdates?api_key=${API_KEY}&agency=${agency}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    const arrivals: StopArrival[] = feed.entity
      .filter((e) => e.tripUpdate)
      .flatMap((e) => {
        const trip = e.tripUpdate!;
        return (trip.stopTimeUpdate || [])
          .filter((stu) => stu.stopId === stopId)
          .map((stu) => ({
            stopId: stu.stopId || stopId,
            routeId: trip.trip?.routeId || '',
            tripId: trip.trip?.tripId ?? undefined,
            arrivalTime:
              typeof stu.arrival?.time === 'number'
                ? stu.arrival.time
                : stu.arrival?.time?.toNumber(),
            departureTime:
              typeof stu.departure?.time === 'number'
                ? stu.departure.time
                : stu.departure?.time?.toNumber(),
            delay: stu.arrival?.delay ?? undefined,
          }));
      });

    return arrivals;
  } catch (error) {
    console.error(`[511 API] Failed to fetch arrivals:`, error);
    throw new Error(`Failed to fetch arrivals: ${(error as Error).message}`);
  }
}

/**
 * Fetch real-time vehicle positions for a specific route from 511 API
 */
export async function fetchRouteVehicles(
  routeId: string,
  agency: string = 'SF',
): Promise<VehiclePosition[]> {
  const url = `${BASE_URL}/vehiclepositions?api_key=${API_KEY}&agency=${agency}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    const vehicles: VehiclePosition[] = feed.entity
      .filter((e) => e.vehicle && e.vehicle.trip && e.vehicle.trip.routeId === routeId)
      .map((e) => ({
        id: e.id,
        routeId: e.vehicle!.trip!.routeId!,
        tripId: e.vehicle!.trip?.tripId ?? undefined,
        lat: e.vehicle!.position?.latitude,
        lon: e.vehicle!.position?.longitude,
        bearing: e.vehicle!.position?.bearing ?? undefined,
        speed: e.vehicle!.position?.speed ?? undefined,
        timestamp:
          typeof e.vehicle!.timestamp === 'number'
            ? e.vehicle!.timestamp
            : e.vehicle!.timestamp?.toNumber(),
      }));

    return vehicles;
  } catch (error) {
    console.error(`[511 API] Failed to fetch vehicles:`, error);
    throw new Error(`Failed to fetch vehicles: ${(error as Error).message}`);
  }
}
