#!/bin/bash

# Test Cleanup Script
# Ensures no zombie processes remain after testing

echo "🧹 Cleaning up test processes..."

# Kill any remaining vite processes
pkill -f 'vite' || true

# Kill any remaining vitest processes  
pkill -f 'vitest' || true

# Kill any remaining playwright processes
pkill -f 'playwright' || true

# Kill any node processes on test ports
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5183 | xargs kill -9 2>/dev/null || true

echo "✅ Test cleanup complete"

# Show remaining processes
echo "📊 Remaining test-related processes:"
ps aux | grep -E 'vite|vitest|playwright' | grep -v grep || echo "None found"