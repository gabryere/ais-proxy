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
  let dataFound = false;

  const timeout = setTimeout(() => {
    if (!dataFound) {
      ws.close();
      res.status(504).json({ error: 'Timeout senza dati' });
    }
  }, 15000); // 15 secondi

  ws.on('open', () => {
    const subscription = {
      APIKey: '79266697628a5f300be605eaff2365e40cd6595b',
      BoundingBoxes: [[[35, 8], [45, 15]]],
      FiltersShipMMSI: [mmsi],
      FilterMessageTypes: ['PositionReport']
    };
    ws.send(JSON.stringify(subscription));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.MessageType === 'PositionReport') {
        const meta = msg.MetaData;
        const report = msg.Message.PositionReport;
        if (meta && meta.MMSI.toString() === mmsi) {
          dataFound = true;
          clearTimeout(timeout);
          ws.close();
          res.json({
            latitude: meta.latitude,
            longitude: meta.longitude,
            speed: report.Sog
          });
        }
      }
    } catch (e) {
      console.error('Errore parsing:', e.message);
    }
  });

  ws.on('error', (err) => {
    clearTimeout(timeout);
    console.error('Errore WebSocket:', err.message);
    res.status(500).json({ error: 'Errore WebSocket' });
  });

  ws.on('close', () => {
    clearTimeout(timeout);
  });
});

app.listen(PORT, () => {
  console.log(`Server attivo su porta ${PORT}`);
});
