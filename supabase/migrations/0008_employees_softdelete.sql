-- 0008_employees_softdelete.sql
-- Adds soft-delete support to employees.
--
-- Rationale: employees with contracts cannot be hard-deleted (FK RESTRICT on
-- contracts.employee_id). deactivated_at is a legitimate business state
-- ("employee left the company"), not a mechanism to hide bad data.
-- Mirrors the same pattern used by drivers and vehicles.

ALTER TABLE employees ADD COLUMN deactivated_at timestamptz;

-- Index for the hot path: listing active employees (WHERE deactivated_at IS NULL)
CREATE INDEX idx_employees_active
  ON employees (full_name)
  WHERE deactivated_at IS NULL;
