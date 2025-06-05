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

  const timeout = setTimeout(() => {
    ws.close();
    console.log('⏰ Timeout: nessun dato ricevuto per MMSI', mmsi);
    return res.status(504).json({ error: 'Timeout senza dati' });
  }, 15000); // 15 secondi

  ws.on('open', () => {
    console.log('✅ WebSocket aperto');
    const subscriptionMessage = {
      APIKey: '79266697628a5f300be605eaff2365e40cd6595b', // assicurati che sia valida
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FiltersShipMMSI: [mmsi],
      FilterMessageTypes: ['PositionReport']
    };
    ws.send(JSON.stringify(subscriptionMessage));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.MessageType === 'PositionReport') {
        const report = message.Message.PositionReport;
        const meta = message.MetaData;

        console.log('📡 Ricevuto messaggio:', meta?.MMSI, report?.Sog, meta?.latitude, meta?.longitude);

        if (meta && meta.MMSI?.toString() === mmsi) {
          clearTimeout(timeout);
          ws.close();
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
    console.error('❌ Errore WebSocket:', err);
    return res.status(500).json({ error: 'Errore WebSocket' });
  });

  ws.on('close', () => {
    clearTimeout(timeout);
    console.log('🔌 WebSocket chiuso');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server attivo sulla porta ${PORT}`);
});
