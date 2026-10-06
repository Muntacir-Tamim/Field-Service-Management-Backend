CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "assignments"
  ADD CONSTRAINT "no_technician_overlap"
  EXCLUDE USING gist (
    "technicianId" WITH =,
    tsrange("scheduledStart", "scheduledEnd", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));

CREATE UNIQUE INDEX "one_active_assignment_per_request"
  ON "assignments" ("serviceRequestId")
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));