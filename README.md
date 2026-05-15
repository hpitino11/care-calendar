# Care Calendar

An admin dashboard for managing home care visits, caregivers, and clients. Built as a take-home project as the technical portion of an interview.

> **Note:** This is a technical demo intended for reviewer evaluation. In a production environment it would be secured behind authentication, role-based access control, and HTTPS-only API communication.

---

## Overview

Care Calendar gives administrators a centralized view of a caregiving operation: who is working, who they are caring for, and when. The dashboard surfaces key stats at a glance and provides a full interactive calendar for scheduling and reviewing visits across month, week, and day views.

---

## Features

### Dashboard
- Greeting and live date with daily visit count, weekly scheduled visits, and active caregiver stats
- Week-over-week trend badges for visits and caregiver activity
- Cancelled visits banner for today's cancellations
- Interactive FullCalendar with month, week, and day views
- Click any date to pre-fill the Add Visit modal
- Hover tooltips on week/day events showing caregiver, client, service type, duration, and status
- Week view visit grouping - overlapping or close-in-time visits are collapsed into a single card with a hover tooltip listing each grouped visit

### Visits
- Full visit list with search, pagination, and status filtering
- Create visits with caregiver, client, service type, date/time, and optional multi-day end date
- Edit visit details and update status (Scheduled → Completed / Cancelled)
- Multi-day visits display as spanning blocks in the calendar

### Caregivers
- Add, edit, and delete caregivers
- Auto-formatted phone numbers `(XXX) XXX-XXXX` with a 10-digit cap
- Name and email validation on add and edit

### Clients
- Add, edit, and delete clients
- Same phone formatting and validation as caregivers

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, FullCalendar, CSS (rem-based) |
| Backend | Node.js, Express |
| Database | PostgreSQL (raw SQL via `pg`, no ORM) |
| Deployment | Railway (frontend + backend + database) |

---

## Project Structure

```
care-calendar/
├── client/                   # React frontend
│   ├── public/
│   └── src/
│       ├── api.js            # Base URL config
│       ├── components/       # Layout, Sidebar, TopNav, Modal
│       └── pages/            # Dashboard, Visits, Caregivers, Clients
│
└── server/                   # Express backend
    ├── index.js              # App entry point
    ├── db/
    │   └── pool.js           # PostgreSQL connection pool
    ├── routes/               # caregivers, clients, visits
    └── controllers/          # Business logic and SQL queries
```

---

## API Endpoints

### Caregivers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/caregivers` | Get all caregivers |
| POST | `/api/caregivers` | Create a caregiver |
| PUT | `/api/caregivers/:id` | Update a caregiver |
| DELETE | `/api/caregivers/:id` | Delete a caregiver |

### Clients
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/clients` | Get all clients |
| POST | `/api/clients` | Create a client |
| PUT | `/api/clients/:id` | Update a client |
| DELETE | `/api/clients/:id` | Delete a client |

### Visits
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/visits` | Get all visits (with caregiver and client names) |
| POST | `/api/visits` | Create a visit |
| PUT | `/api/visits/:id` | Update a visit |
| PUT | `/api/visits/:id/status` | Update visit status only |
| DELETE | `/api/visits/:id` | Delete a visit |

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database

### 1. Clone the repo
```bash
git clone <repo-url>
cd care-calendar
```

### 2. Configure environment variables

Create `server/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/care_calendar
PORT=8080
```

Create `client/.env`:
```
REACT_APP_API_URL=http://localhost:8080
```

### 3. Set up the database

Create a PostgreSQL database and run the schema:
```bash
createdb care_calendar
psql -d care_calendar -f server/db/schema.sql
```

### 4. Install dependencies
```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 5. Start the servers
```bash
# Backend (from /server)
node index.js

# Frontend (from /client)
npm start
```

The frontend runs on `http://localhost:3000` and connects to the backend on port `8080`.

---

## Testing & Validation

- API endpoints were tested using Postman to verify CRUD functionality and request/response handling
- Accessibility and performance checks were performed using Google Lighthouse, with focus on accessibility best practices and responsive usability
- Typography and UI spacing were designed with ADA accessibility considerations in mind, using clean, highly legible fonts and scalable rem-based sizing to improve readability across devices

## Production Considerations

This dashboard is intentionally scoped as a technical demo. A production deployment would include:

- **Authentication** - login flow with session management or JWT tokens to restrict access to authorized admins only
- **Role-based access control** - different permission levels for admins, supervisors, and read-only viewers
- **HTTPS** - all API communication over TLS
- **Input sanitization** - server-side validation beyond the current format checks
- **Rate limiting** - prevent abuse of the public API endpoints
- **Audit logging** - track who created, edited, or deleted records and when
