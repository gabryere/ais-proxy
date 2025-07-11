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
    ws.terminate();
    return res.status(504).json({ error: 'Timeout senza dati' });
  }, 12000); // aumentato leggermente il timeout

  ws.on('open', () => {
    const subscriptionMessage = {
      APIKey: '79266697628a5f300be605eaff2365e40cd6595b',
      BoundingBoxes: [[[35, 5], [46, 20]]], // area molto più ampia nel Mediterraneo
      FiltersShipMMSI: [mmsi],
      FilterMessageTypes: ['PositionReport']
    };
    ws.send(JSON.stringify(subscriptionMessage));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.MessageType === 'PositionReport') {
        const metadata = message.MetaData;
        const report = message.Message.PositionReport;
        if (metadata && metadata.MMSI.toString() === mmsi) {
          clearTimeout(timeout);
          ws.terminate();
          return res.json({
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            speed: report.Sog
          });
        }
      }
    } catch (err) {
      console.error('Errore parsing:', err);
    }
  });

  ws.on('error', (err) => {
    clearTimeout(timeout);
    return res.status(500).json({ error: 'Errore WebSocket' });
  });

  ws.on('close', () => {
    clearTimeout(timeout);
  });
});

app.listen(PORT, () => {
  console.log(`Server attivo su porta ${PORT}`);
});
