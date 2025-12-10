# Transit Assistant

A Bay Area transit RCS chatbot that provides real-time transit information for all major Bay Area transit agencies through Rich Communication Services (RCS) messaging.
https://github.com/user-attachments/assets/074fb330-293a-4e9d-af82-c8757de56f92

## Features

### Stop Arrivals

- Get real-time arrival times for any transit stop
- Type `stop [id]` to view arrivals
- Live departure countdown

### Route Search

- Find the nearest stops for a route
- Type `route [name]` and share your location
- View stop details and distances

### Nearby Stops

- Share your location to discover transit stops near you
- See all nearby stops across agencies
- Quick access to arrival times

### Live Vehicle Tracking

- See real-time vehicle positions on maps
- Supported for select routes

### Recent Views

- Quick access to recently viewed stops and routes
- Convenient navigation history

### Multi-Agency Support

- **SF**: San Francisco Municipal Transportation Agency (Muni)
- **AC**: AC Transit
- **BA**: Bay Area Rapid Transit (BART)
- **CM**: Caltrain
- **GG**: Golden Gate Transit
- **SC**: SamTrans
- **VT**: Santa Clara Valley Transportation Authority (VTA)

## Project Structure

```
Transit-Assistant/
├── lib/
│   ├── rcsClient.ts          # Pinnacle RCS client configuration
│   ├── baseAgent.ts          # Base agent class with common functionality
│   ├── agent.ts              # Transit agent implementation
│   └── transit/
│       ├── arrivals.ts       # Fetch real-time arrival data
│       ├── nearbyStops.ts    # Find stops near a location
│       ├── util.ts           # 511 API integration utilities
│       └── types.ts          # Transit-specific types
├── handlers/
│   ├── index.ts              # Handler exports
│   ├── text.ts               # Text message handler
│   ├── button.ts             # Button click handler
│   └── location.ts           # Location sharing handler
├── cache/
│   ├── gtfsCache.ts          # GTFS data caching
│   ├── import-gtfs.ts        # GTFS import utilities
│   └── schema.sql            # Database schema
├── server.ts                 # Main Express server
├── router.ts                 # Express router for webhook handling
├── update-db.sh              # Database update script
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
├── .env.example              # Environment variables template
└── .gitignore                # Git ignore rules
```

## Setup

### Prerequisites

- Node.js 18+
- A Pinnacle API account
- RCS agent configured in Pinnacle
- A 511 API key for Bay Area transit data (get one at [511.org](https://511.org))
- A Mapbox API key for map visualization (get one at [mapbox.com](https://mapbox.com))

### Installation

1. Clone the repository

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:

   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`:

```env
PINNACLE_API_KEY=your_api_key_here
PINNACLE_AGENT_ID=your_agent_id_here
PINNACLE_SIGNING_SECRET=your_signing_secret_here
API_511_KEY=your_511_api_key_here
MAPBOX_API_KEY=your_mapbox_api_key_here
TEST_MODE=false
PORT=3000
```

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
   - Copy the signing secret and add it to your `.env` file as `PINNACLE_SIGNING_SECRET`. The `process()` method uses this environment variable to verify the request signature.

8. Text "MENU" to the bot to see the main menu.

### Running the Application

Development mode with auto-reload:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Configuration

### Environment Variables

| Variable                  | Description                                                            | Required            |
| ------------------------- | ---------------------------------------------------------------------- | ------------------- |
| `PINNACLE_API_KEY`        | Your Pinnacle API key                                                  | Yes                 |
| `PINNACLE_AGENT_ID`       | Your RCS agent ID from Pinnacle Dashboard                              | Yes                 |
| `PINNACLE_SIGNING_SECRET` | Webhook signing secret for verification                                | Yes                 |
| `API_511_KEY`             | Your 511.org API key                                                   | Yes                 |
| `MAPBOX_API_KEY`          | Your Mapbox API key                                                    | Yes                 |
| `TEST_MODE`               | Set to `true` for sending with a test RCS agent to whitelisted numbers | No (default: false) |
| `PORT`                    | Server port                                                            | No (default: 3000)  |

## How to Use the Chatbot

- Type `MENU` or `START` to see the main menu
- Type `stop [id]` to view arrival times (e.g., `stop 12345`)
- Type `route [name]` to find nearest stops for a route (e.g., `route 38`)
- Click "Stops Near Me" and share your location to find nearby transit stops
- Click "Recently Viewed" to see your recent searches
- Click "Help" for more information

## Technologies

- **TypeScript**: Type-safe development
- **Express**: Web framework for webhook handling
- **rcs-js**: Pinnacle RCS SDK v2.0.6+
- **better-sqlite3**: Local database for GTFS data
- **tsx**: TypeScript execution and hot-reload

## Support

For issues related to:

- RCS functionality: Contact Pinnacle support
- Chatbot implementation: Refer to the code documentation
- Configuration: Check the `.env.example` file

## Resources

- **Dashboard**: Visit [Pinnacle Dashboard](https://app.pinnacle.sh)
- **Documentation**: Visit [Pinnacle Documentation](https://docs.pinnacle.sh)
- **Support**: Email [founders@trypinnacle.app](mailto:founders@trypinnacle.app)
