# Matrix Client - React

A standalone React Matrix visualization client that displays WebSocket events as Matrix rain.

## Features

- **Matrix Rain Animation**: Falling character streams with random symbols
- **WebSocket Integration**: Real-time event visualization from WebSocket server
- **TypeScript Support**: Full type safety and modern React patterns
- **Auto-Reconnect**: Automatic reconnection with configurable retry logic
- **Interactive Controls**: Toggle-able control panel for configuration
- **Event Display**: Shows latest WebSocket events in Matrix-style overlays

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The application will be available at `http://localhost:5174`

## WebSocket Configuration

The client connects to WebSocket endpoints discovered by system analysis:

- **Single Session**: `ws://localhost:3001/stream`
- **Multi Session**: `ws://localhost:3001/api/sessions/multi-stream`

You can change the WebSocket URL through the controls panel (click at the top of the screen).

## Architecture

### Components

- **Matrix**: Main component that renders falling code streams and event overlays
- **Code**: Individual falling character stream with random positioning and animation
- **Symbol**: Single character component with dynamic character changing
- **App**: Root component with WebSocket integration and controls

### Hooks

- **useWebSocket**: Custom hook for WebSocket connection management with auto-reconnect

### Utils

- **characters**: Matrix character set and utility functions for random generation

## WebSocket Event Format

The client expects events in the following format:

```json
{
  "type": "event_type",
  "data": {
    // Event data
  },
  "timestamp": 1234567890
}
```

Events are displayed as overlays on the Matrix rain and kept in a rolling buffer of the last 100 events.

## Controls

Click on the top bar to toggle the control panel:

- **WebSocket URL**: Change the connection endpoint
- **Connection Status**: View current connection state
- **Connect/Disconnect**: Manual connection control
- **Clear Events**: Reset the event buffer
- **Event Counter**: Shows number of received events

## Styling

The application uses the Matrix movie aesthetic:

- Black background
- Green Matrix-style characters
- White highlights for primary symbols
- Glowing text effects
- Matrix code font family

## Development

Built with:

- React 18 + TypeScript
- Vite for fast development and building
- Custom WebSocket hook for real-time communication
- CSS-in-JS for styling

## Created by

AlphaReact - React Matrix implementation lead