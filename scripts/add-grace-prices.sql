-- Add Grace Price Conversion data for Online Workshop 2H variants
-- Execute this SQL in your SQLite database

INSERT OR REPLACE INTO grace_price_conversion (event_type, event_type_key, venue, jpy_price, eur_price, created_at, updated_at) 
VALUES 
  ('Online Workshop 2H - Trouper', 'Salsation-Workshops-Troupe-Online', 'Online', 4.617, 27, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Online Workshop 2H - Early Bird', 'Salsation-Workshops-Early Bird-Online', 'Online', 5.130, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Online Workshop 2H - Regular', 'Salsation-Workshops-Regular-Online', 'Online', 5.632, 33, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Online Workshop 2H - Rush', 'Salsation-Workshops-Rush-Online', 'Online', 5.983, 35, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
