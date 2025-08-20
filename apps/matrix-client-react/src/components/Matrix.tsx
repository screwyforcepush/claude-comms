import React, { useState, useEffect, useRef } from 'react';
import EventCode from './EventCode';
import Code from './Code';

interface MatrixEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

interface MatrixProps {
  events?: MatrixEvent[];
}

const Matrix: React.FC<MatrixProps> = ({ events = [] }) => {
  const [eventStreams, setEventStreams] = useState<Array<{ id: string; text: string; columnIndex: number }>>([]);
  const columnIndexRef = useRef(0);

  useEffect(() => {
    if (events.length > 0) {
      const latestEvent = events[events.length - 1];
      
      // Format event data as text to display
      let eventText = '';
      
      // Try to extract meaningful data from the event - show MORE data
      if (latestEvent.data) {
        // Check for different event structures from the observability server
        if (latestEvent.data.hook_event_type) {
          // Include more detailed event info
          const hookType = latestEvent.data.hook_event_type || '';
          const app = latestEvent.data.source_app || '';
          const session = latestEvent.data.session_id || '';
          const payload = latestEvent.data.payload ? JSON.stringify(latestEvent.data.payload) : '';
          eventText = `${hookType}|${app}|${session}|${payload}`.trim();
        } else if (latestEvent.data.type) {
          eventText = `${latestEvent.data.type}|${JSON.stringify(latestEvent.data.payload || {})}`.trim();
        } else if (latestEvent.data.message) {
          eventText = latestEvent.data.message;
        } else if (latestEvent.data.action) {
          eventText = latestEvent.data.action;
        } else if (latestEvent.data.name) {
          eventText = latestEvent.data.name;
        } else if (typeof latestEvent.data === 'string') {
          eventText = latestEvent.data;
        } else {
          // For objects, stringify the whole thing
          eventText = JSON.stringify(latestEvent.data);
        }
      } else {
        eventText = latestEvent.type || 'EVENT';
      }
      
      // Don't truncate - show the full event data
      // Only limit to prevent extremely long events from causing performance issues
      if (eventText.length > 500) {
        eventText = eventText.substring(0, 500) + '...';
      }
      
      // Add the event as a new falling stream
      const newStream = {
        id: `${Date.now()}-${latestEvent.id}`,
        text: eventText,
        columnIndex: columnIndexRef.current++
      };
      
      setEventStreams(prev => {
        // Keep only last 30 streams to prevent memory issues
        const updated = [...prev, newStream];
        if (updated.length > 30) {
          return updated.slice(-30);
        }
        return updated;
      });
    }
  }, [events]);

  // Clean up completed animations
  useEffect(() => {
    const cleanup = setInterval(() => {
      setEventStreams(prev => {
        // Remove streams older than 15 seconds
        const now = Date.now();
        return prev.filter(stream => {
          const streamTime = parseInt(stream.id.split('-')[0] || '0');
          return now - streamTime < 15000;
        });
      });
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);

  // Also show some random background Matrix rain for ambiance
  const backgroundStreams = Array.from({ length: 20 }, (_, i) => (
    <Code key={`bg-${i}`} />
  ));

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(ellipse at center, #001100 0%, #000000 100%)',
        overflow: 'hidden',
        fontFamily: 'Courier New, monospace'
      }}
    >
      {/* Background Matrix rain */}
      {backgroundStreams}
      
      {/* Event streams as falling Matrix code */}
      {eventStreams.map(stream => (
        <EventCode
          key={stream.id}
          eventData={stream.text}
          columnIndex={stream.columnIndex}
        />
      ))}
      
      {/* Show status when no events yet */}
      {events.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#00ff00',
            fontSize: '18px',
            textAlign: 'center',
            opacity: 0.7,
            textShadow: '0 0 10px #00ff00'
          }}
        >
          Waiting for WebSocket events...
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        
        @keyframes primaryGlow {
          from {
            text-shadow: 0 0 5px #ffffff, 0 0 10px #00ff41, 0 0 15px #00ff41, 0 0 20px #00ff41, 0 0 25px #00ff41;
            filter: brightness(1.8);
          }
          to {
            text-shadow: 0 0 8px #ffffff, 0 0 15px #00ff41, 0 0 20px #00ff41, 0 0 25px #00ff41, 0 0 30px #00ff41;
            filter: brightness(2.2);
          }
        }
      `}</style>
    </div>
  );
};

export default Matrix;