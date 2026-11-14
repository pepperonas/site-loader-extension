# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [Unveröffentlicht]

### Behoben
- Release-ZIP enthielt weder `background.js` noch `lib/jszip.min.js` — die
  veröffentlichte v2.0 lässt sich deshalb nicht laden
- CSS-Fragmentverweise wie `filter: url(#blur)` wurden als Ressource geladen
  und durch die Seite selbst ersetzt
- `$'`, `$&`, `$$` in geladenem CSS wurden beim Einsetzen als Ersetzungsmuster
  ausgewertet und verfälschten den Inhalt
- `srcset` ohne Deskriptor (`a.jpg, b.jpg 2x`) wurde falsch zerlegt
- Zirkuläre bzw. doppelte `@import` bleiben nicht mehr stehen (und werden
  nicht ein zweites Mal als `url()` eingebettet)
- Verschiedene Schreibweisen derselben URL wurden doppelt geladen
- Bereits umgewandelte Stylesheets liefen ein zweites Mal durch die
  CSS-Verarbeitung (mit falscher Basis-URL)

### Hinzugefügt
- Unit-Tests (`node --test test/*.test.js`) und CI-Workflow

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
