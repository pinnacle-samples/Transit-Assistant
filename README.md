# Transit Assistant

A Bay Area transit chatbot built with Pinnacle RCS that provides real-time transit information for all major Bay Area transit agencies.

https://github.com/user-attachments/assets/074fb330-293a-4e9d-af82-c8757de56f92

## Features

- **Stop Arrivals**: Get real-time arrival times for any transit stop by typing `stop [id]`
- **Route Search**: Find the nearest stops for a route by typing `route [name]` and sharing your location
- **Nearby Stops**: Share your location to discover transit stops near you
- **Live Vehicle Tracking**: See real-time vehicle positions on maps for supported routes
- **Recent Views**: Quick access to your recently viewed stops and routes
- **Multi-Agency Support**: Supports SF Muni, AC Transit, BART, Caltrain, Golden Gate Transit, SamTrans, and VTA

## Prerequisites

- Node.js 18 or higher
- A Pinnacle API key (get one at [trypinnacle.app](https://trypinnacle.app))
- A 511 API key for Bay Area transit data (get one at [511.org](https://511.org))
- A Mapbox API key for map visualization (get one at [mapbox.com](https://mapbox.com))

## Installation

1. Clone this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the example environment file and configure it:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your API keys:

   - `PINNACLE_API_KEY`: Your Pinnacle API key
   - `PINNACLE_AGENT_ID`: Your RCS agent ID
   - `PINNACLE_SIGNING_SECRET`: Your webhook signing secret (found in the [Pinnacle Webhooks Dashboard](https://app.pinnacle.sh/dashboard/development/webhooks))
   - `API_511_KEY`: Your 511.org API key
   - `MAPBOX_API_KEY`: Your Mapbox API key

5. Download and import GTFS data:

   ```bash
   npm run update-db
   ```

6. Set up a public HTTPS URL for your webhook. For local development, you can use a tunneling service like [ngrok](https://ngrok.com):

   ```bash
   ngrok http 3000
   ```

   For production, deploy to your preferred hosting provider.

7. Connect your webhook to your RCS agent:

   - Go to the [Pinnacle Webhooks Dashboard](https://app.pinnacle.sh/dashboard/development/webhooks)
   - Add your public URL with the `/webhook` path (e.g., `https://your-domain.com/webhook`)
   - Select your RCS agent to receive messages at this endpoint
   - Copy the signing secret and add it to your `.env` file as `PINNACLE_SIGNING_SECRET`

8. Text "MENU" to the bot to see the main menu.

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## How to Use the Chatbot

- Type `MENU` or `START` to see the main menu
- Type `stop [id]` to view arrival times (e.g., `stop 12345`)
- Type `route [name]` to find nearest stops for a route (e.g., `route 38`)
- Click "Stops Near Me" and share your location to find nearby transit stops
- Click "Recently Viewed" to see your recent searches
- Click "Help" for more information

## Supported Transit Agencies

- **SF**: San Francisco Municipal Transportation Agency (Muni)
- **AC**: AC Transit
- **BA**: Bay Area Rapid Transit (BART)
- **CM**: Caltrain
- **GG**: Golden Gate Transit
- **SC**: SamTrans
- **VT**: Santa Clara Valley Transportation Authority (VTA)

## Architecture

- `/lib/shared/`: Shared utilities and base classes
  - `types.ts`: TypeScript interfaces and types
  - `rcsClient.ts`: Pinnacle RCS client initialization
  - `baseAgent.ts`: Base agent class with common functionality
- `/lib/agent.ts`: Main agent implementation with messaging logic
- `/lib/transit/`: Transit-specific functionality
  - `arrivals.ts`: Fetch real-time arrival data
  - `nearbyStops.ts`: Find stops near a location
  - `util.ts`: 511 API integration utilities
  - `types.ts`: Transit-specific types
- `/handlers/`: Message event handlers
  - `text.ts`: Text message handler
  - `button.ts`: Button click handler
  - `location.ts`: Location sharing handler
- `/cache/`: GTFS data caching and management
- `router.ts`: Express router for webhook handling

## Environment Variables

See `.env.example` for a complete list of required and optional environment variables.
