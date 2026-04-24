# Proietta / Poké Arena — PRD

## Problem statement (latest iteration)
A parte dall'app in repository, aggiungere le seguenti features:
1. Quando il master invia i pokemon nella stanza può decidere se lanciarli come alleati, nemici o nessuno dei due (neutri).
2. Lo schermo del player è diviso in alleati, nemici e neutri con visione simultanea di più pokémon per sezione.
3. Il master può rimuovere i pokémon dal campo e dalla cronologia (compreso "pulisci tutta la cronologia"), con sync live.

## Architettura
- Backend: FastAPI + MongoDB + WebSocket broadcast
- Frontend: React (CRA + craco), TailwindCSS, framer-motion, sonner
- Comunicazione real-time: /api/ws/{code} con broadcast per room

## Core requirements
- Master può creare/chiudere arene e schierare pokémon con categoria (ally/neutral/enemy)
- Player riceve aggiornamenti live e vede 3 zone orizzontali
- Master può rimuovere dal campo (resta in cronologia come "sconfitto"), eliminare entry, svuotare tutta la cronologia
- Nessun limite al numero di pokémon per categoria

## What's been implemented

### Iter 1 (pre-esistente)
- Landing, Join, Master dashboard (search PokéAPI, URL, upload UI), Player view single-pokemon
- Room create/join, image send con WebSocket broadcast single-current

### Iter 2 — 2026-04-24 (nuove features)
- Backend (`/app/backend/server.py`):
  - `SendImageRequest` aggiunto campo `category` (ally|neutral|enemy, default neutral)
  - Ogni image memorizza `category` e `active: bool`
  - `GET /api/rooms/{code}` backfilla `category=neutral` e `active=true` per record legacy
  - `POST /api/rooms/{code}/images/{id}/remove` → set active=false (rimuovi dal campo)
  - `DELETE /api/rooms/{code}/images/{id}` → elimina completamente
  - `DELETE /api/rooms/{code}/images` → clear all history
  - Broadcast WS: `image` (con category), `image_removed_field`, `image_deleted`, `history_cleared`
  - Tutti gli endpoint di mutazione richiedono `X-Master-Token` (403 altrimenti)
- Frontend Master (`MasterDashboard.jsx`):
  - 3 pulsanti separati di lancio: Alleato (verde), Neutro (ambra), Nemico (rosa) con test-id `send-ally-btn|send-neutral-btn|send-enemy-btn`
  - Sezione "In campo" divisa in 3 gruppi con chip colorato e pulsante X di rimozione per card (`remove-field-{id}`)
  - Cronologia con chip categoria + badge "Sconfitto" se inattivo, pulsante trash per card (`delete-history-{id}`) e "Pulisci" globale (`clear-history-btn`)
- Frontend Player (`PlayerView.jsx`):
  - 3 sezioni orizzontali impilate: `zone-ally` sopra, `zone-neutral` centro, `zone-enemy` sotto
  - Card multiple per sezione con layout wrap, animazioni framer-motion layout
  - Gestione eventi WS: `image`, `image_removed_field`, `image_deleted`, `history_cleared`
  - Stato waiting se nessun pokémon attivo
  - Storico sheet con chip categoria + badge "Sconfitto"

### Testing (iter 2)
- Backend: 16/16 pytest cases pass (categorie, 403 protection, remove/delete/clear, backfill legacy, WS broadcasts)
- Frontend: E2E 2-contexts pass (master + player) con live sync confermato
- Zero console errors, zero issue aperte

## Prioritized backlog / TODO
- P1: Implementare endpoint `/rooms/{code}/close` e `/rooms/{code}/upload` che sono referenziati dal frontend ma mancanti nel backend (pre-esistenti, non bloccanti)
- P2: Reconnect logic sul WebSocket del player in caso di disconnessione
- P2: Master WS sync (se più master condividono token)
- P3: Drag & drop per riordinare pokémon in campo, o per cambiare categoria al volo
- P3: Vita/HP visuale su ogni card (barra con decremento animato)

## Next Action Items
- Attendere feedback utente per eventuali rifiniture grafiche
- Implementare P1 (close/upload) se richiesto
