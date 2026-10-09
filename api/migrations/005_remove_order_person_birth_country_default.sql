-- Do not infer a person's birth country from the order/account country.
-- Existing values are preserved; only future omitted values stop defaulting to Fiji.
ALTER TABLE `order_persons`
  MODIFY COLUMN `country` VARCHAR(100) NOT NULL;
