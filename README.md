# Proposal & Billing Application

A user-friendly application for preparing and sending proposals to clients, and billing accordingly.

## Features

- Multiple billing formats: Hourly, Lump Sum, Subject Basis, Success Fee
- Role-based access control: Admin, Manager, Staff, Client
- Approval workflow system
- Clean, light, and intuitive interface

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- PostgreSQL + Prisma
- NextAuth.js
- Tailwind CSS
- shadcn/ui components




