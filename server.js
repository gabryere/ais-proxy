const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const AIS_API_KEY = '79266697628a5f300be605eaff2365e40cd6595b';

app.get('/ship', (req, res) => {
  const mmsi = req.query.mmsi;
  if (!mmsi) return res.status(400).json({ error: 'MMSI mancante' });

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  const timeout = setTimeout(() => {
    ws.close();
    return res.status(504).json({ error: 'Timeout' });
  }, 10000);

  ws.on('open', () => {
    ws.send(JSON.stringify({
      APIKey: AIS_API_KEY,
      BoundingBoxes: [[[35, 8], [45, 15]]],
      FiltersShipMMSI: [mmsi],
      FilterMessageTypes: ['PositionReport']
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.MessageType === 'PositionReport') {
        const report = msg.Message.PositionReport;
        if (report && report.UserID.toString() === mmsi) {
          clearTimeout(timeout);
          ws.close();
          return res.json({
            latitude: report.Latitude,
            longitude: report.Longitude,
            speed: report.Sog
          });
        }
      }
    } catch (err) {
      console.error('Errore:', err);
    }
  });

  ws.on('error', (err) => {
    clearTimeout(timeout);
    return res.status(500).json({ error: 'Errore WebSocket' });
  });

  ws.on('close', () => clearTimeout(timeout));
});

app.listen(PORT, () => {
  console.log(`Server attivo su porta ${PORT}`);
});
