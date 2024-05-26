const express = require('express');
const db = require('../js/db.js');
const router = express.Router();

const renderCustomers = async (req, res) => {
  const [rows] = await db.query("SELECT * FROM customer");
  res.render("customers", { customers: rows });
};

router.get('/customers', renderCustomers);

const createCustomers = async (req, res) => {
  const newCustomer = req.body;
  await db.query("INSERT INTO customer set ?", [newCustomer]);
  res.redirect("/");
};

const editCustomer = async (req, res) => {
  const { id } = req.params;
  const [result] = await db.query("SELECT * FROM customer WHERE id = ?", [id]);
  res.render("customers_edit", { customer: result[0] });
};

const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const newCustomer = req.body;
  await db.query("UPDATE customer set ? WHERE id = ?", [newCustomer, id]);
  res.redirect("/");
};

const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const result = await db.query("DELETE FROM customer WHERE id = ?", [id]);
  if (result.affectedRows === 1) {
    res.json({ message: "Customer deleted" });
  }
  res.redirect("/");
};

module.exports = {
  renderCustomers,
  createCustomers,
  editCustomer,
  updateCustomer,
  deleteCustomer
};