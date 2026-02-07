# Gra samochodowa multiplayer (Three.js + Socket.io)

To demo łączy WebGL (Three.js) z serwerem Node.js + Socket.io. Zawiera:
- Otwarty świat z torem i przeszkodami.
- Kilka samochodów o różnych statystykach.
- Fizykę jazdy (drift, nitro, kolizje z przeszkodami).
- Lobby multiplayer i czat.
- Kamerę trzecioosobową oraz z maski.
- HUD (prędkościomierz, minimapa).
- Menu garażu i ustawień.

## Wymagania
- Node.js 18+

## Uruchomienie lokalnie
1. Zainstaluj zależności:
   ```bash
   npm install
   ```
2. Uruchom serwer:
   ```bash
   npm start
   ```
3. Otwórz w przeglądarce: http://localhost:3000

## Sterowanie
- **WASD** - jazda
- **SHIFT** - nitro
- **SPACE** - drift
- **C** - zmiana kamery

## Struktura projektu
```
.
├── public
│   ├── client.js
│   ├── index.html
│   └── styles.css
├── server.js
└── package.json
```

## Uwagi techniczne
- Synchronizacja multiplayer działa na bazie wysyłania stanu pojazdu do serwera i jego rozgłaszania.
- Realistyczną grafikę w stylu Forza Horizon w praktyce uzyskasz przez wymianę modeli na PBR, HDRI i lepsze shadery.
