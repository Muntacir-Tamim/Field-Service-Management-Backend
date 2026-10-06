# Field Service Management System - Backend

A REST API for managing the full life cycle of an on-site service business: a **customer** raises a service request, an **admin** reviews it and assigns a **technician**, the technician visits and completes the work, the customer pays an invoice online with **bKash**, and then leaves feedback.

> Backend only (no frontend). Test it with the included Postman collection.

**Roles:** `CUSTOMER`, `TECHNICIAN`, `ADMIN` (3 fixed roles, enforced by role middleware).

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Main Features](#main-features)
3. [Business Workflow](#business-workflow)
4. [Roles & Permissions](#roles--permissions)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [API Conventions](#api-conventions)
8. [API Endpoints](#api-endpoints)
9. [Payment Flow (bKash)](#payment-flow-bkash)
10. [Concurrency & Data Safety](#concurrency--data-safety)
11. [Security](#security)
12. [Testing the API with Postman](#testing-the-api-with-postman)
13. [Scripts](#scripts)
14. [Project Structure](#project-structure)

---

## Tech Stack

| Category            | Technology                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| Runtime & framework | Node.js, TypeScript, Express 5                                              |
| Database & ORM      | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)                                |
| Validation          | Zod                                                                         |
| Authentication      | Custom JWT (access + refresh), Email/Password + Google login (Google Cloud) |
| Cache & state       | Redis (response cache, token blacklist)                                     |
| Payments            | bKash (Tokenized Checkout)                                                  |
| File storage        | Multer + Cloudinary                                                         |
| Email               | Nodemailer + EJS templates                                                  |
| Scheduling          | node-cron (visit reminders)                                                 |
| PDF                 | PDFKit (invoice PDF)                                                        |
| Security            | helmet, CORS, express-rate-limit, bcryptjs                                  |
| Lint & format       | Biome                                                                       |
| API docs            | Postman collection (`Field_service_management.postman_collection.json`)     |

---

## Main Features

- **Authentication:** register with email OTP verification, login, Google login, refresh token, logout (token blacklist in Redis), forgot/reset password.
- **Customer & technician profiles**, role-wise profile update, profile image upload.
- **Technician onboarding:** public application with resume/documents, email OTP, admin approve/reject.
- **Technician skills** and availability.
- **Service requests** with up to 5 attachments, priority, admin review (`PENDING -> UNDER_REVIEW -> APPROVED / REJECTED`), customer cancel.
- **Technician assignment** with available-technician search, **schedule conflict detection**, confirm, cancel, reschedule.
- **Work orders** with a strict state machine, parts used, attachments, service report and completion image.
- **Invoices & payments:** invoice built from labor hours + parts + tax, bKash payment, refund, invoice PDF.
- **Notifications** (in-app + email) and a **visit reminder** cron job.
- **Customer feedback** and **technician analytics** (admin dashboard, technician leaderboard, own stats).
- **Admin:** user management (block / unblock / soft delete), **audit logs**.
- **Soft delete** on users, customers, technicians, skills, service requests and feedback.
- **Pagination, filtering, sorting and search** on all major list endpoints.

---

## Business Workflow

```
Customer creates Service Request            (PENDING)
        |
Admin marks Under Review -> Approves        (UNDER_REVIEW -> APPROVED)  or Rejects
        |
Admin creates Assignment (technician + time slot, conflict checked)   (PENDING)
        |
Technician confirms Assignment  ->  Work Order is created             (SCHEDULED)
        |
Technician: en-route -> arrived -> start work -> complete             (TECHNICIAN_EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED)
        |
Admin verifies the Work Order                                         (VERIFIED)
        |
Admin creates Invoice -> Customer pays with bKash                     (UNPAID -> PAID)
        |
Service Request becomes COMPLETED -> Customer leaves Feedback
```

**Work order states:** `SCHEDULED`, `TECHNICIAN_EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`, `CANCELLED`. Only valid forward transitions are allowed and every change is written to the audit log.

**Payment states:** `UNPAID`, `PAID`, `FAILED`, `CANCELLED`, `REFUNDED`.

---

## Roles & Permissions

| Capability                                                       | Customer | Technician |   Admin    |
| ---------------------------------------------------------------- | :------: | :--------: | :--------: |
| Register / login / profile                                       |   Yes    |    Yes     |    Yes     |
| Create & cancel own service requests                             |   Yes    |     -      |     -      |
| Review service requests, assign technicians                      |    -     |     -      |    Yes     |
| Confirm / cancel own assignments                                 |    -     |    Yes     | Cancel any |
| Update work order (travel, start, parts, report, complete)       |    -     | Yes (own)  |     -      |
| Verify work order                                                |    -     |     -      |    Yes     |
| Create invoice, refund                                           |    -     |     -      |    Yes     |
| Pay own invoice                                                  |   Yes    |     -      |     -      |
| Give / edit own feedback                                         |   Yes    |     -      | Delete any |
| Own technician stats                                             |    -     |    Yes     |     -      |
| Dashboard, leaderboard, audit logs, user management, skills CRUD |    -     |     -      |    Yes     |

Wrong role returns `403`, missing or invalid token returns `401`.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (the `btree_gist` extension is created by a migration)
- Redis
- Accounts / keys for: Cloudinary, an SMTP provider (e.g. Gmail app password), bKash sandbox, Google OAuth client id

### Installation

```bash
git clone <your-repo-url>
cd Field-Service-Management-Backend

npm install

cp .env.example .env        # then fill in the values (see below)

npx prisma generate         # generates the client into src/generated/prisma
npx prisma migrate deploy   # applies all migrations

npm run dev                 # http://localhost:5000
```

On startup the server connects to PostgreSQL, Redis and the SMTP server, then **seeds one admin and one technician** from the `TESTER_*` variables (skipped if they already exist).

### Production build

```bash
npm run build
npm start
```

---

## Environment Variables

Copy `.env.example` to `.env`.

| Variable                                                                                  | Description                                                                                               |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`, `PORT`                                                                        | Environment and port (default `5000`)                                                                     |
| `APP_URL`, `FRONTEND_URL`                                                                 | Public API URL and frontend URL (used for CORS and the payment redirect)                                  |
| `DATABASE_URL`                                                                            | PostgreSQL connection string                                                                              |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                                 | Use two different long random strings                                                                     |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`                                         | e.g. `1d`, `7d`                                                                                           |
| `BCRYPT_SALT_ROUNDS`                                                                      | Password hashing cost                                                                                     |
| `GOOGLE_CLIENT_ID`                                                                        | Google OAuth client id (Google login)                                                                     |
| `TESTER_ADMIN_*`, `TESTER_TECHNICIAN_*`                                                   | Name, email, password of the seeded admin and technician                                                  |
| `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`                                | Redis connection                                                                                          |
| `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_SENDER`                                              | Email sending                                                                                             |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`                    | File storage                                                                                              |
| `BKASH_BASE_URL`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_APP_KEY`, `BKASH_APP_SECRET` | bKash credentials (sandbox URL is in `.env.example`)                                                      |
| `BKASH_CALLBACK_URL`                                                                      | Base URL bKash redirects to, e.g. `http://localhost:5000/api/v1` (the server appends `/payment/callback`) |
| `LABOR_RATE_PER_HOUR`, `TAX_RATE_PERCENT`                                                 | Used when calculating invoices                                                                            |

> Never commit `.env`. It is already in `.gitignore`.

---

## API Conventions

- **Base URL:** `/api/v1`
- **Auth:** `Authorization: Bearer <accessToken>` (an `accessToken` cookie is also accepted).
- **Success response**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

`meta` is present only on paginated lists.

- **Error response**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Invalid email address" }]
}
```

- **Pagination:** `?page=1&limit=10`
- **Sorting:** `?sortBy=createdAt&sortOrder=desc`
- **Search:** `?searchTerm=keyword` (users, technicians, audit logs and other lists)
- **Filtering:** list-specific, e.g. `?status=PENDING&priority=HIGH&city=Chattogram` on service requests, `?role=CUSTOMER&status=ACTIVE` on admin users.
- **Status codes:** `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict (duplicate, schedule overlap), `429` rate limit.

---

## API Endpoints

88 routes in total (87 endpoints plus one legacy alias). "Access" shows which roles can call the endpoint.

### Authentication

| Method | Endpoint                       | Access             | Description                   |
| ------ | ------------------------------ | ------------------ | ----------------------------- |
| `POST` | `/api/v1/auth/register`        | Public             | Register customer (sends OTP) |
| `POST` | `/api/v1/auth/verify-email`    | Public             | Verify email with OTP         |
| `POST` | `/api/v1/auth/login`           | Public             | Login (email + password)      |
| `GET`  | `/api/v1/auth/me`              | Any logged-in user | Get current user              |
| `POST` | `/api/v1/auth/refresh-token`   | Public             | Refresh token                 |
| `POST` | `/api/v1/auth/logout`          | Public             | Logout (blacklists tokens)    |
| `POST` | `/api/v1/auth/google`          | Public             | Login with Google             |
| `POST` | `/api/v1/auth/forgot-password` | Public             | Forgot password               |
| `POST` | `/api/v1/auth/reset-password`  | Public             | Reset password                |

### User / Profile

| Method  | Endpoint                        | Access             | Description                         |
| ------- | ------------------------------- | ------------------ | ----------------------------------- |
| `GET`   | `/api/v1/user/me`               | Any logged-in user | Get my profile                      |
| `PATCH` | `/api/v1/user/me`               | Any logged-in user | Update my profile                   |
| `PATCH` | `/api/v1/user/me/profile-image` | Any logged-in user | Upload profile image                |
| `PATCH` | `/api/v1/user/profile-image`    | Any logged-in user | Upload profile image (legacy alias) |

### Admin - Users

| Method   | Endpoint                             | Access | Description        |
| -------- | ------------------------------------ | ------ | ------------------ |
| `GET`    | `/api/v1/admin/users`                | ADMIN  | Get all users      |
| `PATCH`  | `/api/v1/admin/users/:userId/status` | ADMIN  | Update user status |
| `DELETE` | `/api/v1/admin/users/:userId`        | ADMIN  | Soft delete user   |

### Admin - Audit Logs

| Method | Endpoint                               | Access | Description          |
| ------ | -------------------------------------- | ------ | -------------------- |
| `GET`  | `/api/v1/admin/audit-logs`             | ADMIN  | Get all audit logs   |
| `GET`  | `/api/v1/admin/audit-logs/:auditLogId` | ADMIN  | Get single audit log |

### Skills

| Method   | Endpoint                  | Access | Description    |
| -------- | ------------------------- | ------ | -------------- |
| `GET`    | `/api/v1/skills`          | Public | Get all skills |
| `POST`   | `/api/v1/skills`          | ADMIN  | Create skill   |
| `PATCH`  | `/api/v1/skills/:skillId` | ADMIN  | Update skill   |
| `DELETE` | `/api/v1/skills/:skillId` | ADMIN  | Delete skill   |

### Technicians

| Method   | Endpoint                                   | Access     | Description                                        |
| -------- | ------------------------------------------ | ---------- | -------------------------------------------------- |
| `POST`   | `/api/v1/technicians/apply`                | Public     | Apply as technician (multipart: resume, documents) |
| `POST`   | `/api/v1/technicians/apply/verify-email`   | Public     | Verify technician email                            |
| `POST`   | `/api/v1/technicians/apply/resend-otp`     | Public     | Resend application otp                             |
| `GET`    | `/api/v1/technicians/my-profile`           | TECHNICIAN | Get my profile                                     |
| `PATCH`  | `/api/v1/technicians/my-profile`           | TECHNICIAN | Update my profile                                  |
| `PATCH`  | `/api/v1/technicians/my-availability`      | TECHNICIAN | Update my availability                             |
| `POST`   | `/api/v1/technicians/my-skills`            | TECHNICIAN | Add my skill                                       |
| `DELETE` | `/api/v1/technicians/my-skills/:skillId`   | TECHNICIAN | Remove my skill                                    |
| `GET`    | `/api/v1/technicians`                      | ADMIN      | Get all technicians                                |
| `GET`    | `/api/v1/technicians/:technicianId`        | ADMIN      | Get single technician                              |
| `PATCH`  | `/api/v1/technicians/:technicianId/review` | ADMIN      | Review technician                                  |

### Service Requests

| Method  | Endpoint                                                  | Access                      | Description                |
| ------- | --------------------------------------------------------- | --------------------------- | -------------------------- |
| `POST`  | `/api/v1/service-requests`                                | CUSTOMER                    | Create service request     |
| `GET`   | `/api/v1/service-requests/my-requests`                    | CUSTOMER                    | Get my service requests    |
| `PATCH` | `/api/v1/service-requests/:serviceRequestId/cancel`       | CUSTOMER                    | Cancel service request     |
| `GET`   | `/api/v1/service-requests`                                | ADMIN                       | Get all service requests   |
| `PATCH` | `/api/v1/service-requests/:serviceRequestId/under-review` | ADMIN                       | Mark under review          |
| `PATCH` | `/api/v1/service-requests/:serviceRequestId/review`       | ADMIN                       | Review service request     |
| `GET`   | `/api/v1/service-requests/:serviceRequestId`              | CUSTOMER, TECHNICIAN, ADMIN | Get single service request |

### Assignments & Scheduling

| Method  | Endpoint                                       | Access            | Description               |
| ------- | ---------------------------------------------- | ----------------- | ------------------------- |
| `GET`   | `/api/v1/assignments/my-assignments`           | TECHNICIAN        | Get my assignments        |
| `GET`   | `/api/v1/assignments/available-technicians`    | ADMIN             | Get available technicians |
| `POST`  | `/api/v1/assignments`                          | ADMIN             | Create assignment         |
| `GET`   | `/api/v1/assignments`                          | ADMIN             | Get all assignments       |
| `PATCH` | `/api/v1/assignments/:assignmentId/reschedule` | ADMIN             | Reschedule assignment     |
| `PATCH` | `/api/v1/assignments/:assignmentId/confirm`    | TECHNICIAN        | Confirm assignment        |
| `PATCH` | `/api/v1/assignments/:assignmentId/cancel`     | TECHNICIAN, ADMIN | Cancel assignment         |
| `GET`   | `/api/v1/assignments/:assignmentId`            | TECHNICIAN, ADMIN | Get single assignment     |

### Work Orders

| Method   | Endpoint                                                     | Access                      | Description                        |
| -------- | ------------------------------------------------------------ | --------------------------- | ---------------------------------- |
| `GET`    | `/api/v1/work-orders/my-work-orders`                         | TECHNICIAN                  | Get my work orders                 |
| `GET`    | `/api/v1/work-orders/service-request/:serviceRequestId`      | CUSTOMER, TECHNICIAN, ADMIN | Get work orders by service request |
| `GET`    | `/api/v1/work-orders`                                        | ADMIN                       | Get all work orders                |
| `PATCH`  | `/api/v1/work-orders/:workOrderId/en-route`                  | TECHNICIAN                  | Mark en route                      |
| `PATCH`  | `/api/v1/work-orders/:workOrderId/arrived`                   | TECHNICIAN                  | Mark arrived                       |
| `PATCH`  | `/api/v1/work-orders/:workOrderId/start`                     | TECHNICIAN                  | Start work                         |
| `PATCH`  | `/api/v1/work-orders/:workOrderId/complete`                  | TECHNICIAN                  | Complete work                      |
| `POST`   | `/api/v1/work-orders/:workOrderId/parts`                     | TECHNICIAN                  | Add part                           |
| `DELETE` | `/api/v1/work-orders/:workOrderId/parts/:partId`             | TECHNICIAN                  | Remove part                        |
| `POST`   | `/api/v1/work-orders/:workOrderId/attachments`               | TECHNICIAN                  | Add attachments                    |
| `DELETE` | `/api/v1/work-orders/:workOrderId/attachments/:attachmentId` | TECHNICIAN                  | Remove attachment                  |
| `PUT`    | `/api/v1/work-orders/:workOrderId/service-report`            | TECHNICIAN                  | Upsert service report              |
| `PATCH`  | `/api/v1/work-orders/:workOrderId/verify`                    | ADMIN                       | Verify work order                  |
| `GET`    | `/api/v1/work-orders/:workOrderId`                           | CUSTOMER, TECHNICIAN, ADMIN | Get single work order              |

### Payments & Invoices

| Method  | Endpoint                                     | Access          | Description                         |
| ------- | -------------------------------------------- | --------------- | ----------------------------------- |
| `GET`   | `/api/v1/payment/callback`                   | Public          | bKash callback (server-side verify) |
| `GET`   | `/api/v1/payment/my-invoices`                | CUSTOMER        | Get my invoices                     |
| `POST`  | `/api/v1/payment/initiate`                   | CUSTOMER        | Initiate payment                    |
| `POST`  | `/api/v1/payment/invoices`                   | ADMIN           | Create invoice                      |
| `GET`   | `/api/v1/payment/invoices`                   | ADMIN           | Get all invoices                    |
| `PATCH` | `/api/v1/payment/invoices/:paymentId/refund` | ADMIN           | Refund payment                      |
| `GET`   | `/api/v1/payment/invoices/:paymentId/pdf`    | CUSTOMER, ADMIN | Download invoice pdf                |
| `GET`   | `/api/v1/payment/invoices/:paymentId`        | CUSTOMER, ADMIN | Get single invoice                  |

### Feedback

| Method   | Endpoint                                              | Access                      | Description                     |
| -------- | ----------------------------------------------------- | --------------------------- | ------------------------------- |
| `POST`   | `/api/v1/feedbacks`                                   | CUSTOMER                    | Create feedback                 |
| `GET`    | `/api/v1/feedbacks/my-feedbacks`                      | CUSTOMER                    | Get my feedbacks                |
| `GET`    | `/api/v1/feedbacks/technician/my-feedbacks`           | TECHNICIAN                  | Get my technician feedbacks     |
| `GET`    | `/api/v1/feedbacks/technician/:technicianId`          | ADMIN                       | Get technician feedbacks        |
| `GET`    | `/api/v1/feedbacks/service-request/:serviceRequestId` | CUSTOMER, TECHNICIAN, ADMIN | Get feedback by service request |
| `GET`    | `/api/v1/feedbacks`                                   | ADMIN                       | Get all feedbacks               |
| `PATCH`  | `/api/v1/feedbacks/:feedbackId`                       | CUSTOMER                    | Update my feedback              |
| `DELETE` | `/api/v1/feedbacks/:feedbackId`                       | CUSTOMER, ADMIN             | Delete feedback                 |

### Notifications

| Method   | Endpoint                                     | Access             | Description              |
| -------- | -------------------------------------------- | ------------------ | ------------------------ |
| `GET`    | `/api/v1/notifications`                      | Any logged-in user | Get my notifications     |
| `GET`    | `/api/v1/notifications/unread-count`         | Any logged-in user | Get unread count         |
| `PATCH`  | `/api/v1/notifications/read-all`             | Any logged-in user | Mark all as read         |
| `DELETE` | `/api/v1/notifications/clear-read`           | Any logged-in user | Clear read notifications |
| `PATCH`  | `/api/v1/notifications/:notificationId/read` | Any logged-in user | Mark as read             |
| `DELETE` | `/api/v1/notifications/:notificationId`      | Any logged-in user | Delete notification      |

### Analytics

| Method | Endpoint                                      | Access     | Description                 |
| ------ | --------------------------------------------- | ---------- | --------------------------- |
| `GET`  | `/api/v1/analytics/dashboard`                 | ADMIN      | Get dashboard stats         |
| `GET`  | `/api/v1/analytics/technicians`               | ADMIN      | Get technician leaderboard  |
| `GET`  | `/api/v1/analytics/technicians/me`            | TECHNICIAN | Get my stats                |
| `GET`  | `/api/v1/analytics/technicians/:technicianId` | ADMIN      | Get single technician stats |

---

## Payment Flow (bKash)

Only real gateway payments are supported (no cash, no manual "mark as paid").

1. **Admin** creates the invoice: `POST /api/v1/payment/invoices` (labor hours x `LABOR_RATE_PER_HOUR` + parts - discount, then tax).
2. **Customer** starts payment: `POST /api/v1/payment/initiate`. The server creates a bKash payment and returns a `bkashURL`.
3. The customer completes the payment on the bKash page.
4. bKash redirects the browser to `GET /api/v1/payment/callback?paymentID=...&status=...`.
5. The server calls bKash **execute** and checks the status code, the amount, the currency and the invoice number. Only then is the payment marked `PAID`; otherwise it becomes `FAILED` or `CANCELLED`.
6. The payment update, the service request update (`COMPLETED`) and the audit log are written in **one database transaction**. A repeated callback is safe (idempotent).
7. The browser is finally redirected to `FRONTEND_URL/dashboard/payments?status=success|failure|cancel`.

Track a payment with `GET /api/v1/payment/invoices/:paymentId`. Admin can refund a paid invoice with `PATCH /api/v1/payment/invoices/:paymentId/refund`.

---

## Concurrency & Data Safety

- **Double-booking prevention:** a PostgreSQL exclusion constraint (`no_technician_overlap`, `gist` + `tsrange`) makes it impossible for one technician to have two overlapping `PENDING`/`CONFIRMED` assignments, even under concurrent requests. A partial unique index also allows only one active assignment per service request.
- **Database transactions** (`prisma.$transaction`) wrap multi-step operations: assignment, work order state changes, invoice/payment updates, user management and profile updates.
- **Idempotent payment callback:** the `status != PAID` guard in the update ensures only one request can win.
- **Indexes** on frequently filtered columns (role/status, entity/actor/action/date for audit logs, payment status, soft-delete flags).
- **Redis caching** for read-heavy data (skills, analytics) with automatic invalidation; the API keeps working if Redis is down.
- **Soft deletes** (`isDeleted` / `deletedAt`) instead of removing rows.
- **Audit logs** record who did what (actor, role, old/new value) for status changes, assignments, payments, refunds, skills, feedback deletion and user management. System actions such as the bKash callback are logged with no actor.

---

## Security

- Passwords hashed with bcrypt; secrets only in environment variables.
- JWT access + refresh tokens; logout blacklists both tokens in Redis until they expire.
- Blocked or deleted users are rejected on every request.
- Role-based middleware on every private route.
- `helmet` security headers and CORS restricted to `FRONTEND_URL`.
- Rate limiting: 100 requests / 15 min on all `/api/v1` routes and 10 requests / 15 min on `/api/v1/auth`.
- Zod validation on request bodies; role-wise strict profile schemas reject unknown fields (e.g. `role`, `status`).
- File uploads limited by size and MIME type.

---

## Testing the API with Postman

1. Import `Field_service_management.postman_collection.json`.
2. Open the collection **Variables** tab. Set `baseUrl` (default `http://localhost:5000/api/v1`) and the passwords from your `.env`.
3. Run the three requests in **0. Login** (customer, technician, admin). Tokens are saved automatically and every request uses the token of its own role.
4. Follow the happy path described in the collection description. IDs (`serviceRequestId`, `assignmentId`, `workOrderId`, `paymentId`, ...) are saved by test scripts.

The collection covers every endpoint in this README (except the legacy `/user/profile-image` alias), grouped in 14 folders (Login, Auth, User, Skills, Technicians, Service Requests, Assignments, Work Orders, Payments & Invoices, Feedback, Notifications, Analytics, Admin - Users, Admin - Audit Logs).

> Customer registration and technician application send an OTP by email, so use an email address you can open. For bKash, open the returned `bkashURL` in a browser and use the sandbox test wallet.

---

## Scripts

| Script                                | Description                  |
| ------------------------------------- | ---------------------------- |
| `npm run dev`                         | Start in watch mode (tsx)    |
| `npm run build`                       | Compile TypeScript to `dist` |
| `npm start`                           | Run the compiled server      |
| `npm run lint:check` / `lint:fix`     | Biome lint                   |
| `npm run format:check` / `format:fix` | Biome format                 |
| `npx prisma migrate deploy`           | Apply migrations             |
| `npx prisma generate`                 | Generate the Prisma client   |

---

## Project Structure

```
prisma/
  schema/            # split Prisma schema (user, work_order, payment, audit_log, ...)
  migrations/
src/
  app.ts             # express app, middleware, route mounting
  server.ts          # startup: DB, Redis, SMTP, seed, cron
  app/
    config/          # env config
    jobs/            # visit reminder cron job
    lib/             # prisma, redis, cache, bkash, cloudinary, multer, nodemailer, token blacklist
    middleware/      # auth + roles, validation, rate limiter, error handler, 404
    module/          # auth, user, admin-user, audit-log, skill, technician, service-request,
                     # assignment, work-order, payment, feedback, notification, analytics
    templates/       # EJS email templates
    utils/           # AppError, catchAsync, sendResponse, jwt, seed
```

Each module follows the same layout: `route -> validation -> controller -> service`.
