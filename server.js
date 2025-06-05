const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 10000;

app.get('/ship', (req, res) => {
  const mmsi = req.query.mmsi;
  if (!mmsi) {
    return res.status(400).json({ error: 'MMSI mancante' });
  }

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  let responded = false;

  const timeout = setTimeout(() => {
    if (!responded) {
      ws.terminate();
      return res.status(504).json({ error: 'Timeout senza dati' });
    }
  }, 12000); // 12 secondi di margine

  ws.on('open', () => {
    console.log('✅ Connessione WebSocket aperta');
    ws.send(JSON.stringify({
      APIKey: '79266697628a5f300be605eaff2365e40cd6595b',
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FiltersShipMMSI: [String(mmsi)],
      FilterMessageTypes: ['PositionReport']
    }));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.MessageType === 'PositionReport') {
        const report = message.Message.PositionReport;
        const meta = message.MetaData;

        if (meta && String(meta.MMSI) === String(mmsi)) {
          responded = true;
          ws.close();
          clearTimeout(timeout);
          return res.json({
            latitude: meta.latitude,
            longitude: meta.longitude,
            speed: report.Sog
          });
        }
      }
    } catch (err) {
      console.error('❌ Errore parsing:', err);
    }
  });

  ws.on('error', (err) => {
    clearTimeout(timeout);
    console.error('❌ Errore WebSocket:', err.message);
    if (!responded) res.status(500).json({ error: 'Errore WebSocket' });
  });

  ws.on('close', () => {
    if (!responded) {
      console.log('❌ WebSocket chiuso senza risposta utile');
    } else {
      console.log('✅ WebSocket chiuso dopo risposta');
    }
    clearTimeout(timeout);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server attivo sulla porta ${PORT}`);
});
