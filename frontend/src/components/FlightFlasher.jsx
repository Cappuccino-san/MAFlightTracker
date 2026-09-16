import { useState, useEffect } from 'react';
import { PlaneTakeoff } from 'lucide-react';

export default function FlightFlasher({ flights }) {
  const [alerts, setAlerts] = useState([]);
  const [seenIcaos, setSeenIcaos] = useState(new Set());

  useEffect(() => {
    if (flights.length === 0) return;

    const currentIcaos = new Set(flights.map(f => f.icao));
    const newFlights = [];

    // Find new flights that we haven't seen before
    for (const flight of flights) {
      if (!seenIcaos.has(flight.icao)) {
        newFlights.push(flight);
      }
    }

    if (newFlights.length > 0) {
      setSeenIcaos(prev => {
        const next = new Set(prev);
        newFlights.forEach(f => next.add(f.icao));
        return next;
      });

      // Add new alerts
      const newAlerts = newFlights.map(f => ({
        id: f.icao + '-' + Date.now(),
        flight: f
      }));

      setAlerts(prev => [...prev, ...newAlerts]);

      // Remove alerts after 5 seconds
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => !newAlerts.find(na => na.id === a.id)));
      }, 5000);
    }
  }, [flights]);

  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
      {alerts.map(alert => (
        <div 
          key={alert.id}
          className="bg-gray-900 border border-blue-500 rounded-lg p-3 shadow-lg shadow-blue-500/20 text-white flex items-center gap-3 animate-pulse"
        >
          <div className="bg-blue-500/20 p-2 rounded-full">
            <PlaneTakeoff className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="font-bold text-sm">New Aircraft Detected</div>
            <div className="text-xs text-gray-300">
              {alert.flight.callsign} | Alt: {alert.flight.altitude ? `${Math.round(alert.flight.altitude)}m` : 'N/A'} | Spd: {alert.flight.velocity ? `${Math.round(alert.flight.velocity)}m/s` : 'N/A'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
