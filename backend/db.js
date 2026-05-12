import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'users.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('CRITICAL: Error connecting to SQLite database:', err);
    process.exit(1); // Exit if DB connection fails
  } else {
    console.log('Successfully connected to SQLite database at:', dbPath);
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password_hash TEXT
      )`, 
      (err) => {
        if (err) {
          console.error('Error creating users table', err);
        }
      }
    );
  }
});

export default db;
