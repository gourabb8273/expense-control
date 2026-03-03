## Expense Control PWA

A mobile-friendly PWA to track your investments and expenses, with monthly and yearly charts backed by a Node/Express API and MongoDB.

### Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose), JWT auth
- **Frontend**: React (Vite), React Router, Axios, Chart.js
- **PWA**: Manifest + service worker for installable app and basic offline shell

### Getting started

1. **Create your `.env` file** at the project root, based on `.env.example`, and set:
   - `MONGODB_URI` pointing to your Mongo instance
   - `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` for your personal login
   - `JWT_SECRET` to a strong random string

2. **Backend**

```bash
cd backend
cp ../.env .env   # or set the same vars in backend/.env
npm run dev
```

The API will listen on `http://localhost:4000` by default.

3. **Seed demo user**

Once backend is running:

```bash
curl -X POST http://localhost:4000/api/auth/seed-demo-user
```

You can now log in using `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`.

4. **Frontend**

```bash
cd frontend
cp ../.env .env   # optional; VITE_API_URL can be overridden here
npm run dev
```

Open the printed URL (usually `http://localhost:5173`) in your browser. You can install it as a PWA on mobile.

### Features

- Add entries in steps (type → amount → category/description → date)
- Monthly:
  - Total spend + split between **investment vs expenses**
  - Category pie chart
  - List of that month's entries (with delete)
- Yearly:
  - Month-by-month totals (investment vs expenses)
  - Top categories for the year
- Single-user login using your configured demo credentials

