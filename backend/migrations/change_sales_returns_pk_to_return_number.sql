-- Change Sales Returns primary key from sales_return_id to (return_number, branch_id)
-- This allows same sales_return_id across different branches without conflicts

BEGIN;

-- Step 1: Drop foreign key constraints from sales_return_items
ALTER TABLE sales_return_items DROP CONSTRAINT IF EXISTS sales_return_items_sales_return_id_fkey;

-- Step 2: Drop existing unique constraints
ALTER TABLE sales_returns DROP CONSTRAINT IF EXISTS sales_returns_sales_return_id_key;

-- Step 3: Remove duplicate items (keep only the latest one per return_number, branch_id)
DELETE FROM sales_return_items
WHERE id NOT IN (
  SELECT MAX(id)
  FROM sales_return_items
  GROUP BY sales_return_id, branch_id
);

-- Step 4: Add return_number to sales_return_items if not exists
ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS return_number VARCHAR(50);

-- Step 5: Populate return_number in sales_return_items from sales_returns
UPDATE sales_return_items sri
SET return_number = sr.return_number
FROM sales_returns sr
WHERE sri.sales_return_id = sr.sales_return_id AND sri.branch_id = sr.branch_id;

-- Step 6: Create composite unique constraint on (return_number, branch_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sales_returns_return_number_branch_id_key'
  ) THEN
    ALTER TABLE sales_returns ADD CONSTRAINT sales_returns_return_number_branch_id_key UNIQUE (return_number, branch_id);
  END IF;
END $$;

-- Step 7: Add composite unique constraint for items on (return_number, branch_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sales_return_items_return_number_branch_id_key'
  ) THEN
    ALTER TABLE sales_return_items ADD CONSTRAINT sales_return_items_return_number_branch_id_key UNIQUE (return_number, branch_id);
  END IF;
END $$;

-- Step 8: Add new composite foreign key using return_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sales_return_items_return_number_branch_id_fkey'
  ) THEN
    ALTER TABLE sales_return_items 
    ADD CONSTRAINT sales_return_items_return_number_branch_id_fkey 
    FOREIGN KEY (return_number, branch_id) REFERENCES sales_returns(return_number, branch_id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
