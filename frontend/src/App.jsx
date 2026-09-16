import { useState, useEffect, useRef } from 'react';
import FlightMap from './components/FlightMap';
import FlightFlasher from './components/FlightFlasher';
import { Plane, TowerControl } from 'lucide-react';

const MA_AIRPORTS = [
  { icao: 'KBOS', name: 'Boston Logan Int.', lat: 42.3656, lng: -71.0096, isMajor: true },
  { icao: 'KBED', name: 'Hanscom Field', lat: 42.4699, lng: -71.2890 },
  { icao: 'KORH', name: 'Worcester Regional', lat: 42.2673, lng: -71.8757, isMajor: true },
  { icao: 'KACK', name: 'Nantucket Memorial', lat: 41.2531, lng: -70.0602, isMajor: true },
  { icao: 'KMVY', name: "Martha's Vineyard", lat: 41.3931, lng: -70.6143, isMajor: true },
  { icao: 'KHYA', name: 'Barnstable Municipal', lat: 41.6693, lng: -70.2804, isMajor: true },
  { icao: 'KEWB', name: 'New Bedford Regional', lat: 41.6760, lng: -70.9569 },
  { icao: 'KPYM', name: 'Plymouth Municipal', lat: 41.9082, lng: -70.7287 },
  { icao: 'KOWD', name: 'Norwood Memorial', lat: 42.1905, lng: -71.1731 },
  { icao: 'KBVY', name: 'Beverly Regional', lat: 42.5841, lng: -70.9161 },
  { icao: 'KLWM', name: 'Lawrence Municipal', lat: 42.7172, lng: -71.1228 },
  { icao: 'KFIT', name: 'Fitchburg Municipal', lat: 42.5539, lng: -71.7589 },
  { icao: 'KCEF', name: 'Westover Metropolitan', lat: 42.1940, lng: -72.5348 },
  { icao: 'KBAF', name: 'Westfield-Barnes Reg.', lat: 42.1579, lng: -72.7158 },
  { icao: 'KPSF', name: 'Pittsfield Municipal', lat: 42.4251, lng: -73.2872, isMajor: true },
  { icao: 'KAQW', name: 'Harriman-and-West', lat: 42.6934, lng: -73.1325 },
  { icao: 'KFMH', name: 'Cape Cod Coast Guard', lat: 41.6583, lng: -70.5215 },
  { icao: 'KCQX', name: 'Chatham Municipal', lat: 41.6888, lng: -69.9897 },
  { icao: 'KPVC', 'name': 'Provincetown Municipal', lat: 42.0725, lng: -70.2214 },
  { icao: 'KORE', name: 'Orange Municipal', lat: 42.5705, lng: -72.2858 },
  { icao: 'KGBR', name: 'Walter J. Koladza', lat: 42.1818, lng: -73.4026 },
  { icao: 'KTAN', name: 'Taunton Municipal', lat: 41.8745, lng: -71.0163 },
  { icao: '1B9', name: 'Mansfield Municipal', lat: 41.9961, lng: -71.1967 },
  { icao: '3B0', name: 'Southbridge Municipal', lat: 42.0838, lng: -72.0366 },
  { icao: '6B6', name: 'Minute Man Field', lat: 42.4452, lng: -71.5292 },
  { icao: '8B0', name: 'Spencer Airport', lat: 42.2905, lng: -71.9774 },
  { icao: '0B5', name: 'Turners Falls', lat: 42.5815, lng: -72.5298 },
  { icao: '3M2', name: 'Jepson Memorial', lat: 41.9716, lng: -70.7600 },
  { icao: '1M8', name: 'Myricks Airport', lat: 41.8153, lng: -71.0188 }
];

function App() {
  const [flights, setFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleAirports, setVisibleAirports] = useState(MA_AIRPORTS.map(a => a.icao));
  const [status, setStatus] = useState('Connecting...');
  const wsRef = useRef(null);

  useEffect(() => {
    const connectWs = () => {
      // Connect to FastAPI backend
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('Connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'flights_update') {
            setFlights(message.data);
          }
        } catch (err) {
          console.error("Error parsing message", err);
        }
      };

      ws.onclose = () => {
        setStatus('Disconnected. Reconnecting...');
        setTimeout(connectWs, 3000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error", err);
        ws.close();
      };
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const toggleAirport = (icao) => {
    setVisibleAirports(prev => 
      prev.includes(icao) ? prev.filter(a => a !== icao) : [...prev, icao]
    );
  };

  return (
    <div className="relative w-full h-screen font-sans bg-gray-950 text-white flex overflow-hidden">
      
      {/* Left Sidebar Panel (Glassmorphism) */}
      <div className="w-80 h-full bg-gray-950/80 backdrop-blur-xl border-r border-gray-800/60 flex flex-col z-[1000] shadow-2xl relative">
        <div className="p-4 border-b border-gray-800/60 bg-gray-900/40">
          <div className="flex items-center gap-3 mb-4">
            <Plane className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">MA Tracker</h1>
              <p className="text-xs text-gray-400 font-medium">Massachusetts Airspace</p>
            </div>
          </div>
          
          <div className="mb-3">
            <input 
              type="text" 
              placeholder="Search callsign, airline..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400 uppercase tracking-wider">Status</span>
            <span className={`font-bold ${status === 'Connected' ? 'text-emerald-400' : 'text-amber-400'} flex items-center gap-1`}>
              {status === 'Connected' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
              {status}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 uppercase tracking-wider">Aircraft Tracked</span>
            <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{flights.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 custom-scrollbar">
          {['Taking Off', 'Landing', 'In Air', 'Landed'].map(category => {
            const categoryFlights = flights.filter(f => {
              // Search filter
              if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesCallsign = f.callsign && f.callsign.toLowerCase().includes(query);
                const matchesOperator = f.operator && f.operator.toLowerCase().includes(query);
                if (!matchesCallsign && !matchesOperator) return false;
              }

              // Categorization
              if (category === 'Landed') return f.on_ground;
              if (f.on_ground) return false;
              if (category === 'Taking Off') return f.altitude < 2000 && f.vertical_rate > 2;
              if (category === 'Landing') return f.altitude < 2000 && f.vertical_rate < -2;
              return !(f.altitude < 2000 && (f.vertical_rate > 2 || f.vertical_rate < -2));
            });

            if (categoryFlights.length === 0) return null;

            return (
              <div key={category} className="animate-in fade-in duration-300">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  {category} 
                  <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">{categoryFlights.length}</span>
                </h3>
                <div className="flex flex-col gap-1.5">
                  {categoryFlights.map(f => (
                    <div 
                      key={f.icao}
                      onClick={() => setSelectedFlight(f.icao)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedFlight === f.icao ? 'bg-blue-900/30 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-gray-800/40 border-transparent hover:bg-gray-800/70 hover:border-gray-700/50'}`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-gray-100">{f.callsign}</span>
                        <span className="text-[10px] bg-gray-900/80 text-gray-400 font-mono px-1.5 py-0.5 rounded border border-gray-700/50">{f.icao}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex justify-between mb-2">
                        <span className="truncate pr-2">{f.operator !== 'N/A' ? f.operator : 'Unknown Operator'}</span>
                      </div>
                      
                      <div className="bg-gray-950/60 px-2 py-2 rounded-md border border-gray-800/80 text-gray-300 text-[10px] flex items-center justify-between mb-2">
                        <div className="flex flex-col items-start">
                          <span className="text-[8px] text-gray-500 tracking-widest uppercase mb-0.5">DEP</span>
                          <span className="font-bold text-gray-200">{f.route && f.route[0] ? f.route[0] : 'N/A'}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center px-2">
                          <div className="h-px w-full bg-gray-700/50 relative">
                            <Plane className="w-3 h-3 text-gray-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] text-gray-500 tracking-widest uppercase mb-0.5">ARR</span>
                          <span className="font-bold text-gray-200">{f.route && f.route[1] ? f.route[1] : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="text-[11px] flex justify-between items-end border-t border-gray-700/30 pt-2 mt-1">
                        <div className="flex gap-3">
                          <div className="flex flex-col">
                            <span className="text-gray-500 uppercase tracking-wider text-[9px]">Alt</span>
                            <span className="text-blue-400 font-medium">{f.altitude != null ? `${Math.round(f.altitude * 3.28084)} ft` : 'N/A'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 uppercase tracking-wider text-[9px]">Spd</span>
                            <span className="text-emerald-400 font-medium">{f.velocity != null ? `${Math.round(f.velocity * 1.94384)} kts` : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative">
        <FlightMap 
          flights={flights} 
          selectedFlight={selectedFlight} 
          setSelectedFlight={setSelectedFlight} 
          airports={MA_AIRPORTS} 
          visibleAirports={visibleAirports}
          selectedAirport={selectedAirport}
        />
        <FlightFlasher flights={flights} />
      </div>

      {/* Right Sidebar Panel (Glassmorphism) */}
      <div className="w-64 h-full bg-gray-950/80 backdrop-blur-xl border-l border-gray-800/60 flex flex-col z-[1000] shadow-2xl relative">
        <div className="p-4 border-b border-gray-800/60 bg-gray-900/40">
          <div className="flex items-center gap-3 mb-3">
            <TowerControl className="w-6 h-6 text-purple-400" />
            <h2 className="text-lg font-bold tracking-tight">Airports</h2>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setVisibleAirports(MA_AIRPORTS.map(a => a.icao))}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] uppercase tracking-wider font-bold py-1.5 rounded transition-colors border border-gray-700"
            >
              Select All
            </button>
            <button 
              onClick={() => setVisibleAirports([])}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] uppercase tracking-wider font-bold py-1.5 rounded transition-colors border border-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
          {[...MA_AIRPORTS].sort((a, b) => {
            const aSelected = visibleAirports.includes(a.icao);
            const bSelected = visibleAirports.includes(b.icao);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return a.name.localeCompare(b.name);
          }).map(airport => (
            <div key={airport.icao} className={`flex items-center gap-3 group p-1.5 rounded-lg transition-colors ${visibleAirports.includes(airport.icao) ? 'bg-purple-900/20 border border-purple-500/30' : 'border border-transparent hover:bg-gray-800/50'}`}>
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer"
                checked={visibleAirports.includes(airport.icao)}
                onChange={() => toggleAirport(airport.icao)}
              />
              <div 
                className="flex flex-col cursor-pointer flex-1"
                onClick={() => {
                  if (!visibleAirports.includes(airport.icao)) {
                    toggleAirport(airport.icao);
                  }
                  setSelectedAirport(airport.icao);
                  // Clear selected flight so airport takes focus
                  setSelectedFlight(null);
                }}
              >
                <span className={`font-semibold text-sm transition-colors flex items-center gap-1.5 ${visibleAirports.includes(airport.icao) ? 'text-purple-300' : 'group-hover:text-purple-400'}`}>
                  {airport.name}
                  {airport.isMajor && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]" title="Major MA Airport"></span>
                  )}
                </span>
                <span className="text-xs text-gray-500 font-mono">{airport.icao}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default App;
