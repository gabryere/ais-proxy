const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 10000;

const ships = {
  "247484300": "https://www.shipxplorer.com/vessel/MOBY-LEGACY-IMO-9837511-MMSI-247484300",
  "247286700": "https://www.shipxplorer.com/vessel/CRUISE-SARDEGNA-IMO-9351505-MMSI-247286700"
};

// punti rotta verso Olbia
const routePoints = [
  { lat: 41.0216834, lon: 9.7271262 },
  { lat: 40.9878593, lon: 9.7146948 },
  { lat: 40.9698297, lon: 9.6908041 },
  { lat: 40.9227016, lon: 9.5798481 },
  { lat: 40.9230152, lon: 9.5298363 } // Porto di Olbia
];

function toRad(deg) {
  return deg * Math.PI / 180;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(position, waypoints) {
  let total = 0;
  let start = position;

  for (const point of waypoints) {
    total += haversine(start.lat, start.lon, point.lat, point.lon);
    start = point;
  }

  return total * 0.539957; // km to nautical miles
}

app.get('/ship', async (req, res) => {
  const mmsi = req.query.mmsi;
  const url = ships[mmsi];

  if (!url) return res.status(400).json({ error: 'MMSI non riconosciuto' });

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const coordsText = $('script').text();
    const latMatch = coordsText.match(/latitude\s*:\s*(-?\d+\.\d+)/);
    const lonMatch = coordsText.match(/longitude\s*:\s*(-?\d+\.\d+)/);
    const speedMatch = coordsText.match(/speed:\s*(\d+(\.\d+)?)/);

    if (!latMatch || !lonMatch || !speedMatch) {
      return res.status(500).json({ error: 'Dati non trovati nella pagina' });
    }

    const position = {
      lat: parseFloat(latMatch[1]),
      lon: parseFloat(lonMatch[1]),
    };

    const speed = parseFloat(speedMatch[1]); // nodi
    const distance = totalDistance(position, routePoints);
    const etaHours = distance / speed;
    const etaMinutes = Math.round(etaHours * 60);
    const etaTime = `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`;

    return res.json({
      speed: speed.toFixed(1),
      distance: distance.toFixed(1),
      eta: etaTime
    });

  } catch (err) {
    console.error('Errore:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dati' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server attivo su porta ${PORT}`);
});
