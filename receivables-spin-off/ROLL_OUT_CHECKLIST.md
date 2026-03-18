# ReceivablesSpinOff Cutover Checklist

## Before cutover
1. Ensure `SOURCE_DATABASE_URL` points to the original app DB and `DATABASE_URL` points to the spin-off DB.
2. Deploy the spin-off service with all required API routes and cron jobs enabled.
3. Verify the cron schedules match the intended cutover timing (especially `recurring` notifications, `compensation-calculate`, and `fringe-benefits`).

## Data migration & validation
1. Run the one-time subset migration: `npm run data:migrate` (from `receivables-spin-off/`).
2. Run reconciliation tooling:
   - `npx tsx scripts/reconcile-receivables-subset.ts`
   - Review `reconciliation-report.json` for count/totals deltas.
3. Spot-check UI flows:
   - Outstanding invoice alert logic (PAID/CANCELLED/WRITTEN_OFF not shown).
   - Manual recurring invoice draft issuance.
   - Benefit occurrences list + “Pay” action (ledger balance changes).

## Cutover procedure (recommended)
1. Pause/disable the original app’s cron jobs that would otherwise create conflicting accounting/ledger changes.
2. Run a final migration/re-sync if you have ongoing writes between the initial migration and cutover.
3. Run reconciliation again and confirm deltas are within acceptable tolerance.
4. Switch operations to the spin-off:
   - Staff uses the spin-off UI for manual recurring invoice drafts and benefit payouts.
   - Cron continues to materialize new benefit occurrences and calculate monthly compensation.

