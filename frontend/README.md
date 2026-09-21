E-Audit System

###Teknologi yang Digunakan

*Frontend

1. Framework: Next.js v14 (App Router)
2. Bahasa: TypeScript
3. Styling: Tailwind CSS
4. Ikon: Lucide React
5. State Management: Zustand (dengan persistensi localStorage)

*Backend
1. Bahasa: Golang (Go)
2. Framework: Gin Web Framework
3. Database Driver: pgx (PostgreSQL Driver and Toolkit)
4. Excel Parser: excelize (untuk upload massal item checklist)
5. Authentication: JWT (JSON Web Token)

*Database
1. RDBMS: PostgreSQL

###Prasyarat

Sebelum memulai, pastikan Anda telah menginstal:
1. Node.js (v18+ direkomendasikan)
2. Yarn (Package Manager untuk Frontend)
3. Go (versi terbaru)
4. Setup Database (PostgreSQL)
5. Setup Backend (Golang)
    1. Masuk ke folder e-audit-backend.
    2. Buat file .env berdasarkan contoh berikut:
        DB_HOST=localhost
        bDB_USER=postgres
        DB_PASSWORD=internB7
        DB_NAME=e-audiit
        DB_PORT=5432
    3. Install dependencies: go mod tidy
    4. Jalankan server: go run main.go
    5. Server backend akan berjalan di http://localhost:8080.
6. Setup Frontend (Next.js)
    1. Masuk ke folder e-audit-frontend.
    2. Install dependencies (pastikan menggunakan versi stabil Next.js 14 seperti yang sudah dikonfigurasi di package.json):
    3. yarn install
    4. Jalankan server development: yarn dev
    5. Server frontend akan berjalan di http://localhost:3000.

###Struktur Folder Frontend
app
    (authenticated)
    login
    global.css
    layout.tsx
    page.tsx
components
    AuditPdfDocument.tsx
public
store
    authStore.ts
types
    audit.ts
utils
    api.ts
    statusHelper.ts

Catatan Pengembang

Turbopack: Proyek ini saat ini dikonfigurasi untuk menggunakan Webpack (default Next.js 14) karena isu kompatibilitas sementara dengan Turbopack dan Tailwind v3 di environment pengembangan tertentu.