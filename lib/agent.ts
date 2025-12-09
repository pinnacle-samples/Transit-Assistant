import { BaseAgent } from './baseAgent';
import { ArrivalInfo, AGENCY_NAMES, StopData } from './transit/types';
import { Pinnacle } from 'rcs-js';

export enum RecentViewType {
  STOP = 'stop',
  ROUTE = 'route',
}

interface RecentView {
  type: RecentViewType;
  id: string;
  name: string;
  agency: string;
  timestamp: number;
}

export class Agent extends BaseAgent {
  private readonly agencyNames = AGENCY_NAMES;
  private recentViews: Map<string, RecentView[]> = new Map();
  private pendingRouteSearches: Map<string, string> = new Map(); //phone number -> routes

  getAgencyName(agencyCode: string): string {
    return this.agencyNames[agencyCode] || agencyCode;
  }

  // Add a stop or route to recent views (max 5 per user)
  addRecentView(userId: string, type: RecentViewType, id: string, name: string, agency: string) {
    const views = this.recentViews.get(userId) || [];

    // Remove if already exists (to update timestamp)
    const filtered = views.filter((v) => !(v.type === type && v.id === id));

    // Add to beginning
    filtered.unshift({
      type,
      id,
      name,
      agency,
      timestamp: Date.now(),
    });

    // Keep only last 5
    this.recentViews.set(userId, filtered.slice(0, 5));
  }

  // Get recent views for a user
  getRecentViews(userId: string): RecentView[] {
    return this.recentViews.get(userId) || [];
  }

  // Store pending route search
  setPendingRouteSearch(userId: string, routeQuery: string) {
    this.pendingRouteSearches.set(userId, routeQuery);
  }

  // Get and clear pending route search
  getPendingRouteSearch(userId: string): string | undefined {
    const query = this.pendingRouteSearches.get(userId);
    this.pendingRouteSearches.delete(userId);
    return query;
  }

  // Check if user has pending route search
  hasPendingRouteSearch(userId: string): boolean {
    return this.pendingRouteSearches.has(userId);
  }

  // Clear pending route search without getting it
  clearPendingRouteSearch(userId: string): void {
    this.pendingRouteSearches.delete(userId);
  }

  // Standard quick reply buttons
  private readonly standardQuickReplies = [
    {
      type: 'trigger' as const,
      title: '📍 Stops Near Me',
      payload: JSON.stringify({ action: 'search_near_me' }),
    },
    {
      type: 'trigger' as const,
      title: '🕒 Recently Viewed',
      payload: JSON.stringify({ action: 'recently_viewed' }),
    },
    {
      type: 'trigger' as const,
      title: '❓ Help',
      payload: JSON.stringify({ action: 'help' }),
    },
  ];

  // Generate map image URL with vehicle marker using Mapbox
  private getMapUrl(lat: number, lon: number): string {
    const zoom = 14;
    const width = 400;
    const height = 300;
    const mapboxToken = process.env.MAPBOX_API_KEY;

    // Mapbox Static Images API: pin-s (small pin) + ff0000 (red color)
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+ff0000(${lon},${lat})/${lon},${lat},${zoom}/${width}x${height}?access_token=${mapboxToken}`;
  }

  // Show arrivals at a specific stop
  async showStopArrivals(to: string, stopId: string, arrivals: ArrivalInfo[], agency: string) {
    const agencyName = this.agencyNames[agency] || agency;

    if (arrivals.length === 0) {
      return await this.client.messages.rcs.send({
        from: this.agentName,
        to: to,
        text: `No upcoming arrivals found for Stop ${stopId} (${agencyName}).`,
        quickReplies: this.standardQuickReplies,
        options: { test_mode: this.TEST_MODE },
      });
    }

    // Build map of unique routes (first arrival for each route)
    const routeMap = new Map<string, ArrivalInfo>();
    for (const arrival of arrivals) {
      if (!routeMap.has(arrival.routeNumber)) {
        routeMap.set(arrival.routeNumber, arrival);
      }
    }

    const uniqueRouteCount = routeMap.size;
    let arrivalsToShow: ArrivalInfo[];

    if (uniqueRouteCount < 3) {
      // Less than 3 unique routes: show up to 3 earliest arrivals
      arrivalsToShow = arrivals.slice(0, 3);
    } else {
      // 3+ unique routes: show one card per route (earliest for each)
      arrivalsToShow = Array.from(routeMap.values());
    }

    const uniqueRoutes = arrivalsToShow;

    const etaCards = uniqueRoutes.map((arrival) => {
      // Get map URL if vehicle position is available
      let mediaUrl = process.env.NO_TRACKING_IMAGE_URL || '';
      if (arrival.vehicleLat && arrival.vehicleLon) {
        mediaUrl = this.getMapUrl(arrival.vehicleLat, arrival.vehicleLon);
      }

      const buttons: Pinnacle.RichButton[] = [];

      // Add "Get Directions" button if vehicle position is available
      if (arrival.vehicleLat && arrival.vehicleLon) {
        buttons.push({
          type: 'sendLocation',
          title: '📍 Show Vehicle Location',
          latLong: {
            lat: arrival.vehicleLat,
            lng: arrival.vehicleLon,
          },
        });
      }

      return {
        title: `Route ${arrival.routeNumber} | ${agencyName}`,
        subtitle: `Stop: ${stopId}\nArriving in: ${arrival.nextArrival} min`,
        media: mediaUrl || undefined,
        buttons,
      };
    });

    return await this.client.messages.rcs.send({
      from: this.agentName,
      to: to,
      cards: etaCards,
      quickReplies: [],
      options: { test_mode: this.TEST_MODE },
    });
  }

  // Request location from user
  async requestLocation(to: string, routeLabel?: string) {
    const text = routeLabel
      ? `Share your location to find the nearest transit stops for ${routeLabel}.`
      : 'Share your location to find the nearest transit stops.';

    return await this.client.messages.rcs.send({
      from: this.agentName,
      to: to,
      text,
      quickReplies: [
        {
          type: 'requestUserLocation',
          title: '📍 Share Location',
        },
        {
          type: 'trigger' as const,
          title: '❓ Help',
          payload: JSON.stringify({ action: 'help' }),
        },
      ],
      options: { test_mode: this.TEST_MODE },
    });
  }

  // Show recent views with quick replies
  async showRecentViews(to: string) {
    const views = this.getRecentViews(to);

    if (views.length === 0) {
      return await this.client.messages.rcs.send({
        from: this.agentName,
        to: to,
        text: "You haven't viewed any stops yet. Try searching for a route or nearby stops.",
        quickReplies: this.standardQuickReplies,
        options: { test_mode: this.TEST_MODE },
      });
    }

    const quickReplies = views.map((view) => {
      const agencyName = this.agencyNames[view.agency];

      if (view.type === RecentViewType.STOP) {
        return {
          type: 'trigger' as const,
          title: `${view.name} | ${agencyName}`,
          subtitle: `Stop ${view.id}`,
          payload: JSON.stringify({
            action: 'show_stop_arrivals',
            agency: view.agency,
            stopId: view.id,
          }),
        };
      } else {
        // Route
        return {
          type: 'trigger' as const,
          title: `Route ${view.name} | ${agencyName}`,
          payload: JSON.stringify({
            action: 'view_recent_route',
            routeNumber: view.id,
          }),
        };
      }
    });

    return await this.client.messages.rcs.send({
      from: this.agentName,
      to: to,
      text: 'Here are your most recently viewed routes and stops',
      quickReplies,
      options: { test_mode: this.TEST_MODE },
    });
  }

  // Show nearby stops as cards with route names and location buttons
  async showNearbyStops(to: string, stops: StopData[]) {
    if (stops.length === 0) {
      return await this.sendMessage(to, 'No stops found nearby.');
    }

    // Build all the cards for each stop
    const cards = stops.map((stop) => {
      const buttons: Pinnacle.RichButton[] = [
        {
          type: 'trigger',
          title: '🚏 View Arrivals',
          payload: JSON.stringify({
            action: 'show_stop_arrivals',
            agency: stop.agency,
            stopId: stop.stopId,
          }),
        },
      ];

      // Add "Get Directions" button if coordinates are available
      if (stop.lat && stop.lon) {
        buttons.unshift({
          type: 'sendLocation',
          title: '📍 Get Directions',
          latLong: {
            lat: stop.lat,
            lng: stop.lon,
          },
        });
      }

      const agencyName = this.agencyNames[stop.agency];

      // Build subtitle with stop name, distance, and routes
      let subtitle = stop.stopName;
      if (stop.distance !== undefined) {
        const distanceMiles = (stop.distance / 1609).toFixed(2);
        subtitle += `\n${distanceMiles} miles away`;
      }
      if (stop.routeNames && stop.routeNames.length > 0) {
        subtitle += `\nRoutes: ${stop.routeNames.join(', ')}`;
      }

      return {
        title: `Stop ID: ${stop.stopId} | ${agencyName}`,
        subtitle,
        buttons,
        media: this.getMapUrl(stop.lat, stop.lon),
      };
    });

    return await this.client.messages.rcs.send({
      from: this.agentName,
      to: to,
      cards,
      quickReplies: [
        {
          type: 'trigger' as const,
          title: '🕒 Recently Viewed',
          payload: JSON.stringify({ action: 'recently_viewed' }),
        },
        {
          type: 'trigger' as const,
          title: '❓ Help',
          payload: JSON.stringify({ action: 'help' }),
        },
      ],
      options: { test_mode: this.TEST_MODE },
    });
  }

  // Main Menu message
  async showMainMenu(to: string) {
    return await this.client.messages.rcs.send({
      from: this.agentName,
      to: to,
      cards: [
        {
          title: 'Get live transit arrivals for all Bay Area transit agencies.',
          subtitle: 'Type a route or stop number to get started!',
          media: process.env.VAROOM_IMAGE_URL || '',
          buttons: [],
        },
      ],
      quickReplies: [
        {
          type: 'trigger',
          title: '🔚 End Demo',
          payload: 'END_DEMO',
        },
        ...this.standardQuickReplies,
      ],
      options: { test_mode: this.TEST_MODE },
    });
  }

  // Send simple text message
  async sendMessage(to: string, text: string) {
    return await this.client.messages.rcs.send({
      from: this.agentName,
      to: to,
      text,
      quickReplies: this.standardQuickReplies,
      options: { test_mode: this.TEST_MODE },
    });
  }

  // Send help message
  async sendHelp(to: string) {
    return await this.client.messages.rcs.send({
      from: this.agentName,
      to: to,
      text: 'How to search:\n\nType "stop [id]" to view arrival times.\n\nType "route [name]" - Find the nearest stops for that route.',
      quickReplies: [
        {
          type: 'trigger' as const,
          title: '📍 Stops Near Me',
          payload: JSON.stringify({ action: 'search_near_me' }),
        },
        {
          type: 'trigger' as const,
          title: '🕒 Recently Viewed',
          payload: JSON.stringify({ action: 'recently_viewed' }),
        },
      ],
      options: { test_mode: this.TEST_MODE },
    });
  }
}

export const agent = new Agent();
