#!/bin/bash

echo "=========================================="
echo "Database Migration Script"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Push the Prisma schema to your database"
echo "2. Regenerate the Prisma client"
echo ""
echo "Press Enter to continue, or Ctrl+C to cancel..."
read

echo ""
echo "Step 1: Pushing schema to database..."
echo "----------------------------------------"
npx prisma db push

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Database schema updated successfully!"
    echo ""
    echo "Step 2: Regenerating Prisma client..."
    echo "----------------------------------------"
    npx prisma generate
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✓ Prisma client regenerated successfully!"
        echo ""
        echo "=========================================="
        echo "Migration complete!"
        echo "=========================================="
        echo ""
        echo "IMPORTANT: You must restart your development server:"
        echo "1. Stop your current server (Ctrl+C)"
        echo "2. Run: npm run dev"
        echo ""
    else
        echo ""
        echo "✗ Error regenerating Prisma client"
        exit 1
    fi
else
    echo ""
    echo "✗ Error updating database schema"
    exit 1
fi






