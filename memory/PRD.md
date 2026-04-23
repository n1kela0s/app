# PRD — Proietta

## Original Problem Statement
"Costruiscimi una piattaforma utilizzabile da me e dai miei amici, in cui un utente definito master può inviare immagini a degli utenti chiamati giocatori in tempo reale. I giocatori si collegano tramite questa piattaforma e passivamente ricevono sullo schermo una o più immagini (con del testo) inviate dal master."

## User Personas
- **Master** (host): crea una stanza, carica o incolla URL di immagini, aggiunge didascalia e le proietta ai giocatori.
- **Giocatore** (spettatore): entra tramite codice stanza + nome, riceve le immagini passivamente in tempo reale.

## Core Requirements (static)
- Auth semplice: stanze con codice a 6 caratteri, niente account.
- Immagini da upload locale + URL esterno.
- Broadcast sincrono a tutti i giocatori di una stanza.
- Didascalia breve (max 140).
- Storico persistente delle immagini inviate, visibile sia al master che ai giocatori.

## Architecture / Stack
- **Backend**: FastAPI + Motor (MongoDB) + WebSocket `/api/ws/{code}`.
- **Storage**: Emergent Object Storage (`EMERGENT_LLM_KEY`) per upload file.
- **Frontend**: React + React Router + shadcn/ui + framer-motion. Fonts: Outfit + Manrope. Theme: Cinematic Dark con accent Amber.
- **Routes**: `/` Landing, `/join`, `/master/:code`, `/play/:code`.

## Implemented (Feb 2026)
- Creazione stanza + master token.
- Join stanza con validazione nome/codice.
- Invio immagine via URL o upload multipart.
- Broadcast real-time via WebSocket + presence count.
- Storico con Sheet laterale per i giocatori.
- Chiusura stanza con disconnessione broadcast.
- UI cinematica con grain overlay, glassmorphism, animazioni Framer Motion.

## Backlog (priorità)
- **P1**: Reazioni/emoji dai giocatori al master in tempo reale.
- **P1**: Reconnect automatico WebSocket (exponential backoff).
- **P2**: Supporto multi-immagine per singolo invio (galleria).
- **P2**: Lock di una stanza con PIN opzionale.
- **P2**: Esportazione storico in ZIP.
- **P3**: Moderazione base + kick giocatori.
