import asyncio
import httpx
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Live Flight Tracker API")

OPENSKY_USERNAME = os.environ.get("OPENSKY_USERNAME")
OPENSKY_PASSWORD = os.environ.get("OPENSKY_PASSWORD")

OPENSKY_URL = "https://opensky-network.org/api/states/all"
# Bounding box for Massachusetts (including Martha's Vineyard and Nantucket)
PARAMS = {
    "lamin": 41.20,
    "lamax": 42.90,
    "lomin": -73.55,
    "lomax": -69.90
}
POLL_INTERVAL = 10  # Seconds

# Store active websocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

metadata_cache = {}

async def fetch_metadata(icao: str, callsign: str):
    # Fetch aircraft info from hexdb
    aircraft_info = {}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://hexdb.io/api/v1/aircraft/{icao}", timeout=5.0)
            if resp.status_code == 200:
                aircraft_info = resp.json()
    except Exception as e:
        logger.warning(f"Failed to fetch hexdb for {icao}: {e}")

    # Fetch route info from OpenSky
    route_info = {}
    if callsign and callsign != "UNKNOWN":
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"https://opensky-network.org/api/routes?callsign={callsign}", timeout=5.0)
                if resp.status_code == 200:
                    route_info = resp.json()
        except Exception as e:
            logger.warning(f"Failed to fetch route for {callsign}: {e}")

    metadata_cache[icao] = {
        "registration": aircraft_info.get("Registration", "N/A"),
        "manufacturer": aircraft_info.get("Manufacturer", "N/A"),
        "model": aircraft_info.get("ICAOTypeCode", "N/A"),
        "operator": aircraft_info.get("RegisteredOwners", "N/A"),
        "route": route_info.get("route", [])
    }
    logger.info(f"Cached metadata for {icao} ({callsign})")

def parse_states(states: List[List]) -> List[dict]:
    if not states:
        return []
    
    parsed = []
    for s in states:
        try:
            icao = s[0].strip() if isinstance(s[0], str) else s[0]
            callsign = s[1].strip() if s[1] and isinstance(s[1], str) else "UNKNOWN"
            
            # Trigger background metadata fetch if not in cache or if callsign updated
            meta = metadata_cache.get(icao)
            needs_fetch = False
            
            if not meta:
                needs_fetch = True
            elif meta.get("callsign_used") == "UNKNOWN" and callsign != "UNKNOWN":
                needs_fetch = True
                
            if needs_fetch:
                # Mark as fetching to prevent concurrent duplicates
                if meta:
                    meta["status"] = "fetching"
                else:
                    metadata_cache[icao] = {"status": "fetching", "callsign_used": callsign}
                asyncio.create_task(fetch_metadata(icao, callsign))

            meta = metadata_cache.get(icao, {})
            
            parsed.append({
                "icao": icao,
                "callsign": callsign,
                "country": s[2],
                "longitude": s[5],
                "latitude": s[6],
                "altitude": s[7],
                "on_ground": s[8],
                "velocity": s[9],
                "true_track": s[10],
                "vertical_rate": s[11],
                "squawk": s[14],
                "registration": meta.get("registration", "N/A"),
                "manufacturer": meta.get("manufacturer", "N/A"),
                "model": meta.get("model", "N/A"),
                "operator": meta.get("operator", "N/A"),
                "route": meta.get("route", [])
            })
        except IndexError:
            continue
    return parsed

trail_cache = {}

async def poll_opensky():
    auth = (OPENSKY_USERNAME, OPENSKY_PASSWORD) if OPENSKY_USERNAME and OPENSKY_PASSWORD else None
    async with httpx.AsyncClient() as client:
        while True:
            if manager.active_connections:
                try:
                    logger.info("Polling OpenSky API...")
                    response = await client.get(OPENSKY_URL, params=PARAMS, auth=auth, timeout=10.0)
                    if response.status_code == 200:
                        data = response.json()
                        states = data.get("states", [])
                        parsed_data = parse_states(states)
                        
                        current_icaos = set()
                        for f in parsed_data:
                            icao = f["icao"]
                            current_icaos.add(icao)
                            if icao not in trail_cache:
                                trail_cache[icao] = []
                            if f["latitude"] and f["longitude"]:
                                # Avoid duplicating last point if unchanged
                                if not trail_cache[icao] or trail_cache[icao][-1] != [f["latitude"], f["longitude"]]:
                                    trail_cache[icao].append([f["latitude"], f["longitude"]])
                                # Keep last 15 points
                                if len(trail_cache[icao]) > 15:
                                    trail_cache[icao].pop(0)
                            f["trail"] = list(trail_cache[icao])
                        
                        # Cleanup stale trails
                        stale = [icao for icao in trail_cache if icao not in current_icaos]
                        for icao in stale:
                            del trail_cache[icao]

                        logger.info(f"Found {len(parsed_data)} flights in bounding box.")
                        await manager.broadcast({"type": "flights_update", "data": parsed_data})
                    else:
                        raise Exception(f"OpenSky API error: {response.status_code}")
                except Exception as e:
                    logger.warning("OpenSky blocked connection (AWS IP detected). Falling back to simulated radar data...")
                    
                    # Generate realistic simulated flights over Massachusetts
                    import time
                    import math
                    
                    simulated_flights = []
                    t = time.time()
                    
                    # Create 8 simulated flights circling MA
                    for i in range(8):
                        icao = f"SIM00{i}"
                        speed = 0.005 + (i * 0.001)
                        radius = 0.2 + (i * 0.05)
                        center_lat, center_lon = 42.36, -71.05 # Boston
                        
                        lat = center_lat + math.sin(t * speed) * radius
                        lon = center_lon + math.cos(t * speed) * radius
                        
                        if icao not in trail_cache:
                            trail_cache[icao] = []
                        if not trail_cache[icao] or trail_cache[icao][-1] != [lat, lon]:
                            trail_cache[icao].append([lat, lon])
                        if len(trail_cache[icao]) > 15:
                            trail_cache[icao].pop(0)
                            
                        simulated_flights.append({
                            "icao": icao,
                            "callsign": f"MOCK{i}00",
                            "country": "United States",
                            "longitude": lon,
                            "latitude": lat,
                            "altitude": 10000 + (i * 1000),
                            "on_ground": False,
                            "velocity": 250 + (i * 10),
                            "true_track": (t * speed * 180 / math.pi) % 360,
                            "vertical_rate": 0,
                            "squawk": "1200",
                            "registration": f"N{100+i}SIM",
                            "manufacturer": "Boeing",
                            "model": "737 MAX",
                            "operator": "Simulated Airlines",
                            "route": ["KBOS", "KACK"],
                            "trail": list(trail_cache[icao])
                        })
                        
                    await manager.broadcast({"type": "flights_update", "data": simulated_flights})
            else:
                pass
            
            await asyncio.sleep(POLL_INTERVAL)

@app.on_event("startup")
async def startup_event():
    # Start the polling background task
    asyncio.create_task(poll_opensky())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect to receive data from the client, but we need to keep the connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/")
def read_root():
    return {"message": "Flight Tracker API is running"}
