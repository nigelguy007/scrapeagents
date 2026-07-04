#!/bin/bash
# Double-click this file on a Mac to start the Masterclass Agents app.
# It installs what's needed (once), starts the server, and opens your browser.

cd "$(dirname "$0")" || exit 1

echo "── Masterclass Agents ──────────────────────────"

# Check Node is installed
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js isn't installed yet. It's free and takes 2 minutes:"
  echo "  1. Go to  https://nodejs.org"
  echo "  2. Download the big green 'LTS' button and run the installer."
  echo "  3. Then double-click this file again."
  echo
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

# Install dependencies the first time
if [ ! -d node_modules ]; then
  echo "First-time setup: installing (about 30 seconds)…"
  npm install || { echo "Install failed."; read -n 1 -s -r -p "Press any key to close."; exit 1; }
fi

# Open the browser shortly after the server starts
( sleep 2; open "http://localhost:3456" ) &

echo "Starting… your browser will open at http://localhost:3456"
echo "To use it on your iPhone, look for the 'On your iPhone' address below."
echo "Keep this window open while you use the app. Close it to stop."
echo
npm start
