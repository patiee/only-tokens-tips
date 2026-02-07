# Streamer Tipping Platform - Frontend

This is the frontend application for the Streamer Tipping Platform, built with Next.js and Tailwind CSS. It allows users to sign up, manage their profiles, and send crypto tips to streamers.

## Prerequisites

- **Node.js**: Version 18 or higher.
- **npm** or **yarn**: Package manager.
- **MetaMask**: Browser extension for Ethereum wallet connection (Sepolia network).

## Installation

Install the dependencies:

```bash
npm install
# or
yarn install
```

## Build and Run

### Development

Start the development server:

```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`.

### Production Build

To build the application for production:

```bash
npm run build
npm start
```

## Key Routes

- `/signup`: Streamer registration page (Connect Wallet, Mock OAuth).
- `/me`: Dashboard for logged-in streamers.
- `/[username]`: Public tipping page for a specific streamer.
- `/widget/[username]`: OBS widget for real-time tip alerts.
