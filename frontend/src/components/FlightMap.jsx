import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// SVG Airplane icon pointing straight UP (0 degrees)
const airplaneSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="#3b82f6" stroke="white" stroke-width="1.5" style="display:block;"><path d="M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" /></svg>`;

const getAirplaneIcon = (heading, isSelected) => {
  return L.divIcon({
    className: '', // Clear default leaflet classes to prevent interference
    html: `<div style="transform: rotate(${heading || 0}deg); transform-origin: center center; width: ${isSelected ? '50px' : '26px'}; height: ${isSelected ? '50px' : '26px'}; filter: ${isSelected ? 'drop-shadow(0 0 15px #60a5fa) drop-shadow(0 0 5px white)' : 'drop-shadow(0 0 4px rgba(0,0,0,0.8))'}; transition: all 0.3s ease; display: flex; justify-content: center; align-items: center;">${airplaneSvg}</div>`,
    iconSize: isSelected ? [50, 50] : [26, 26],
    iconAnchor: isSelected ? [24, 24] : [12, 12],
    popupAnchor: [0, -12]
  });
};

function MapFocus({ flights, selectedFlight, airports, selectedAirport }) {
  const map = useMap();
  const prevSelectedFlight = useRef(selectedFlight);
  const prevSelectedAirport = useRef(selectedAirport);

  useEffect(() => {
    if (selectedFlight && selectedFlight !== prevSelectedFlight.current) {
      const flight = flights.find(f => f.icao === selectedFlight);
      if (flight && flight.latitude && flight.longitude) {
        map.flyTo([flight.latitude, flight.longitude], 12, { animate: true, duration: 1 });
      }
    }
    prevSelectedFlight.current = selectedFlight;
  }, [selectedFlight, flights, map]);

  useEffect(() => {
    if (selectedAirport && selectedAirport !== prevSelectedAirport.current) {
      const airport = airports.find(a => a.icao === selectedAirport);
      if (airport && airport.lat && airport.lng) {
        map.flyTo([airport.lat, airport.lng], 12, { animate: true, duration: 1 });
      }
    }
    prevSelectedAirport.current = selectedAirport;
  }, [selectedAirport, airports, map]);

  return null;
}

function InterpolatedFlightMarker({ flight, selectedFlight, setSelectedFlight }) {
  const markerRef = useRef(null);
  const flightRef = useRef(flight);
  const lastUpdateTime = useRef(Date.now());
  
  useEffect(() => {
    flightRef.current = flight;
    lastUpdateTime.current = Date.now();
  }, [flight]);

  useEffect(() => {
    let animationId;
    const renderLoop = () => {
      const f = flightRef.current;
      if (f && f.velocity && f.latitude && f.longitude && markerRef.current) {
        const deltaSeconds = (Date.now() - lastUpdateTime.current) / 1000;
        if (deltaSeconds < 15) {
          const distance = f.velocity * deltaSeconds; // meters
          const headingRad = f.true_track * Math.PI / 180;
          
          const dy = distance * Math.cos(headingRad);
          const dx = distance * Math.sin(headingRad);
          
          const dLat = dy / 111320;
          const dLon = dx / (111320 * Math.cos(f.latitude * Math.PI / 180));
          
          markerRef.current.setLatLng([f.latitude + dLat, f.longitude + dLon]);
        }
      }
      animationId = requestAnimationFrame(renderLoop);
    };
    
    animationId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <React.Fragment>
      {flight.trail && flight.trail.length > 1 && (
        <Polyline 
          positions={flight.trail} 
          pathOptions={{ color: '#eab308', weight: 3, opacity: 0.8 }} 
        />
      )}
      <Marker 
        ref={markerRef}
        position={[flight.latitude, flight.longitude]}
        icon={getAirplaneIcon(flight.true_track, selectedFlight === flight.icao)}
        zIndexOffset={selectedFlight === flight.icao ? 1000 : 0}
        eventHandlers={{ click: () => setSelectedFlight && setSelectedFlight(flight.icao) }}
      >
        <Tooltip direction="top" opacity={0.9}>
          <div className="font-sans text-sm">
            <strong>{flight.callsign}</strong><br/>
            Alt: {flight.altitude != null ? `${Math.round(flight.altitude * 3.28084)} ft` : 'N/A'}<br/>
            Spd: {flight.velocity != null ? `${Math.round(flight.velocity * 1.94384)} kts` : 'N/A'}
          </div>
        </Tooltip>
        <Popup className="custom-popup min-w-[250px]">
          <div className="text-gray-900 font-sans p-1">
            <div className="border-b border-gray-200 pb-2 mb-2">
              <h3 className="font-bold text-lg leading-tight flex items-center justify-between">
                {flight.callsign}
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-2">{flight.squawk ? `Sq: ${flight.squawk}` : 'VFR'}</span>
              </h3>
              <p className="text-xs text-gray-500 font-semibold">{flight.operator !== 'N/A' ? flight.operator : 'Operator Unknown'}</p>
            </div>
            
            <div className="mb-2 bg-gray-50 p-2 rounded text-sm flex items-center justify-between border border-gray-100">
              <div className="flex flex-col items-start">
                <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">DEP</span>
                <span className="font-bold text-gray-800">{flight.route && flight.route[0] ? flight.route[0] : 'N/A'}</span>
              </div>
              <div className="flex-1 flex items-center justify-center px-3">
                <div className="h-px w-full bg-gray-300 relative">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 text-xs">✈</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">ARR</span>
                <span className="font-bold text-gray-800">{flight.route && flight.route[1] ? flight.route[1] : 'N/A'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="font-semibold text-gray-500">Aircraft:</span>
              <span className="text-right truncate" title={`${flight.manufacturer} ${flight.model}`}>{flight.model !== 'N/A' ? `${flight.manufacturer} ${flight.model}` : 'Unknown'}</span>
              
              <span className="font-semibold text-gray-500">Registration:</span>
              <span className="text-right">{flight.registration}</span>
              
              <span className="font-semibold text-gray-500">Altitude:</span>
              <span className="text-right">{flight.altitude != null ? `${Math.round(flight.altitude * 3.28084)} ft` : 'N/A'}</span>
              
              <span className="font-semibold text-gray-500">Speed:</span>
              <span className="text-right">{flight.velocity != null ? `${Math.round(flight.velocity * 1.94384)} kts` : 'N/A'}</span>

              <span className="font-semibold text-gray-500">V. Rate:</span>
              <span className={`text-right ${flight.vertical_rate > 0 ? 'text-green-600' : flight.vertical_rate < 0 ? 'text-blue-600' : ''}`}>
                {flight.vertical_rate != null ? `${flight.vertical_rate > 0 ? '+' : ''}${Math.round(flight.vertical_rate * 3.28084 * 60)} fpm` : 'Level'}
              </span>
            </div>
          </div>
        </Popup>
      </Marker>
    </React.Fragment>
  );
}

export default function FlightMap({ flights, selectedFlight, setSelectedFlight, airports = [], visibleAirports = [], selectedAirport }) {
  // Center map on Massachusetts
  const maPosition = [42.0, -71.8];

  const getAirportIcon = () => {
    const airportSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#a855f7" stroke="white" stroke-width="2" style="width:100%; height:100%;"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20M2 12h20"></path></svg>`;
    return L.divIcon({
      className: '',
      html: `<div style="width: 24px; height: 24px; filter: drop-shadow(0 0 6px #a855f7);">${airportSvg}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  };

  return (
    <div className="absolute inset-0 z-0">
      <MapContainer center={maPosition} zoom={8} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <MapFocus flights={flights} selectedFlight={selectedFlight} airports={airports} selectedAirport={selectedAirport} />
        <TileLayer
          className="map-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        
        {/* Render Airports */}
        {airports.filter(a => visibleAirports.includes(a.icao)).map(airport => (
          <Marker 
            key={airport.icao} 
            position={[airport.lat, airport.lng]} 
            icon={getAirportIcon()}
            zIndexOffset={500}
          >
            <Tooltip direction="top" opacity={0.9}>
              <div className="font-sans text-sm text-center">
                <strong>{airport.name}</strong><br/>
                <span className="text-purple-400 font-mono">{airport.icao}</span>
              </div>
            </Tooltip>
          </Marker>
        ))}
        {flights.map((flight) => (
          flight.latitude && flight.longitude && (
            <InterpolatedFlightMarker 
              key={flight.icao} 
              flight={flight} 
              selectedFlight={selectedFlight} 
              setSelectedFlight={setSelectedFlight} 
            />
          )
        ))}
      </MapContainer>
    </div>
  );
}
