# Massachusetts Live Flight Tracker

A real-time, 60fps airspace radar application that tracks hundreds of flights across Massachusetts and its regional airports. Built with a modern, high-performance web stack.

## Architecture & Stack

- **Backend**: Python, FastAPI, WebSockets
- **Frontend**: React, Vite, Tailwind CSS v4, React-Leaflet
- **Data Source**: OpenSky Network API (Polling) & ADSB HexDB

## Features

- **Live 60fps Dead-Reckoning:** The UI engine completely detaches flight marker animations from React's state loop, allowing airplanes to glide smoothly across the screen at 60fps using custom DOM manipulation, while API polling only occurs every 10 seconds.
- **Dynamic Route Resolution:** The backend automatically maps ADS-B Hex codes to known flight plans, instantly triggering asynchronous metadata fetches when callsigns are dynamically resolved.
- **Geospatial Dashboard:** Glassmorphism UI displaying categorized flights (Taking Off, Landing, In Air, Landed) and real-time telemetry (Altitude, Speed, True Track, Vertical Rate).
- **Interactive Map:** Smooth pan-to-focus on flights and 29 public-use Massachusetts airports, complete with glowing trails and custom vector icons aligned to exact headings.

## How to Run Locally

### 1. Start the Backend
The backend polls the OpenSky network and broadcasts telemetry to the frontend via WebSockets.
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### 2. Start the Frontend
The frontend renders the interactive radar map and connects to the backend WebSocket on port 8000.
```bash
cd frontend
npm install
npm run dev
```

Open your browser to `http://localhost:5173`.
