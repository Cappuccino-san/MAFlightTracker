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

OPENSKY_URL = "https://api.adsb.lol/v2/point/42.36/-71.05/100"
# Bounding box for Massachusetts (including Martha's Vineyard and Nantucket)
PARAMS = {}
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

def parse_states(states: list) -> list:
    if not states:
        return []
    
    parsed = []
    for s in states:
        try:
            icao = str(s.get("hex", "")).strip()
            if not icao:
                continue
            callsign = str(s.get("flight", "")).strip() or "UNKNOWN"
            
            registration = s.get("r", "N/A")
            model = s.get("t", "N/A")
            
            alt_baro = s.get("alt_baro")
            altitude = alt_baro / 3.28084 if type(alt_baro) in (int, float) else 0
            
            gs = s.get("gs")
            velocity = gs * 0.514444 if type(gs) in (int, float) else 0
            
            geom_rate = s.get("geom_rate")
            vertical_rate = geom_rate * 0.00508 if type(geom_rate) in (int, float) else 0
            
            lat = s.get("lat")
            lon = s.get("lon")
            if lat is None or lon is None:
                continue
                
            parsed.append({
                "icao": icao,
                "callsign": callsign,
                "country": "Unknown",
                "longitude": lon,
                "latitude": lat,
                "altitude": altitude,
                "on_ground": alt_baro == "ground",
                "velocity": velocity,
                "true_track": s.get("track", 0),
                "vertical_rate": vertical_rate,
                "squawk": s.get("squawk", "N/A"),
                "registration": registration,
                "manufacturer": "N/A",
                "model": model,
                "operator": "N/A",
                "route": []
            })
        except Exception as e:
            continue
    return parsed
trail_cache = {}

async def poll_opensky():
    async with httpx.AsyncClient() as client:
        while True:
            if manager.active_connections:
                try:
                    logger.info("Polling ADSB.lol API...")
                    response = await client.get(OPENSKY_URL, timeout=10.0)
                    if response.status_code == 200:
                        data = response.json()
                        states = data.get("ac", [])
                        parsed_data = parse_states(states)
                        
                        current_icaos = set()
                        for f in parsed_data:
                            icao = f["icao"]
                            current_icaos.add(icao)
                            if icao not in trail_cache:
                                trail_cache[icao] = []
                            if f["latitude"] and f["longitude"]:
                                if not trail_cache[icao] or trail_cache[icao][-1] != [f["latitude"], f["longitude"]]:
                                    trail_cache[icao].append([f["latitude"], f["longitude"]])
                                if len(trail_cache[icao]) > 15:
                                    trail_cache[icao].pop(0)
                            f["trail"] = list(trail_cache[icao])
                        
                        stale = [icao for icao in trail_cache if icao not in current_icaos]
                        for icao in stale:
                            del trail_cache[icao]

                        logger.info(f"Found {len(parsed_data)} flights in radius.")
                        await manager.broadcast({"type": "flights_update", "data": parsed_data})
                    else:
                        raise Exception(f"ADSB.lol API error: {response.status_code}")
                except Exception as e:
                    logger.error(f"Error fetching data: {e}")
            
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
