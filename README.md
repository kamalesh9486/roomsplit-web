# RoomSplit Web

Shared expense tracker for Bachelors Suite #402 — Vue 3 + Vite + Supabase, deployed on Vercel.

**Every push to `main` auto-deploys. Roommates just open the URL — no APK, no installs.**

---

## One-time Setup

### 1. Supabase — verify your tables exist

Your Android app already uses Supabase. The web app reads the same data.
Run this SQL in **Supabase → SQL Editor** if the tables don't exist yet:

```sql
create table if not exists roommates (
  id bigint primary key,
  name text not null
);

create table if not exists expenses (
  id bigint primary key,
  title text not null,
  amount float8 not null,
  payer_id bigint references roommates(id),
  date bigint not null
);

create table if not exists expense_splits (
  id bigint primary key,
  expense_id bigint references expenses(id),
  roommate_id bigint references roommates(id),
  amount float8 not null
);

-- Allow anonymous read/write (the app uses anon key)
alter table roommates enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;

create policy "anon all" on roommates for all using (true) with check (true);
create policy "anon all" on expenses for all using (true) with check (true);
create policy "anon all" on expense_splits for all using (true) with check (true);
```

### 2. Push to GitHub

```bash
cd roomsplit-web
git init
git add .
git commit -m "initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/roomsplit-web.git
git push -u origin main
```

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your `roomsplit-web` GitHub repo
3. Framework preset will auto-detect **Vite**
4. Go to **Environment Variables** and add:
   ```
   VITE_SUPABASE_URL      = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-key
   ```
   (Find these in Supabase → Project Settings → API)
5. Click **Deploy**

Vercel gives you a URL like `https://roomsplit-web.vercel.app`.
Share that link with your roommates — done.

---

## How updates work

```
You edit code → git push → Vercel auto-builds → URL updates in ~30 seconds
```

Roommates refresh their browser and see the new version. Zero manual distribution.

---

## Local development

```bash
cp .env.example .env
# Fill in your Supabase URL and anon key in .env

npm install
npm run dev
```

---

## Features

| Feature | Details |
|---|---|
| Login | Name-based, no password |
| Balances | Total paid vs owed per person |
| Settlements | Who owes whom per expense |
| Expenses | Add / edit / delete (admin only for delete) |
| Roommates | Add / remove members |
| Admin | User named "Kamal" gets delete privileges |
| Same data | Shares the Supabase DB with the Android app |
