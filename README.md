# Kuromi Coins

Bot Discord d'économie et de casino basé sur discord.js et MongoDB.

## Installation

1. Installer Node.js 20 ou plus récent.
2. Lancer `npm install`.
3. Copier `.env.example` vers `.env` et remplir les valeurs.
4. Lancer `start.bat` sous Windows.

## Vérifications

```bash
npm test
```

GitHub Actions exécute automatiquement les tests sur chaque push vers `main`.

## Architecture

- `Commands/` : commandes par catégorie.
- `Events/` : événements Discord.
- `Models/` : modèles MongoDB.
- `utils/` : économie, jeux, récompenses, tickets, logs et configuration.
- `config/botConfig.js` : valeurs par défaut centralisées.
- `+configlist` : configuration persistante des salons.

## Sécurité de l'économie

Les opérations importantes utilisent des mises à jour atomiques MongoDB. Les transferts et les réservations/règlements de parties utilisent des transactions.

Slots, Mines et Crash créent une session de récupération persistante. Si le bot s'arrête pendant une partie, la mise ou la cagnotte encore récupérable est remboursée automatiquement au prochain démarrage.

Les cooldowns et progressions importantes sont persistés en MongoDB.

## Développement

`start.bat` utilise nodemon pour redémarrer lors des modifications de fichiers. En cas de crash fatal, le script relance également le bot automatiquement.
