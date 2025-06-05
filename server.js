const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 10000;

app.get('/ship', (req, res) => {
  const mmsi = req.query.mmsi;
  if (!mmsi) return res.status(400).json({ error: 'MMSI mancante' });

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  const timeout = setTimeout(() => {
    ws.close();
    return res.status(504).json({ error: 'Timeout senza dati' });
  }, 7000);

  ws.on('open', () => {
    const sub = {
      APIKey: process.env.AIS_API_KEY,
      BoundingBoxes: [[[35, 8], [45, 15]]],
      FiltersShipMMSI: [mmsi],
      FilterMessageTypes: ['PositionReport']
    };
    ws.send(JSON.stringify(sub));
  });

  ws.on('message', data => {
    try {
      const msg = JSON.parse(data);
      if (msg.MessageType === 'PositionReport') {
        const meta = msg.MetaData;
        const body = msg.Message.PositionReport;
        if (meta && meta.MMSI.toString() === mmsi) {
          clearTimeout(timeout);
          ws.close();
          return res.json({
            latitude: meta.latitude,
            longitude: meta.longitude,
            speed: body.Sog
          });
        }
      }
    } catch (err) {
      console.error('Errore parsing:', err);
    }
  });

  ws.on('error', err => {
    clearTimeout(timeout);
    console.error('Errore WebSocket:', err);
    return res.status(500).json({ error: 'Errore WebSocket' });
  });

  ws.on('close', () => clearTimeout(timeout));
});

app.listen(PORT, () => {
  console.log(`Server attivo su porta ${PORT}`);
});
