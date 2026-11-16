#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing the pinned app dependencies..."
  npm install
fi

echo "Starting the app; open the Local URL printed by Vite below."
npm run dev -- --host 127.0.0.1
