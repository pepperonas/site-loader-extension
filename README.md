# Website als HTML herunterladen

Eine Chrome/Chromium-Browser-Extension, die Webseiten als einzelne, eigenständige HTML-Datei mit allen eingebetteten Ressourcen (Bilder, CSS, Schriftarten, JavaScript) herunterlädt.

## Funktionen

- **Vollständige Offline-Kopien**: Speichert Webseiten mit allen visuellen Elementen
- **Base64-Einbettung**: Konvertiert alle externen Ressourcen in Data-URIs
- **Automatische Dateinamen**: Generiert Namen basierend auf Seitentitel und Datum
- **Deutsche Lokalisierung**: Vollständig auf Deutsch lokalisierte Benutzeroberfläche

## Unterstützte Ressourcen

Die Extension bettet automatisch ein:
- CSS-Stylesheets (externe und inline)
- Bilder (JPG, PNG, GIF, WebP, etc.)
- SVG-Dateien (in `<img>` und `<object>` Tags)
- Hintergrundbilder (via CSS `url()`)
- Favicons
- JavaScript-Dateien
- Schriftarten (in CSS referenziert)

## Installation

### Fertiges Release herunterladen (empfohlen)

1. Zur [Releases-Seite](https://github.com/pepperonas/site-loader-extension/releases) gehen
2. Neueste Version herunterladen (ZIP-Datei)
3. ZIP-Datei entpacken
4. Chrome/Chromium öffnen und zu `chrome://extensions/` navigieren
5. "Entwicklermodus" aktivieren (oben rechts)
6. "Entpackte Extension laden" klicken
7. Entpackten Ordner auswählen

### Aus dem Quellcode

1. Repository klonen oder herunterladen
2. Chrome/Chromium öffnen und zu `chrome://extensions/` navigieren
3. "Entwicklermodus" aktivieren (oben rechts)
4. "Entpackte Extension laden" klicken
5. Diesen Ordner auswählen

## Verwendung

1. Webseite öffnen, die heruntergeladen werden soll
2. Extension-Icon in der Browser-Toolbar klicken
3. "Website als HTML speichern" klicken
4. Warten, bis die Verarbeitung abgeschlossen ist
5. Datei wird automatisch im Download-Ordner gespeichert

## Technische Details

**Manifest-Version**: 3
**Berechtigungen**: `activeTab`, `scripting`, `downloads`
**Architektur**: Popup-Script + Content-Script mit Message-Passing

### Dateinamensformat

```
seitentitel_YYYY-MM-DD.html
```

Beispiel: `beispiel_webseite_2025-10-22.html`

## Einschränkungen

Die Extension kann **nicht** einbetten:
- Video-/Audio-Elemente (würde zu große Dateien erzeugen)
- Canvas-Inhalte (dynamisch gerendert)
- WebGL-Inhalte (laufzeitabhängig)
- iFrame-Inhalte (separate Dokumente, Sicherheitsbeschränkungen)
- Web-Fonts mit CORS-Einschränkungen

**Hinweise zu JavaScript**:
- Externe Skripte werden heruntergeladen und eingebettet
- API-Aufrufe und WebSockets funktionieren offline nicht
- Nur vertrauenswürdige Webseiten herunterladen

**Dateigrößen**:
- Base64-Kodierung erhöht Ressourcengröße um ~33%
- Große Bilder und JavaScript-Bibliotheken erhöhen die HTML-Dateigröße erheblich

## Projektstruktur

```
site-loader-extension/
├── manifest.json       # Extension-Konfiguration
├── popup.html         # Extension-Popup-UI
├── popup.js           # UI-Logik und Nachrichtenverarbeitung
├── content.js         # Seitenverarbeitung und Ressourcen-Einbettung
├── icon16.png         # Extension-Icon (16x16)
├── icon48.png         # Extension-Icon (48x48)
├── icon128.png        # Extension-Icon (128x128)
└── README.md          # Diese Datei
```

## Entwicklung

### Änderungen testen

1. **Popup-Änderungen** (popup.html, popup.js):
   - Änderungen beim nächsten Popup-Öffnen sichtbar

2. **Content-Script-Änderungen** (content.js):
   - Extension unter `chrome://extensions/` neu laden
   - Zielwebseite aktualisieren

3. **Manifest-Änderungen** (manifest.json):
   - Extension unter `chrome://extensions/` neu laden

### Debugging

- **Popup-Logs**: Rechtsklick auf Extension-Icon → "Popup prüfen"
- **Content-Script-Logs**: F12 auf Webseite → Console-Tab

## Lizenz

MIT License

Copyright (c) 2025 Martin Pfeffer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Entwickler

**Martin Pfeffer** - 2025

## Beiträge

Beiträge, Issues und Feature-Requests sind willkommen!

## Changelog

### Version 1.0 (2025)
- Initiale Veröffentlichung
- Base64-Einbettung für alle Ressourcen
- Deutsche Lokalisierung
- Manifest V3 Implementierung
