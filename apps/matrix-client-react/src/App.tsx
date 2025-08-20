import React, { useState } from 'react';
import Matrix from './components/Matrix';
import { useWebSocket } from './hooks/useWebSocket';

// Default to server running on port 4000
const WEBSOCKET_URL = 'ws://localhost:4000/stream';

const App: React.FC = () => {
  const [wsUrl, setWsUrl] = useState<string>(WEBSOCKET_URL);
  const [showControls, setShowControls] = useState<boolean>(false);
  
  const { events, isConnected, error, connect, disconnect, clearEvents } = useWebSocket({
    url: wsUrl,
    autoConnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5
  });

  const handleUrlChange = (newUrl: string) => {
    disconnect();
    setWsUrl(newUrl);
    setTimeout(() => connect(), 100);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Matrix events={events} />
      
      {/* Toggle controls with keyboard shortcut */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: showControls ? 'rgba(0, 0, 0, 0.9)' : 'transparent',
          color: '#00ff00',
          padding: showControls ? '20px' : '10px',
          zIndex: 2000,
          transition: 'all 0.3s ease',
          borderBottom: showControls ? '2px solid #00ff00' : 'none',
          cursor: 'pointer'
        }}
        onClick={() => setShowControls(!showControls)}
      >
        {!showControls ? (
          <div style={{ textAlign: 'center', fontSize: '14px', opacity: 0.7 }}>
            Click to show controls | Status: {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
          </div>
        ) : (
          <div>
            <h2 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Matrix Client - React</h2>
            
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '15px' }}>
              <span>WebSocket URL:</span>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                style={{
                  flex: 1,
                  background: '#000',
                  border: '1px solid #00ff00',
                  color: '#00ff00',
                  padding: '5px 10px',
                  fontFamily: 'matrix-code, monospace'
                }}
                placeholder="ws://localhost:4000/stream"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
              <span>Status:</span>
              <span style={{ 
                color: isConnected ? '#00ff00' : '#ff4444',
                fontWeight: 'bold'
              }}>
                {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
              </span>
              
              <button
                onClick={isConnected ? disconnect : connect}
                style={{
                  background: 'transparent',
                  border: '1px solid #00ff00',
                  color: '#00ff00',
                  padding: '5px 15px',
                  cursor: 'pointer',
                  fontFamily: 'matrix-code, monospace'
                }}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </button>
              
              <button
                onClick={clearEvents}
                style={{
                  background: 'transparent',
                  border: '1px solid #00ff00',
                  color: '#00ff00',
                  padding: '5px 15px',
                  cursor: 'pointer',
                  fontFamily: 'matrix-code, monospace'
                }}
              >
                Clear Events ({events.length})
              </button>
            </div>

            {error && (
              <div style={{ 
                color: '#ff4444', 
                marginBottom: '15px',
                border: '1px solid #ff4444',
                padding: '10px',
                borderRadius: '5px'
              }}>
                Error: {error}
              </div>
            )}

            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              <div>Events received: {events.length}</div>
              <div>Last event: {events.length > 0 ? new Date(events[events.length - 1].timestamp).toLocaleTimeString() : 'None'}</div>
              <div>Available endpoints: /stream (single), /api/sessions/multi-stream (multi)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;