# RetailFlow POS Enterprise

Enhanced portfolio-grade POS with hardware and operational capabilities.

## Added capabilities

- Network ESC/POS receipt printer integration over TCP port 9100
- Browser PDF receipt fallback
- Barcode scanner diagnostics for USB keyboard-wedge scanners
- Multi-branch database architecture
- Branch-level inventory and sales
- Audit logging
- Partial and full returns
- Cash refund workflow
- Automatic stock restoration on return
- PostgreSQL backup and restore scripts
- PWA shell caching
- Offline sales queue with duplicate-safe synchronization

## Run

```bash
docker compose up --build
```

Open http://localhost:5173

Admin:
- admin@demo.com
- admin123

Cashier:
- cashier@demo.com
- cashier123

## Receipt printer

The backend supports network thermal printers using ESC/POS over raw TCP, commonly port 9100.

1. Assign the printer a static LAN IP.
2. Login as admin.
3. Open Settings.
4. Enter the printer IP and port.
5. Enable it.
6. Send a test print.

For USB-only printers, use the browser PDF receipt and the operating system print dialog, or expose the printer through a local print bridge. Direct USB access varies by browser and printer driver.

## Barcode scanner

Most USB barcode scanners behave like keyboards.

1. Configure the scanner suffix as Enter.
2. Open Scanner Test.
3. Scan known product barcodes.
4. Confirm capture speed and product matching.
5. Test repeated scans, damaged labels, and rapid consecutive scans.

## Backups

Linux/macOS:

```bash
chmod +x scripts/backup.sh scripts/restore.sh
./scripts/backup.sh
./scripts/restore.sh backups/pos_YYYYMMDD_HHMMSS.dump
```

Windows PowerShell:

```powershell
./scripts/backup.ps1
```

Schedule daily backups using cron, Windows Task Scheduler, or a server scheduler. Copy backups to encrypted off-site storage.

## Offline operation

The frontend caches its application shell and stores failed sales locally. Use **Sync offline sales** after connectivity returns. Each offline transaction has a unique reference, so retrying does not create duplicate sales.

This is suitable for a portfolio demonstration. A production offline-first system should also use IndexedDB, conflict rules, encrypted local data, background synchronization, and branch-specific stock reconciliation.
