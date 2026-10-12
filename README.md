# WebXR – HTL3R-Logo auf den Tisch stellen (Meta Quest 3)

AR-App für die Quest 3: Man sieht über **Passthrough** den echten Raum, zeigt mit dem
Controller (oder der Hand) auf einen Tisch und stellt dort ein **3D-Logo der HTL Rennweg** ab.

- **START AR** → mit dem roten Strahl auf eine waagrechte Fläche zeigen → roter Ring erscheint
- **Trigger** (oder Pinch mit Daumen + Zeigefinger) → Logo wird dort abgestellt, dreht sich zu dir
- **Grip-Taste** → Logo um 45° drehen
- **ENTER VR** → gleiche Bedienung in einem virtuellen Raum mit Tisch
- Am PC ohne Brille: Desktop-Vorschau, mit der Maus drehen/zoomen

> Damit die Quest den echten Tisch erkennt, muss in der Brille der Raum eingerichtet sein:
> **Einstellungen → Physischer Raum → Raumeinrichtung (Space Setup)**. Dort Tische
> markieren. Geht direkt in der Brille, ohne Handy-App. Beim ersten START AR fragt der
> Browser nach Zugriff auf „Raumdaten“ → erlauben.

Code: [src/logo.js](src/logo.js) baut das Logo, [src/main.js](src/main.js) enthält Szene, Hit-Test und Bedienung.

## Starten

```bash
npm install
npm run dev
```

Läuft dann auf `https://localhost:5173` (selbstsigniertes Zertifikat).

## Quest mit der Website verbinden

WebXR läuft nur in einem *secure context* – also **HTTPS** oder **localhost**.
Da das Projekt in **WSL2** (NAT-Modus) läuft, ist der Server von außen nicht direkt erreichbar.

> **Kein Zugriff aufs Meta-Konto / keine Handy-App?** Dann Variante C (Tunnel) oder D (Hosting) nehmen –
> dafür reicht der normale Quest-Browser, kein Entwicklermodus nötig.

### Variante A: USB-Kabel + `adb reverse` (braucht Entwicklermodus)

1. Quest: **Entwicklermodus** aktivieren (Meta Horizon App am Handy → Gerät → Headset-Einstellungen → Entwicklermodus; braucht einen Developer-Account auf developers.meta.com).
2. Auf **Windows** die [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) (adb) installieren.
3. Quest per USB-C anschließen, in der Brille „USB-Debugging zulassen“ bestätigen.
4. In PowerShell (Windows):
   ```powershell
   adb devices
   adb reverse tcp:5173 tcp:5173
   ```
5. In der Quest im **Meta Quest Browser** öffnen: `https://localhost:5173`
   → Zertifikatswarnung mit „Erweitert → Trotzdem fortfahren“ bestätigen.
6. Unten auf **ENTER VR** oder **START AR** tippen.

Funktioniert, weil WSL2 `localhost` automatisch an Windows weiterreicht.

### Variante B: WLAN (Quest und PC im selben Netz)

WSL2 muss dafür im LAN sichtbar sein. Am einfachsten **Mirrored Networking**:
in `C:\Users\<Name>\.wslconfig`

```ini
[wsl2]
networkingMode=mirrored
```

dann `wsl --shutdown` in PowerShell und WSL neu starten. Danach:

1. `npm run dev` – Vite zeigt die `Network:`-Adresse an (z. B. `https://192.168.1.50:5173`).
2. Evtl. Windows-Firewall für Port 5173 freigeben (PowerShell als Admin):
   ```powershell
   New-NetFirewallRule -DisplayName "Vite 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
   ```
3. Diese Adresse im Quest-Browser öffnen, Zertifikatswarnung akzeptieren.

### Variante C: Tunnel (ohne Kabel/Netzwerk-Setup)

Kein Entwicklermodus, kein Konto nötig. In einem zweiten Terminal (während `npm run dev` läuft):

```bash
npx cloudflared tunnel --url https://localhost:5173 --no-tls-verify
```

Es erscheint eine URL wie `https://irgendwas-zufaellig.trycloudflare.com` – die im Quest-Browser
eintippen. Echtes Zertifikat, also keine Warnung. Funktioniert auch im Schul-WLAN, wo Geräte sich
oft gegenseitig nicht sehen. Achtung: Solange der Tunnel läuft, ist die Seite öffentlich erreichbar.

### Variante D: Online hosten (z. B. GitHub Pages / Netlify)

`npm run build` erzeugt den Ordner `dist/`. Den z. B. per Drag & Drop auf
[app.netlify.com/drop](https://app.netlify.com/drop) ziehen → HTTPS-URL in der Quest öffnen.
Gut für fertige Stände; für schnelles Ausprobieren ist der Tunnel bequemer.

## Ohne Brille testen / Debuggen

- **Immersive Web Emulator** (Chrome/Edge-Extension von Meta) simuliert eine Quest im Desktop-Browser.
- **Remote-Debugging** bei USB-Verbindung: in Chrome am PC `chrome://inspect/#devices` öffnen →
  Quest-Browser-Tab erscheint dort → Konsole, Netzwerk usw. live sehen.

## Struktur

```
index.html        Einstieg + Statusanzeige
src/main.js       Szene, Hit-Test (Tisch erkennen), Controller, VR/AR-Buttons
src/logo.js       HTL3R-Logo als 3D-Modell (Text + Schwung + Sockel)
vite.config.js    HTTPS (selbstsigniert) + LAN-Zugriff
```
