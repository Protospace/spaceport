#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Initialising rfbrowser Playwright browsers..."
rfbrowser init

echo "Setup complete. Run tests with:"
echo "  robot -d results tests/"
echo "  robot -d results -i smoke tests/"
