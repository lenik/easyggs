#!/bin/bash

# EasyGGS Vercel Deployment Script

echo "🚀 Deploying EasyGGS to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Run tests before deployment
echo "🧪 Running tests..."
npm test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Deployment aborted."
    exit 1
fi

# Deploy to Vercel
echo "📦 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo "🌐 Your EasyGGS server is now live on Vercel!"
echo ""
echo "📋 Available endpoints:"
echo "   GET /health"
echo "   GET /npc/:color?size=<size>&board=<board_data>"
echo "   GET /influence?board=<board_data>&size=<size>"
echo ""
echo "📖 Example usage:"
echo "   curl \"https://your-domain.vercel.app/npc/black?size=5&board=128,512,4,8,24\""
echo "   curl \"https://your-domain.vercel.app/influence?board=128,512,4,8,24\""
