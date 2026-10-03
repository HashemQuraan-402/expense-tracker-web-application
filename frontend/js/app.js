// Expense Tracker - frontend logic

// PHASE 2
// Your backend from Phase 1 is already running, with real expenses in the
// database (from schema.sql). Build this page directly against it with
// fetch and async/await - there is no in-memory or localStorage stage
// this time, and no sample data file.
//
// A possible structure (change it if you have a better idea):
//   - async function getExpenses()          fetch(API_URL), return the JSON
//   - async function addExpense(data)       fetch(API_URL, { method: "POST", ... })
//   - async function updateExpense(id,data) fetch(API_URL + "/" + id, { method: "PUT", ... })
//   - async function deleteExpense(id)      fetch(API_URL + "/" + id, { method: "DELETE" })
//   - async function refresh()              get the list, then call renderTable and renderSummary
//   - renderTable(list)                     build the table rows from the array the API returned
//   - renderSummary(list)                   update the summary cards
//   - applyFilter()                         re-render with the list filtered by category
//
// Don't forget:
//   - Show a Bootstrap spinner while a request is in flight.
//   - Wrap every fetch call in try/catch, and show a Bootstrap alert on failure.
//   - After add, edit, or delete, call refresh() so the page always shows
//     what the server actually saved - never update the table by hand.
//   - The API is at http://localhost:3000/api/expenses (see the Roadmap).

const API_URL = "http://localhost:3000/api/expenses";
// this is the list of expenses that is fetched from the server and used to render the table and summary
let expensesList;

const form = document.querySelector("#add-expense-from");
const titleInput = document.querySelector("#title");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");

// table filters
const categoryFilterSelect = document.querySelector("#category-select");
const allowedCategories = [
  "Food",
  "Transport",
  "Bills",
  "Entertainment",
  "Other",
];

const searchInput = document.querySelector("#search-input");
const monthFilter = document.querySelector("#month-filter");
const clearFiltersBtn = document.querySelector("#clear-filters-btn");

// order by table head
let sortKey = "id"; // "id" = same order as the server
let sortDirection = "asc";
const sortHeaders = document.querySelectorAll("th[data-sort]");

// csv button
const exportCsvBtn = document.querySelector("#export-csv-btn");
const csvErrorAlert = document.querySelector("#csv-error");

// toggle dark mode button
const themeToggle = document.querySelector("#theme-toggle");

// date from user dvice
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, "0");
const day = String(today.getDate()).padStart(2, "0");
dateInput.value = `${year}-${month}-${day}`;

// to see if the form submitted or not
let hasSubmitted = false;

// delete confirmation modal
const deleteConfirmationModal = new bootstrap.Modal(
  document.querySelector("#delete-confirmation-modal"),
);
const deleteConfirmationModalBody = document.querySelector(
  "#delete-confirmation-modal-body",
);
const deleteConfirmationModalConfirmBtn = document.querySelector(
  "#delete-confirmation-modal-confirm-btn",
);
let expenseIdToDelete = null;
const deleteExpensesError = document.querySelector("#delete-expenses-error");

// toast for success messages
const successToast = new bootstrap.Toast(
  document.querySelector("#success-toast"),
  { delay: 3000 },
);
const successToastBody = document.querySelector("#success-toast .toast-body");

// edit expense modal
const editExpenseModal = new bootstrap.Modal(
  document.querySelector("#edit-expense-modal"),
);
const editExpenseForm = document.querySelector("#edit-expense-form");
const editExpenseModalSaveBtn = document.querySelector(
  "#edit-expense-modal-save-btn",
);
const editErrorAlert = document.querySelector("#edit-error");

const editTitleInput = document.querySelector("#edit-title");
const editAmountInput = document.querySelector("#edit-amount");
const editCategoryInput = document.querySelector("#edit-category");
const editDateInput = document.querySelector("#edit-date");
let expenseIdToEdit = null;

// helper functions for spinner
const formBtn = document.querySelector("#form-btn");

// Turns a button into a "loading" button, or restores it
function setButtonLoading(button, isLoading, loadingText = "Loading...") {
  if (isLoading) {
    if (button.dataset.originalText === undefined) {
      button.dataset.originalText = button.textContent;
    }
    button.disabled = true;

    const spinner = document.createElement("span");
    spinner.className = "spinner-border spinner-border-sm me-2";
    spinner.setAttribute("aria-hidden", "true");

    button.replaceChildren(spinner, loadingText);
  } else {
    button.disabled = false;
    if (button.dataset.originalText !== undefined) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

// Puts one row with a message or spinner in the table
function showTableMessage(text) {
  const tbody = document.querySelector("#expenses-table tbody");
  tbody.replaceChildren();
  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = "text-center py-4 text-secondary";
  td.textContent = text;
  row.appendChild(td);
  tbody.appendChild(row);
}

function showTableSpinner() {
  const tbody = document.querySelector("#expenses-table tbody");
  tbody.replaceChildren();
  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = "text-center py-4";
  const spinner = document.createElement("div");
  spinner.className = "spinner-border text-primary";
  spinner.setAttribute("role", "status");

  const label = document.createElement("span");
  label.className = "visually-hidden";
  label.textContent = "Loading expenses...";

  spinner.appendChild(label);
  td.appendChild(spinner);
  row.appendChild(td);
  tbody.appendChild(row);
}

for (const input of [titleInput, amountInput, categoryInput, dateInput]) {
  input.addEventListener("input", () => {
    if (hasSubmitted)
      validateForm(titleInput, amountInput, categoryInput, dateInput);
  });
  input.addEventListener("change", () => {
    if (hasSubmitted)
      validateForm(titleInput, amountInput, categoryInput, dateInput);
  });
}

for (const input of [
  editTitleInput,
  editAmountInput,
  editCategoryInput,
  editDateInput,
]) {
  input.addEventListener("input", () => {
    validateForm(
      editTitleInput,
      editAmountInput,
      editCategoryInput,
      editDateInput,
    );
  });
  input.addEventListener("change", () => {
    validateForm(
      editTitleInput,
      editAmountInput,
      editCategoryInput,
      editDateInput,
    );
  });
}

async function getExpenses() {
  let response;
  try {
    response = await fetch(API_URL);
  } catch (error) {
    throw new Error(
      "Failed to get expenses due to server connection error. Check the connection with the server.",
    );
  }

  try {
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function refresh() {
  const errorAlert = document.querySelector("#expenses-error");

  showTableSpinner();

  try {
    expensesList = await getExpenses();
  } catch (error) {
    errorAlert.textContent = error.message;
    errorAlert.classList.remove("d-none");
    showTableMessage("Could not load expenses.");
    return;
  }

  errorAlert.classList.add("d-none");
  applyFilter();
  renderSummary(expensesList);
}

function renderTable(expensesList) {
  const tbody = document.querySelector("tbody");
  tbody.replaceChildren();

  if (expensesList.length === 0) {
    showTableMessage("No expenses found.");
    return;
  }

  for (const expense of expensesList) {
    const row = document.createElement("tr");
    row.className = "align-middle";

    const titleTd = document.createElement("td");
    titleTd.className = "text-break";
    titleTd.textContent = expense.title;
    row.appendChild(titleTd);

    const amountTd = document.createElement("td");
    amountTd.className = "text-end text-nowrap";
    amountTd.textContent = expense.amount.toFixed(2);
    row.appendChild(amountTd);

    const categoryTd = document.createElement("td");
    const categoryspan = document.createElement("span");
    categoryspan.textContent = expense.category;
    switch (expense.category) {
      case "Food":
        categoryspan.className = "badge bg-success";
        break;
      case "Transport":
        categoryspan.className = "badge bg-primary";
        break;
      case "Bills":
        categoryspan.className = "badge bg-warning text-dark";
        break;
      case "Entertainment":
        categoryspan.className = "badge bg-info text-dark";
        break;
      case "Other":
        categoryspan.className = "badge bg-secondary";
        break;
    }
    categoryTd.appendChild(categoryspan);
    row.appendChild(categoryTd);

    const dateTd = document.createElement("td");
    dateTd.className = "text-nowrap";
    dateTd.textContent = expense.date;
    row.appendChild(dateTd);

    const actionTd = document.createElement("td");
    actionTd.className = "text-end";
    const actionTdDiv = document.createElement("div");
    actionTdDiv.className = "d-flex justify-content-end gap-1";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-outline-secondary btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => {
      expenseIdToEdit = expense.id;
      editTitleInput.value = expense.title;
      editAmountInput.value = expense.amount.toFixed(2);
      editCategoryInput.value = expense.category;
      editDateInput.value = expense.date;
      for (const input of [
        editTitleInput,
        editAmountInput,
        editCategoryInput,
        editDateInput,
      ]) {
        input.classList.remove("is-invalid");
      }
      editErrorAlert.classList.add("d-none");
      editExpenseModal.show();
    });
    actionTdDiv.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-outline-danger btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      expenseIdToDelete = expense.id;
      deleteExpensesError.classList.add("d-none");
      deleteConfirmationModalBody.textContent = `Are you sure you want to delete the expense "${expense.title}"?`;
      deleteConfirmationModal.show();
    });
    actionTdDiv.appendChild(deleteBtn);

    actionTd.appendChild(actionTdDiv);
    row.appendChild(actionTd);

    tbody.appendChild(row);
  }
}

function renderSummary(expensesList) {
  // total amount of all expenses in the database
  const total_h1 = document.querySelector("#total-h1");
  let total_h1_count = 0.0;
  for (const expense of expensesList) {
    total_h1_count += expense.amount;
  }
  total_h1.textContent = total_h1_count.toFixed(2);

  // the number of all the expenses in the database
  const number_of_expenses_h1 = document.querySelector(
    "#number-of-expenses-h1",
  );
  number_of_expenses_h1.textContent = expensesList.length;

  // the highest expense amount and title from the database
  let maxExpenseAmount = 0;
  let maxExpenseTitle = "";
  const height_expense_h1 = document.querySelector("#height-expense-h1");
  const height_expense_element_p = document.querySelector(
    "#height-expense-element-p",
  );
  expensesList.forEach((e) => {
    if (e.amount >= maxExpenseAmount) {
      maxExpenseAmount = e.amount;
      maxExpenseTitle = e.title;
    }
  });
  height_expense_h1.textContent = maxExpenseAmount.toFixed(2);
  height_expense_element_p.textContent = maxExpenseTitle;
}

function validateForm(titleForm, amountForm, categoryForm, dateForm) {
  const titleValid = titleForm.value.trim() !== "";

  const amountText = amountForm.value.trim();
  const amount = Number(amountText);
  const amountValid = amountText != "" && Number.isFinite(amount) && amount > 0;

  const categoryValid = allowedCategories.includes(categoryForm.value);

  const dateValue = dateForm.value;
  const selectedYear = new Date(dateValue).getFullYear();
  const dateValid =
    dateForm.value != "" && dateForm.validity.valid && selectedYear <= 9999;

  titleForm.classList.toggle("is-invalid", !titleValid);
  amountForm.classList.toggle("is-invalid", !amountValid);
  categoryForm.classList.toggle("is-invalid", !categoryValid);
  dateForm.classList.toggle("is-invalid", !dateValid);

  return titleValid && amountValid && categoryValid && dateValid;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  hasSubmitted = true;

  if (!validateForm(titleInput, amountInput, categoryInput, dateInput)) return;

  const newExpense = {
    title: titleInput.value.trim(),
    amount: Number(amountInput.value.trim()),
    category: categoryInput.value,
    date: dateInput.value,
  };

  addExpense(newExpense);
});

async function addExpense(data) {
  const errorAlert = document.querySelector("#add-error");
  errorAlert.classList.add("d-none");
  setButtonLoading(formBtn, true, "Adding...");
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.status != 201) {
      const errorData = await response.json();
      throw new Error(`Failed to add expense. ${errorData.message}`);
    }

    form.reset();
    dateInput.value = `${year}-${month}-${day}`;
    hasSubmitted = false;
    const newExpense = await response.json();
    await refresh();

    successToastBody.textContent = `Expense "${newExpense.title}" added successfully!`;
    successToast.show();
  } catch (error) {
    if (error.message === "Failed to fetch") {
      errorAlert.textContent =
        "Failed to add expense due to server connection error. Check the connection with the server.";
    } else {
      errorAlert.textContent = error.message;
    }
    errorAlert.classList.remove("d-none");
  } finally {
    setButtonLoading(formBtn, false);
  }
}

deleteConfirmationModalConfirmBtn.addEventListener("click", async () => {
  if (expenseIdToDelete === null) return;

  setButtonLoading(deleteConfirmationModalConfirmBtn, true, "Deleting...");
  const ok = await deleteExpense(expenseIdToDelete);
  setButtonLoading(deleteConfirmationModalConfirmBtn, false);

  if (ok) {
    expenseIdToDelete = null;
    deleteConfirmationModalBody.textContent = "";
    deleteConfirmationModal.hide();
  }
});

async function deleteExpense(id) {
  const errorAlert = deleteExpensesError;
  errorAlert.classList.add("d-none");
  let response;
  try {
    response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to delete expense. ${errorData.message}`);
    }

    const deletedExpense = await response.json();
    await refresh();
    successToastBody.textContent = `Expense "${deletedExpense.title}" deleted successfully!`;
    successToast.show();
    return true;
  } catch (error) {
    if (error.message === "Failed to fetch") {
      errorAlert.textContent =
        "Failed to delete expense due to server connection error. Check the connection with the server.";
    } else {
      errorAlert.textContent = error.message;
    }
    errorAlert.classList.remove("d-none");
    return false;
  }
}

function sortExpenses(list) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...list].sort((a, b) => {
    if (typeof a[sortKey] === "number") {
      return (a[sortKey] - b[sortKey]) * direction;
    }
    return a[sortKey].localeCompare(b[sortKey]) * direction;
  });
}

function applyFilter() {
  const search = searchInput.value.trim().toLowerCase();
  const category = categoryFilterSelect.value;
  const month = monthFilter.value;

  const filteredExpenses = expensesList.filter((expense) => {
    const matchesSearch = expense.title.toLowerCase().includes(search);
    const matchesMonth = month === "" || expense.date.startsWith(month);
    const matchesCategory = category === "All" || expense.category === category;
    return matchesSearch && matchesMonth && matchesCategory;
  });

  renderTable(sortExpenses(filteredExpenses));
}

categoryFilterSelect.addEventListener("change", applyFilter);
searchInput.addEventListener("input", applyFilter);
monthFilter.addEventListener("change", applyFilter);
clearFiltersBtn.addEventListener("click", () => {
  categoryFilterSelect.value = "All";
  searchInput.value = "";
  monthFilter.value = "";
  applyFilter();
});

function updateSortArrows() {
  for (const th of sortHeaders) {
    const arrow = th.querySelector(".sort-arrow");
    if (th.dataset.sort === sortKey) {
      arrow.textContent = sortDirection === "asc" ? " ▲" : " ▼";
    } else {
      arrow.textContent = "";
    }
  }
}

for (const th of sortHeaders) {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;

    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = "asc";
    }
    updateSortArrows();
    applyFilter();
  });
}

editExpenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (
    !validateForm(
      editTitleInput,
      editAmountInput,
      editCategoryInput,
      editDateInput,
    )
  )
    return;

  const updatedExpense = {
    title: editTitleInput.value.trim(),
    amount: Number(editAmountInput.value.trim()),
    category: editCategoryInput.value,
    date: editDateInput.value,
  };

  updateExpense(expenseIdToEdit, updatedExpense);
});

async function updateExpense(id, data) {
  const errorAlert = document.querySelector("#edit-error");
  errorAlert.classList.add("d-none");
  setButtonLoading(editExpenseModalSaveBtn, true, "Saving...");
  let response;
  try {
    response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to update expense. ${errorData.message}`);
    }

    const updatedExpense = await response.json();

    editExpenseModal.hide();
    await refresh();
    successToastBody.textContent = `Expense "${updatedExpense.title}" updated successfully!`;
    successToast.show();
  } catch (error) {
    if (error.message === "Failed to fetch") {
      errorAlert.textContent =
        "Failed to update expense due to server connection error. Check the connection with the server.";
    } else {
      errorAlert.textContent = error.message;
    }
    errorAlert.classList.remove("d-none");
  } finally {
    setButtonLoading(editExpenseModalSaveBtn, false);
  }
}

// csv export function
exportCsvBtn.addEventListener("click", () => {
  csvErrorAlert.classList.add("d-none");

  if (!expensesList) {
    csvErrorAlert.textContent =
      "Unable to export expenses. Please check the connection with the server.";
    csvErrorAlert.classList.remove("d-none");
    return;
  }

  if (expensesList.length === 0) {
    csvErrorAlert.textContent = "There are no expenses to export.";
    csvErrorAlert.classList.remove("d-none");
    return;
  }

  const search = searchInput.value.trim().toLowerCase();
  const category = categoryFilterSelect.value;
  const month = monthFilter.value;

  const expensesToExport = sortExpenses(
    expensesList.filter((expense) => {
      const matchesSearch = expense.title.toLowerCase().includes(search);

      const matchesMonth = month === "" || expense.date.startsWith(month);

      const matchesCategory =
        category === "All" || expense.category === category;

      return matchesSearch && matchesMonth && matchesCategory;
    }),
  );

  if (expensesToExport.length === 0) {
    csvErrorAlert.textContent =
      "There are no expenses matching the current filters.";
    csvErrorAlert.classList.remove("d-none");
    return;
  }

  let csvContent = "Title,Amount,Category,Date\n";

  for (const expense of expensesToExport) {
    csvContent += `"${expense.title.replaceAll('"', '""')}",`;
    csvContent += `${expense.amount.toFixed(2)},`;
    csvContent += `"${expense.category}",`;
    csvContent += `${expense.date}\n`;
  }

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "expenses.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  successToastBody.textContent = "Expenses exported successfully!";
  successToast.show();
});
////////////////////////////////////////////

function getTheme() {
  return document.documentElement.getAttribute("data-bs-theme") || "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  try {
    localStorage.setItem("theme", theme);
  } catch (error) {}
}

themeToggle.addEventListener("click", () => {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
});

themeToggle.textContent = getTheme() === "dark" ? "☀️" : "🌙";

refresh();
