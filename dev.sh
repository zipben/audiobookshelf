#!/bin/bash

# AudioBookShelf Development Script
# Runs both server (port 3333) and client (port 3000) concurrently

set -e

echo "🚀 Starting AudioBookShelf in development mode..."
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    
    # Kill background processes
    if [[ ! -z "$SERVER_PID" ]]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    if [[ ! -z "$CLIENT_PID" ]]; then
        kill $CLIENT_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on the ports
    lsof -ti:3333 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    echo "✅ Services stopped"
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Make sure dependencies are installed
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing server dependencies..."
    npm ci
fi

if [[ ! -d "client/node_modules" ]]; then
    echo "📦 Installing client dependencies..."
    cd client && npm ci && cd ..
fi

echo "🖥️  Starting server (port 3333)..."
npm run dev > server.log 2>&1 &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

echo "🌐 Starting client (port 3000)..."
cd client
npm run dev > ../client.log 2>&1 &
CLIENT_PID=$!
cd ..

echo ""
echo "✅ Services starting!"
echo ""
echo "📊 Server:  http://localhost:3333"
echo "🎨 Client:  http://localhost:3000/audiobookshelf/"
echo ""
echo "📝 Logs:"
echo "   Server: tail -f server.log"
echo "   Client: tail -f client.log"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for services and show logs
sleep 2

# Function to show live logs
show_logs() {
    echo "📊 Server logs (last 10 lines):"
    tail -n 10 server.log 2>/dev/null || echo "No server logs yet..."
    echo ""
    echo "🎨 Client logs (last 10 lines):"
    tail -n 10 client.log 2>/dev/null || echo "No client logs yet..."
    echo ""
}

# Show initial logs
show_logs

# Keep script running and periodically show status
while true; do
    sleep 30
    
    # Check if processes are still running
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "❌ Server process died. Check server.log for errors."
        exit 1
    fi
    
    if ! kill -0 $CLIENT_PID 2>/dev/null; then
        echo "❌ Client process died. Check client.log for errors."
        exit 1
    fi
    
    echo "✅ Services running ($(date))"
done