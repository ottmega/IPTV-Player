# OTTMEGA IPTV

A full-featured Android IPTV Player app built with Expo React Native and Expo Router.

## Overview

OTTMEGA IPTV is a media player application that allows users to play IPTV streams from playlists they provide. The app does not include preloaded channels or content.

## Supported Login Methods

- **Xtream Codes API** - Server URL, username, password
- **M3U Playlist** - Remote URL or local file
- **Stalker Portal** - Portal URL with MAC address

## Features

- Live TV with categories, search, and favorites
- Movies (VOD) grid with category filtering and ratings
- Series with seasons/episodes navigation
- TV Guide / EPG grid view
- Multi-Screen viewer (2 or 4 channels simultaneously)
- Catch-Up TV with 7-day program schedule, Watch/Replay buttons, Xtream timeshift URLs
- Global Search (channels + movies + series)
- Favorites management (channels, movies, series) — persisted in AsyncStorage
- Video player: subtitle/audio track selectors, aspect ratio cycling, speed control, next/prev channel buttons, info bar, swipe-to-zap gestures (swipe up/down)
- Channel zapping: swipe up = next channel, swipe down = prev channel with animated banner
- Watch history with resume tracking (continue watching on home screen)
- Speed Test screen: real Cloudflare download test, ping, colour-coded IPTV rating
- Settings: full account info, content stats, language picker (6 options), parental PIN (default 0000), speed test link, 12-hour auto-refresh
- Auto-playlist refresh every 12 hours via background timer in IPTVContext
- Privacy Policy and Terms of Service (Play Store compliant)
- Legal IPTV disclaimer throughout the app
- **Remote Admin Config System**: admin panel at `/admin`, controls: announcement scrolling bar, promotional banner (image/title/link/toggle), custom logo URL, theme color; config fetched from backend every 6 hours with AsyncStorage cache; home screen integrates all config values

## Architecture

- **Frontend**: Expo React Native with Expo Router (file-based routing)
- **Backend**: Express.js (port 5000) - serves API stubs and a landing page
- **State**: React Context (IPTVContext) with AsyncStorage persistence
- **UI**: Dark cinematic theme (#0A0A12 bg, #4F8EF7 accent, #7C3AED purple gradient)
- **Font**: Inter (all weights via @expo-google-fonts/inter)

## Key Files

```
app/
  _layout.tsx            # Root layout with IPTVProvider, fonts, auth guard
  login.tsx              # Login screen (Xtream / M3U / Stalker)
  player.tsx             # Video player with custom controls
  epg.tsx                # TV Guide grid
  multiscreen.tsx        # Multi-screen viewer
  favorites.tsx          # Favorites management
  search.tsx             # Global search
  catchup.tsx            # Catch-up TV
  privacy.tsx            # Privacy Policy
  terms.tsx              # Terms of Service
  movie/[id].tsx         # Movie detail & play
  series-detail/[id].tsx # Series detail with episodes
  (tabs)/
    _layout.tsx          # Tab bar (NativeTabs/Classic with BlurView)
    index.tsx            # Home dashboard
    live.tsx             # Live TV
    movies.tsx           # Movies grid
    series.tsx           # Series grid
    settings.tsx         # Settings

context/
  IPTVContext.tsx        # All IPTV state, API calls, M3U parsing
  RemoteConfigContext.tsx # Remote admin config: logo, banner, announcement, themeColor (6h refresh)

constants/
  colors.ts              # Dark theme color palette

server/
  routes.ts              # Express routes + app-config API endpoints
  app-config.json        # Persisted app config (auto-created)
  templates/
    admin.html           # Standalone admin panel HTML (at /admin on backend)

app/
  admin.tsx              # In-app admin dashboard (at /admin in Expo Router)
```

## Workflows

- **Start Frontend**: `npm run expo:dev` — Expo dev server on port 8081
- **Start Backend**: `npm run server:dev` — Express server on port 5000

## Notes

- expo-screen-orientation is installed but not used in player (requires native build)
- expo-av is deprecated in SDK 54 but still functional
- react-is resolution warnings on web are pre-existing/non-blocking
- App targets Android (Play Store) but runs on iOS and Web too
