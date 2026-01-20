/*
  # Fix Unit Availability Status Validation
  
  Adds database constraints to enforce unit availability rules:
  - If status is occupied, showable must be false
  - If status is vacant/make-ready/reserved, available_date should exist (or be set to today)
*/

-- Add constraint: occupied units must have showable=false
ALTER TABLE core_units
  ADD CONSTRAINT check_occupied_not_showable 
  CHECK (
    (status = 'occupied' AND showable = false) OR
    (status != 'occupied')
  );

-- Add constraint: vacant/make-ready/reserved units should have available_date
-- Note: We allow NULL for flexibility, but application should set it
-- This constraint is informational - we'll enforce in application layer

-- Create function to auto-fix invalid combinations
CREATE OR REPLACE FUNCTION fix_unit_availability()
RETURNS TABLE (
  unit_id uuid,
  issue text,
  fixed boolean
) AS $$
BEGIN
  -- Fix occupied units with showable=true
  UPDATE core_units
  SET showable = false
  WHERE status = 'occupied' AND showable = true;
  
  -- Fix vacant/make-ready/reserved units without available_date
  UPDATE core_units
  SET available_date = CURRENT_DATE
  WHERE status IN ('vacant', 'make-ready', 'reserved')
    AND available_date IS NULL;
  
  RETURN QUERY
  SELECT 
    id as unit_id,
    CASE 
      WHEN status = 'occupied' AND showable = true THEN 'Occupied unit was showable'
      WHEN status IN ('vacant', 'make-ready', 'reserved') AND available_date IS NULL THEN 'Vacant/ready unit missing available_date'
      ELSE 'No issue'
    END as issue,
    true as fixed
  FROM core_units
  WHERE (status = 'occupied' AND showable = true)
     OR (status IN ('vacant', 'make-ready', 'reserved') AND available_date IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



