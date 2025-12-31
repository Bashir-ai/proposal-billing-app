#!/bin/bash

# Deployment Script for Proposal Billing App
# This script helps you deploy to Vercel

echo "🚀 Deployment Setup Script"
echo "=========================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - ready for deployment"
    echo "✓ Git repository initialized"
    echo ""
    echo "⚠️  Next steps:"
    echo "1. Create a new repository on GitHub (github.com/new)"
    echo "2. Run these commands:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
else
    echo "✓ Git repository already initialized"
    echo ""
    echo "Current git status:"
    git status --short
    echo ""
fi

# Check if Vercel CLI is installed
if command -v vercel &> /dev/null; then
    echo "✓ Vercel CLI is installed"
    echo ""
    echo "To deploy, run:"
    echo "  vercel"
    echo ""
    echo "For production deployment:"
    echo "  vercel --prod"
    echo ""
else
    echo "📦 Vercel CLI not found"
    echo ""
    echo "To install Vercel CLI, run:"
    echo "  npm i -g vercel"
    echo ""
    echo "Or deploy via web interface:"
    echo "1. Go to https://vercel.com"
    echo "2. Sign in with GitHub"
    echo "3. Click 'Add New Project'"
    echo "4. Import your GitHub repository"
    echo ""
fi

echo "📋 Environment Variables Needed:"
echo "================================"
echo "DATABASE_URL=your-postgresql-connection-string"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo 'generate-with-openssl-rand-base64-32')"
echo "NEXTAUTH_URL=https://your-app.vercel.app"
echo ""
echo "💡 Tip: Generate NEXTAUTH_SECRET with: openssl rand -base64 32"
echo ""


