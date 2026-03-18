#!/bin/bash
echo "Checking for processes on port 3000..."
lsof -ti:3000 2>/dev/null && echo "Port 3000 is in use" || echo "Port 3000 is free"

echo ""
echo "To kill a process on port 3000, run:"
echo "  lsof -ti:3000 | xargs kill -9"
echo ""
echo "Or use a different port:"
echo "  PORT=3001 npm run dev"
