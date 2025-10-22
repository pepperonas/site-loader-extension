# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [1.0.0] - 2025-10-22

### Hinzugefügt
- Initiale Veröffentlichung der Extension
- Herunterladen von Webseiten als eigenständige HTML-Datei
- Base64-Einbettung für alle Ressourcen:
  - CSS-Stylesheets (extern und inline)
  - Bilder (JPG, PNG, GIF, WebP, SVG)
  - Hintergrundbilder (CSS `url()`)
  - Favicons
  - JavaScript-Dateien
  - Schriftarten (in CSS referenziert)
- Deutsche Lokalisierung der Benutzeroberfläche
- Automatische Dateinamensgenerierung (Titel + Datum)
- Chrome Manifest V3 Implementierung
- Fallback-Injektion des Content-Scripts
- Fehlerbehandlung für CORS-geschützte Ressourcen

### Technische Details
- Popup-Interface (300px Breite)
- Message-Passing-Kommunikation zwischen Popup und Content-Script
- Blob-URL-basierter Download-Mechanismus
- Asynchrone Ressourcenverarbeitung

[1.0.0]: https://github.com/username/site-loader-extension/releases/tag/v1.0.0
