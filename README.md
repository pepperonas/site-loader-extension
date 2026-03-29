# Site Loader Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/pepperonas/site-loader-extension)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Version](https://img.shields.io/badge/Version-2.0-blue)](https://github.com/pepperonas/site-loader-extension/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![JSZip](https://img.shields.io/badge/JSZip-3.10.1-orange)](https://stuk.github.io/jszip/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/pepperonas/site-loader-extension/pulls)
[![GitHub Issues](https://img.shields.io/github/issues/pepperonas/site-loader-extension)](https://github.com/pepperonas/site-loader-extension/issues)
[![GitHub Stars](https://img.shields.io/github/stars/pepperonas/site-loader-extension?style=social)](https://github.com/pepperonas/site-loader-extension)
[![Made with Claude](https://img.shields.io/badge/Made%20with-Claude-blueviolet)](https://claude.ai)
[![Platform](https://img.shields.io/badge/Platform-Chromium-lightgrey?logo=googlechrome)](https://www.chromium.org/)
[![No Dependencies](https://img.shields.io/badge/Dependencies-1%20(JSZip)-green)](https://github.com/pepperonas/site-loader-extension)

<p align="center">
  <img src="banner.png" alt="Site Loader Extension – Website als ZIP oder HTML herunterladen" width="700">
</p>

Eine Chrome/Chromium-Browser-Extension, die komplette Webseiten als **ZIP-Archiv** (HTML + Assets) oder als **einzelne HTML-Datei** mit eingebetteten Ressourcen herunterladet. Alle externen Ressourcen werden erfasst, CORS-Beschraenkungen umgangen und Dateien parallel geladen.

---

## Funktionen

- **ZIP-Archiv oder Einzeldatei** -- Wahl zwischen ZIP (HTML + separate Asset-Dateien, kein Base64-Overhead) oder Single-HTML (alles als Base64 eingebettet, einfach teilbar)
- **CORS-freier Download** -- Background Service Worker fetcht Ressourcen ohne CORS-Restriktionen, wo Content Scripts blockiert werden
- **Paralleles Laden** -- Batch-Fetch mit 6 parallelen Workern und 10er-Chunk-Verarbeitung statt sequentiellem Download
- **URL-Deduplizierung** -- Cache-Map stellt sicher, dass gleiche Ressourcen nur einmal geladen und im ZIP nur einmal gespeichert werden
- **Fortschrittsanzeige** -- Live-Progressbar mit Stage-Labels (CSS, Bilder, Fonts, ...) und Ressourcen-Counter
- **Timeout-Schutz** -- 15-Sekunden-Timeout pro Ressource verhindert haengende Downloads
- **Vollstaendige Offline-Kopien** -- Alle visuellen Elemente einer Seite werden erfasst
- **Deutsche Benutzeroberflaecheche** -- Komplett auf Deutsch lokalisiert

---

## Unterstuetzte Ressourcen

| Ressource | Details |
|---|---|
| **CSS-Stylesheets** | Externe Stylesheets, Inline-`<style>`-Tags, rekursive `@import`-Aufloesungoesung (mit Zirkulaerschutz, max. Tiefe 10) |
| **CSS `url()`-Referenzen** | Fonts, Hintergrundbilder, Cursor-Icons und alle weiteren `url()`-Verweise innerhalb von CSS |
| **Bilder** | `<img src>`, `<img srcset>` (responsive Bilder mit Breitenangaben), `<picture>`/`<source>` Elemente |
| **SVG-Dateien** | `<img src="*.svg">`, `<object data="*.svg">` (mit Query-Parameter-Handling) |
| **Hintergrundbilder** | Inline-`style`-Attribute mit `url()`, sowie Computed Styles aus CSS-Regeln (nicht nur inline) |
| **Favicons** | `<link rel="icon">`, `<link rel="shortcut icon">`, `<link rel="apple-touch-icon">` |
| **JavaScript** | Externe Scripts -- im ZIP-Modus als separate `.js`-Dateien, im HTML-Modus inline eingebettet (alle Attribute wie `async`, `defer`, `type` werden beibehalten) |
| **Schriftarten** | In CSS referenzierte Web-Fonts via `@font-face` und `url()` (WOFF, WOFF2, TTF, OTF) |
| **Video-Poster** | `<video poster>` Attribute (Vorschaubilder) |
| **Preload-Ressourcen** | `<link rel="preload">` fuer Fonts, Images und Styles |

---

## Installation

### Fertiges Release herunterladen (empfohlen)

1. Zur [neuesten Release-Version](https://github.com/pepperonas/site-loader-extension/releases/latest) gehen
2. ZIP-Datei unter "Assets" herunterladen
3. ZIP-Datei entpacken
4. Chrome/Chromium oeffnen und zu `chrome://extensions/` navigieren
5. **Entwicklermodus** aktivieren (Toggle oben rechts)
6. **Entpackte Extension laden** klicken
7. Entpackten Ordner auswaehlen

### Aus dem Quellcode

```bash
git clone https://github.com/pepperonas/site-loader-extension.git
```

1. Chrome/Chromium oeffnen und zu `chrome://extensions/` navigieren
2. **Entwicklermodus** aktivieren (Toggle oben rechts)
3. **Entpackte Extension laden** klicken
4. Den geklonten Ordner auswaehlen

---

## Verwendung

1. Webseite oeffnen, die heruntergeladen werden soll
2. Extension-Icon in der Browser-Toolbar klicken
3. **Modus waehlen**: ZIP-Archiv (Standard) oder Einzelne HTML
4. **Seite herunterladen** klicken
5. Fortschritt in der Progressbar verfolgen
6. Datei wird automatisch im Download-Ordner gespeichert

### ZIP-Modus (Standard)

Erzeugt ein ZIP-Archiv mit folgender Struktur:

```
website_2025-03-29.zip
├── index.html          # Hauptseite mit relativen Asset-Pfaden
└── assets/
    ├── img/            # Bilder (PNG, JPG, WebP, SVG, ...)
    ├── js/             # JavaScript-Dateien
    ├── css/            # (inline im HTML, Fonts/Bilder hier)
    ├── bg/             # Hintergrundbilder
    ├── svg/            # SVG-Dateien aus <object>-Tags
    └── fonts/          # Web-Fonts (WOFF2, WOFF, TTF)
```

**Vorteile**: Keine Base64-Aufblaehung (+33%), kleinere Dateien, Ressourcen koennen einzeln inspiziert werden.

### HTML-Modus

Erzeugt eine einzelne `.html`-Datei mit allen Ressourcen als Base64 Data-URIs eingebettet.

**Vorteile**: Eine einzige Datei, einfach per E-Mail oder Messenger teilbar.

---

## Technische Details

### Berechtigungen

| Permission | Verwendung |
|---|---|
| `activeTab` | Zugriff auf den Inhalt des aktiven Tabs |
| `scripting` | Dynamische Injection von Content Script und JSZip |
| `downloads` | Download der generierten Dateien ausloesen |

Die Extension benoetigt **keine** `<all_urls>`-Berechtigung und hat keinen Zugriff auf Tabs, die nicht aktiv angeklickt werden.

### Architektur

```
┌──────────────┐     chrome.runtime      ┌─────────────────────────┐
│  Popup (UI)  │ ──── sendMessage ──────> │  Background Service     │
│  popup.html  │ <─── onMessage ───────── │  Worker (background.js) │
│  popup.js    │                          │                         │
└──────────────┘                          │  - CORS-freier fetch()  │
       ^                                  │  - Batch mit 6 Workern  │
       │ progress                         │  - 15s Timeout/Resource │
       │ updates                          │  - Script Injection     │
       │                                  └────────┬────────────────┘
       │                                           │
       │                              chrome.tabs.sendMessage
       │                                           │
       │                                           v
       │                                  ┌────────────────────────┐
       └────────────── progress ───────── │  Content Script        │
                                          │  (content.js)          │
                                          │                        │
                                          │  1. DOM klonen         │
                                          │  2. CSS verarbeiten    │
                                          │  3. Bilder einbetten   │
                                          │  4. SVGs einbetten     │
                                          │  5. Backgrounds        │
                                          │  6. Computed Styles    │
                                          │  7. Favicons           │
                                          │  8. Scripts            │
                                          │  9. Video Poster       │
                                          │ 10. Preload            │
                                          │ 11. ZIP/HTML erzeugen  │
                                          │ 12. Download starten   │
                                          └────────────────────────┘
```

### Ressourcen-Pipeline

Die Verarbeitung erfolgt in einer festen Reihenfolge, um Abhaengigkeiten korrekt aufzuloesen:

1. **CSS Stylesheets** -- Externe `<link>` Stylesheets werden geladen und als `<style>`-Tags eingebettet. Dabei werden rekursiv alle `@import`-Anweisungen aufgeloest (mit Zirkulaerschutz) und saemtliche `url()`-Referenzen (Fonts, Bilder) konvertiert.

2. **Bilder** -- Alle `<img src>` werden verarbeitet. Bereits eingebettete Data-URIs (`data:...`) werden uebersprungen. Zusaetzlich werden `srcset`-Attribute auf `<img>` und `<source>`-Elementen mit allen Breitenangaben verarbeitet.

3. **SVGs** -- `<object data="*.svg">` Elemente werden separat behandelt, da sie ein eigenes Dokument referenzieren.

4. **Inline Background Images** -- Elemente mit `style`-Attributen, die `url()` enthalten, werden gescannt und die referenzierten Bilder eingebettet.

5. **Computed Background Images** -- Hintergrundbilder, die ueber CSS-Klassen (nicht inline) gesetzt werden, werden ueber `getComputedStyle()` auf dem Live-DOM ermittelt und auf den geklonten DOM uebertragen.

6. **Favicons** -- Alle `<link rel="icon">`, `rel="shortcut icon"` und `rel="apple-touch-icon"` werden eingebettet.

7. **JavaScript** -- Externe `<script src>` werden geladen. Im ZIP-Modus als separate Dateien, im HTML-Modus als Inline-Scripts (alle Attribute ausser `src` werden beibehalten).

8. **Video Poster** -- `<video poster>` Vorschaubilder werden eingebettet.

9. **Preload-Ressourcen** -- `<link rel="preload">` fuer Fonts, Images und Styles werden eingebettet.

### CORS-Bypass-Strategie

Content Scripts unterliegen der Same-Origin-Policy der Webseite. Viele CDN-Ressourcen (Google Fonts, Cloudflare, etc.) blockieren Cross-Origin-Requests ohne passenden `Access-Control-Allow-Origin`-Header.

Die Extension loest das, indem alle Fetches ueber den **Background Service Worker** laufen. Dieser hat keine CORS-Restriktionen und kann beliebige URLs laden. Der Content Script sendet die URL per `chrome.runtime.sendMessage`, der Service Worker fetcht die Ressource und gibt das Ergebnis (Base64 oder ArrayBuffer) zurueck.

### Performance-Optimierungen

- **Batch-Fetching**: URLs werden in 10er-Gruppen an den Service Worker gesendet, um IPC-Overhead zu reduzieren
- **6 parallele Worker**: Der Service Worker verarbeitet 6 Fetches gleichzeitig
- **URL-Cache**: Bereits geladene Ressourcen werden aus dem Cache bedient (Map mit `responseType:url` als Key)
- **Asset-Pfad-Deduplizierung**: `registerZipAsset()` stellt sicher, dass jede URL exakt einen Pfad im ZIP bekommt -- verhindert Inkonsistenzen zwischen HTML-Referenzen und ZIP-Inhalt
- **Force-Cache**: Fetch-Requests nutzen `cache: 'force-cache'`, um bereits im Browser gecachte Ressourcen zu verwenden

### Fehlerbehandlung

- **Non-blocking**: Fehlgeschlagene Ressourcen (CORS, 404, Timeout) werden geloggt aber uebersprungen -- der Download wird nicht abgebrochen
- **15s Timeout**: Jeder einzelne Fetch hat einen AbortController mit 15-Sekunden-Timeout
- **Fallback-Injection**: Wenn der Content Script noch nicht geladen ist (z.B. Extension gerade installiert), wird er dynamisch injiziert
- **JSZip-Fallback**: Wenn JSZip nicht verfuegbar ist, wird automatisch auf HTML-Modus zurueckgefallen
- **Zirkulaerer @import-Schutz**: Bereits besuchte Import-URLs werden uebersprungen, maximale Rekursionstiefe von 10

### Dateinamen

```
{seitentitel}_{YYYY-MM-DD}.zip     (ZIP-Modus)
{seitentitel}_{YYYY-MM-DD}.html    (HTML-Modus)
```

Der Seitentitel wird bereinigt: Sonderzeichen werden durch Unterstriche ersetzt, alles in Kleinbuchstaben. Deutsche Umlaute bleiben erhalten.

---

## Projektstruktur

```
site-loader-extension/
├── manifest.json       # Extension-Konfiguration (Manifest V3)
├── background.js       # Service Worker: CORS-Fetch, Batch-Processing, Message-Relay
├── content.js          # Ressourcen-Embedding-Pipeline (1000+ Zeilen)
├── popup.html          # UI: Modus-Toggle, Progressbar, Status
├── popup.js            # UI-Logik: Event-Handler, Progress-Listener
├── lib/
│   └── jszip.min.js    # JSZip v3.10.1 (~97KB)
├── banner.png          # README-Banner
├── icon16.png          # Extension-Icon 16x16
├── icon48.png          # Extension-Icon 48x48
├── icon128.png         # Extension-Icon 128x128
├── CLAUDE.md           # Claude Code Projektdokumentation
├── CHANGELOG.md        # Aenderungshistorie
└── README.md           # Diese Datei
```

---

## Einschraenkungen

### Nicht eingebettet

| Ressource | Grund |
|---|---|
| Video-/Audio-Streams | Wuerden zu riesigen Dateien fuehren (oft 100+ MB) |
| Canvas/WebGL-Inhalte | Dynamisch zur Laufzeit gerendert, nicht serialisierbar |
| iFrame-Inhalte | Separate Dokumente mit eigenen Security Contexts |
| WebSocket-/API-Daten | Laufzeit-abhaengig, koennen offline nicht reproduziert werden |

### Hinweise

- **JavaScript-Sicherheit**: Externe Scripts werden eingebettet und ausgefuehrt. Nur vertrauenswuerdige Webseiten herunterladen.
- **Offline-Funktionalitaet**: API-Aufrufe, WebSockets und dynamisch nachgeladene Inhalte funktionieren in der heruntergeladenen Datei nicht.
- **ZIP vs. HTML Groesse**: ZIP-Modus eliminiert den ~33% Base64-Overhead. Eine 10MB-Seite wird als ZIP ca. 10MB, als HTML ca. 13MB.
- **Chrome-Limit**: Chrome hat ein Blob-URL-Limit von ca. 500MB. Extrem grosse Seiten koennten dieses Limit erreichen.
- **Geschuetzte Seiten**: Chrome Web Store, `chrome://`-Seiten und andere System-URLs koennen nicht heruntergeladen werden.

---

## Entwicklung

### Aenderungen testen

| Geaenderte Datei | Aktion |
|---|---|
| `popup.html`, `popup.js` | Popup schliessen und neu oeffnen |
| `content.js` | Extension unter `chrome://extensions/` neu laden **und** Zielwebseite aktualisieren |
| `background.js`, `manifest.json` | Extension unter `chrome://extensions/` neu laden |

### Debugging

| Kontext | Zugang |
|---|---|
| **Popup** | Rechtsklick auf Extension-Icon, "Popup pruefen" |
| **Service Worker** | `chrome://extensions/` dann "Service Worker" Link bei der Extension |
| **Content Script** | F12 auf der Zielwebseite, Console-Tab |

### Haeufige Probleme

**"Fehler beim Laden der Ressource"** in der Console:
- Normal fuer CORS-geschuetzte Ressourcen, die auch ueber den Service Worker nicht erreichbar sind (z.B. Auth-geschuetzte Assets). Die Extension faehrt mit den verfuegbaren Ressourcen fort.

**ZIP ist leer oder sehr klein**:
- Pruefe die Service Worker Console auf Fehler. Moeglicherweise blockiert die Seite Script-Injection (strikte CSP-Header).

**Extension-Icon nicht klickbar**:
- Chrome Web Store und System-Seiten (`chrome://`, `chrome-extension://`) blockieren Extensions.

---

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

---

## Entwickler

**Martin Pfeffer** - 2025

## Beitraege

Beitraege, Issues und Feature-Requests sind willkommen! Bitte erstelle ein [Issue](https://github.com/pepperonas/site-loader-extension/issues) oder einen [Pull Request](https://github.com/pepperonas/site-loader-extension/pulls).

---

## Changelog

### Version 2.0 (2025)
- ZIP-Archiv Download (HTML + separate Asset-Dateien)
- Background Service Worker fuer CORS-freie Fetches
- Paralleles Ressourcen-Laden mit 6-Worker Batch-Processing
- URL-Deduplizierung und Ressourcen-Caching
- Fortschrittsanzeige mit Live-Updates und Stage-Labels
- Neue Ressourcentypen: `srcset`, `<picture>`, `@import` (rekursiv), `<video poster>`, `<link rel="preload">`
- Computed Background Images aus CSS-Regeln (nicht nur inline styles)
- 15s Timeout pro Ressource
- Robustere Fehlerbehandlung mit Fallback-Mechanismen
- ZIP-Asset-Pfad-Deduplizierung via `registerZipAsset()`
- Komplett ueberarbeitete UI mit Modus-Toggle

### Version 1.0 (2025)
- Initiale Veroeffentlichung
- Base64-Einbettung fuer alle Ressourcen (Single-HTML)
- Deutsche Lokalisierung
- Manifest V3 Implementierung
