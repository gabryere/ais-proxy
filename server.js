const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const API_KEY = '79266697628a5f300be605eaff2365e40cd6595b';

app.get('/ship', (req, res) => {
  const mmsi = req.query.mmsi;
  if (!mmsi) return res.status(400).json({ error: 'MMSI mancante' });

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  let responded = false;

  const timeout = setTimeout(() => {
    if (!responded) {
      ws.close();
      return res.status(504).json({ error: 'Timeout senza dati' });
    }
  }, 10000); // 10 secondi

  ws.on('open', () => {
    console.log('[WS] Connessione aperta');

    const message = {
      APIKey: API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]], // Mondo intero
      FiltersShipMMSI: [mmsi],
      FilterMessageTypes: ['PositionReport']
    };

    ws.send(JSON.stringify(message));
    console.log('[WS] Messaggio inviato:', message);
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);
      console.log('[WS] Messaggio ricevuto:', parsed);

      if (parsed.MessageType === 'PositionReport') {
        const meta = parsed.MetaData;
        const info = parsed.Message.PositionReport;

        if (meta?.MMSI?.toString() === mmsi) {
          responded = true;
          clearTimeout(timeout);
          ws.close();

          return res.json({
            latitude: meta.latitude,
            longitude: meta.longitude,
            speed: info.Sog
          });
        }
      }
    } catch (err) {
      console.error('Errore nel parsing:', err);
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Errore:', err);
    clearTimeout(timeout);
    return res.status(500).json({ error: 'Errore WebSocket' });
  });

  ws.on('close', () => {
    console.log('[WS] Connessione chiusa');
    clearTimeout(timeout);
  });
});

app.listen(PORT, () => {
  console.log(`Server attivo su porta ${PORT}`);
});
