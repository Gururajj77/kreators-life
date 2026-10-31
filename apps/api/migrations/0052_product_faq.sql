-- A creator can answer the questions buyers ask most, on the product's own page: up to six short questions and answers.
ALTER TABLE products ADD COLUMN faq_json TEXT NOT NULL DEFAULT '[]';
