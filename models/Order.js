// models/order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  orderType: {
  type: String,
  enum: ["ticket", "membership", "meetgreet"],
  default: "ticket"
},

eventId: {
  type: String,
  required: function () {
    return this.orderType === "ticket";
  }
},
  section: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  originalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ["card", "bank"],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "pending_verification", "paid", "failed"],
    default: "pending"
  },
  receiptFile: {
    type: String
  }

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
