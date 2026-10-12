import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// WebXR braucht einen "secure context": HTTPS oder localhost.
// basicSsl erzeugt ein selbstsigniertes Zertifikat, damit die Quest
// die Seite auch über das WLAN (https://<PC-IP>:5173) öffnen kann.
export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true, // im LAN erreichbar machen
    port: 5173,
    // Tunnel-Domains erlauben (Vite blockiert sonst fremde Hostnamen)
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.loca.lt'],
  },
});
