// Expense Tracker - backend (Express API + PostgreSQL)
//
// PHASE 1
// Setup:
//   1. Create a database named expense_tracker and run schema.sql on it.
//   2. Copy .env.example to a new file named .env and write your PostgreSQL password.
//   3. npm install express cors pg dotenv
// Run:    node server.js   (restart it every time you change this file)
//
// Endpoints you need to build:
//   GET    /api/expenses        return all expenses
//   GET    /api/expenses/:id    return one expense (404 if not found)
//   POST   /api/expenses        add an expense (201, or 400 if the data is invalid)
//   PUT    /api/expenses/:id    update an expense (200, 400, or 404)
//   DELETE /api/expenses/:id    delete an expense (200, or 404)
//
// Tips:
//   - Create one Pool (from the "pg" library) with the values from .env,
//     and use pool.query(...) in every route.
//   - ALWAYS send the values as parameters: pool.query("... WHERE id = $1", [id]).
//     NEVER build the SQL text by joining strings with data from the user.
//   - Use RETURNING to get the new (or updated) row back from INSERT and UPDATE.
//   - The database creates the id. The client never sends one.
//   - pg returns NUMERIC as text and DATE as a JavaScript Date, so fix both in your SELECT.
//     Hint: amount::float8 and to_char(date, 'YYYY-MM-DD').
//   - Validate the data before the query, and answer 400 with a message that explains the problem.
//   - Check the id before the query. A text like "abc" makes PostgreSQL throw an error.
//   - Enable CORS so the frontend can talk to the server.
//   - Test every endpoint with Thunder Client BEFORE you connect the frontend.

//                                    server configration area

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const app = express();
app.use(cors());
app.use(express.json());

const portNumber = 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

//////////////////////////////////////////////////////////////////////////////////////////////////

//                                      validation area

const categories = ["Food", "Transport", "Bills", "Entertainment", "Other"];

function validateId(rawId) {
  if (!/^\d+$/.test(rawId)) {
    return "Invalid expense ID.";
  }

  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    return "Invalid expense ID.";
  }
  return null;
}

function validateTitle(title) {
  if (title === undefined || title === null) {
    return "Title is required.";
  }

  if (typeof title !== "string") {
    return "Title must be a string.";
  }

  const cleanTitle = title.trim();

  if (cleanTitle.length === 0) {
    return "Title is required.";
  }

  return null;
}

function validateAmount(amount) {
  if (amount === undefined || amount === null) {
    return "Amount is required.";
  }

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000
  ) {
    return "Amount must be a positive number and less than 1,000,000.";
  }

  return null;
}

function validateCategory(category) {
  if (category === undefined || category === null || category === "") {
    return "Category is required.";
  }

  if (!categories.includes(category)) {
    return "Category must be Food, Transport, Bills, Entertainment, or Other.";
  }

  return null;
}

function validateDate(date) {
  if (date === undefined || date === null || date === "") {
    return "Date is required.";
  }

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "Date must be a valid date in YYYY-MM-DD format.";
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return "Date must be a valid date in YYYY-MM-DD format.";
  }

  return null;
}

function validateExpense(body) {
  const { title, amount, category, date } = body ?? {};

  return (
    validateTitle(title) ||
    validateAmount(amount) ||
    validateCategory(category) ||
    validateDate(date)
  );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////

//                                            endpoints area

app.get("/api/expenses", async (request, response) => {
  try {
    const sql = `SELECT
                        id,
                        title,
                        amount::float8 AS amount,
                        category,
                        to_char(date, 'YYYY-MM-DD') AS date
                    FROM expenses
                    ORDER BY id;`;

    const expenses = await pool.query(sql);
    response.status(200).json(expenses.rows);
  } catch (error) {
    response
      .status(500)
      .json({ message: "Could not load expenses due to server error." });
  }
});

app.get("/api/expenses/:id", async (request, response) => {
  const idError = validateId(request.params.id);
  if (idError) {
    return response.status(404).json({ message: idError });
  }
  const expenseId = Number(request.params.id);

  try {
    const sql = `SELECT
                        id,
                        title,
                        amount::float8 AS amount,
                        category,
                        to_char(date, 'YYYY-MM-DD') AS date
                        FROM expenses
                        WHERE id = $1;`;

    const expense = await pool.query(sql, [expenseId]);
    if (expense.rows.length === 0) {
      return response
        .status(404)
        .json({ message: `There is no expense with ID: ${expenseId}` });
    }
    response.status(200).json(expense.rows[0]);
  } catch (error) {
    response
      .status(500)
      .json({
        message: `Could not load expense with ID: ${expenseId} due to server error.`,
      });
  }
});

app.post("/api/expenses", async (request, response) => {
  try {
    const validationError = validateExpense(request.body);
    if (validationError) {
      return response.status(400).json({ message: validationError });
    }

    const { title, amount, category, date } = request.body ?? {};
    const cleanTitle = title.trim();

    const sql = `
                INSERT INTO expenses (title, amount, category, date)
                VALUES ($1, $2, $3, $4)
                RETURNING id, title, amount::float8 AS amount,
                          category, to_char(date, 'YYYY-MM-DD') AS date;`;

    const newExpenseValues = [cleanTitle, amount, category, date];

    const newExpense = await pool.query(sql, newExpenseValues);

    response.status(201).json(newExpense.rows[0]);
  } catch (error) {
    response
      .status(500)
      .json({ message: "Can not add the expense due to server error." });
  }
});

app.put("/api/expenses/:id", async (request, response) => {
  try {
    const idError = validateId(request.params.id);
    if (idError) {
      return response.status(404).json({ message: idError });
    }
    const expenseId = Number(request.params.id);

    const validationError = validateExpense(request.body);
    if (validationError) {
      return response.status(400).json({ message: validationError });
    }

    const { title, amount, category, date } = request.body ?? {};
    const cleanTitle = title.trim();

    const sql = `
                    UPDATE expenses
                    SET 
                        title = $2,
                        amount = $3,
                        category = $4,
                        date = $5
                    WHERE id = $1
                    RETURNING id, title,
                    amount::float8 AS amount,
                    category, to_char(date, 'YYYY-MM-DD') AS date;`;

    const updatedExpenseValues = [
      expenseId,
      cleanTitle,
      amount,
      category,
      date,
    ];

    const updatedExpense = await pool.query(sql, updatedExpenseValues);
    if (updatedExpense.rows.length === 0) {
      return response
        .status(404)
        .json({ message: `There is no expense with ID: ${expenseId}` });
    }

    response.status(200).json(updatedExpense.rows[0]);
  } catch (error) {
    response
      .status(500)
      .json({ message: "Can not update the expense due to server error." });
  }
});

app.delete("/api/expenses/:id", async (request, response) => {
  try {
    const idError = validateId(request.params.id);
    if (idError) {
      return response.status(404).json({ message: idError });
    }
    const expenseId = Number(request.params.id);

    const sql = `
                    DELETE FROM expenses WHERE id = $1 RETURNING id, title;`;

    const deletedExpense = await pool.query(sql, [expenseId]);
    if (deletedExpense.rows.length === 0) {
      return response
        .status(404)
        .json({ message: `There is no expense with ID: ${expenseId}` });
    }
    response
      .status(200)
      .json({
        message: "Expense deleted.",
        title: deletedExpense.rows[0].title,
        id: deletedExpense.rows[0].id,
      });
  } catch (error) {
    response
      .status(500)
      .json({ message: "Can not delete expense due to server error." });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////

//                                          server running area

app.listen(portNumber);
