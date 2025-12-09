/**
 * Get live transit arrivals for stops
 */

import { ArrivalInfo } from './types';
import { fetchStopArrivals, fetchRouteVehicles } from './util';

/**
 * Get live arrivals for a specific stop
 */
export async function getStopArrivals(
  stopId: string,
  agency: string = 'SF',
): Promise<ArrivalInfo[]> {
  try {
    const arrivals = await fetchStopArrivals(stopId, agency);

    if (!arrivals || arrivals.length === 0) {
      return [];
    }

    // Get unique route IDs to fetch vehicle positions
    const uniqueRoutes = [...new Set(arrivals.map((a) => a.routeId))];
    const vehiclePositions = new Map<string, { lat: number; lon: number }>();

    // Fetch vehicle positions for all routes
    for (const routeId of uniqueRoutes) {
      try {
        const vehicles = await fetchRouteVehicles(routeId, agency);
        for (const vehicle of vehicles) {
          if (vehicle.tripId && vehicle.lat && vehicle.lon) {
            vehiclePositions.set(vehicle.tripId, {
              lat: vehicle.lat,
              lon: vehicle.lon,
            });
          }
        }
      } catch (error) {
        console.error(`Failed to fetch vehicles for route ${routeId}:`, error);
      }
    }

    const routeOptions: ArrivalInfo[] = [];

    for (const arrival of arrivals) {
      // Calculate arrival time in minutes
      let minutesUntilArrival = 0;

      if (arrival.arrivalTime) {
        const arrivalDate = new Date(arrival.arrivalTime * 1000);
        const now = new Date();
        minutesUntilArrival = Math.max(
          0,
          Math.round((arrivalDate.getTime() - now.getTime()) / 60000),
        );
      }

      // Get vehicle position if available
      const vehiclePos = arrival.tripId ? vehiclePositions.get(arrival.tripId) : undefined;

      routeOptions.push({
        routeName: `To ${arrival.routeId}`,
        routeNumber: arrival.routeId,
        nextArrival: minutesUntilArrival,
        vehicleId: arrival.tripId,
        delay: arrival.delay,
        vehicleLat: vehiclePos?.lat,
        vehicleLon: vehiclePos?.lon,
      });
    }

    // Sort by arrival time (soonest first)
    routeOptions.sort((a, b) => a.nextArrival - b.nextArrival);

    return routeOptions;
  } catch (error) {
    console.error(`Error getting arrivals for stop ${stopId}:`, error);
    return [];
  }
}
