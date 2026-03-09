// routes/orderroutes.js
const multer = require("multer");
const path = require("path");
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");


// Configure receipt storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {

    const orderId = req.body.orderId || "receipt";

    const ext = path.extname(file.originalname);

    const fileName = `${orderId}-${Date.now()}${ext}`;

    cb(null, fileName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Create new order
router.post("/create-order", async (req, res) => {
  try {
    const {
  email,
  eventId,
  orderType,
  section,
  quantity,
  originalPrice,
  discount,
  totalPrice,
  paymentMethod
} = req.body;

    const order = new Order({
  orderId:
  (orderType === "membership" ? "MEM-" : "TKT-") +
  uuidv4().slice(0, 8),
  email,
  orderType: orderType || "ticket",
  eventId,
  section,
  quantity,
  originalPrice,
  discount,
  totalPrice,
  paymentMethod
});

    await order.save();

    // Create Flutterwave payment link
let paymentLink = null;
let bankDetails = null;

if (paymentMethod === "card") {

  const paymentData = {
    tx_ref: order.orderId,
    amount: totalPrice,
    currency: "USD",
    redirect_url: "https://morganticket.site/payment-success",
    customer: { email },
    customizations: {
      title: "Ticket Payment",
      description: `Payment for ${section}`
    }
  };

  const flwResponse = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    paymentData,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  paymentLink = flwResponse.data.data.link;
}

if (paymentMethod === "bank") {

  bankDetails = {
    accountHolder: process.env.USD_ACCOUNT_HOLDER,
    accountNumber: process.env.USD_ACCOUNT_NUMBER,
    bankName: process.env.USD_BANK_NAME,
    countryCode: process.env.USD_COUNTRY_CODE,
    achRouting: process.env.USD_ACH_ROUTING,
    wireRouting: process.env.USD_WIRE_ROUTING,
    bankAddress: process.env.USD_BANK_ADDRESS,
    accountType: process.env.USD_ACCOUNT_TYPE,
    reference: order.orderId,
    instructions: "Use your Order ID as payment reference."
  };
}

res.status(201).json({
  message: "Order created successfully",
  order,
  paymentLink,
  bankDetails
});


  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/confirm-manual-payment", async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.paymentStatus = "paid";
    await order.save();

    res.json({
      message: "Payment confirmed successfully",
      order
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/flutterwave-webhook", async (req, res) => {
  const signature = req.headers["verif-hash"];

  if (!signature || signature !== process.env.FLW_WEBHOOK_HASH) {
    return res.status(401).send("Unauthorized webhook");
  }

  try {
    const payload = req.body;

    res.status(200).send("Webhook received");

    if (
      payload.event === "charge.completed" &&
      payload.data.status === "successful"
    ) {
      const orderId = payload.data.tx_ref;

      const order = await Order.findOne({ orderId });

      if (!order) return;

      order.paymentStatus = "paid";
      await order.save();

      console.log(`Order ${orderId} marked as PAID ✅`);
    }

  } catch (error) {
    console.error("Webhook error:", error);
  }
});

router.post("/upload-receipt", upload.single("receipt"), async (req, res) => {

  try {

    const { orderId, email } = req.body;

    if (!orderId || !req.file) {
      return res.status(400).json({
        message: "Receipt and orderId are required"
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    // Save receipt path
    order.receiptFile = req.file.filename;

    // Mark as awaiting verification
    order.paymentStatus = "pending_verification";

    await order.save();

    res.json({
      message: "Receipt uploaded successfully",
      orderId: order.orderId
    });

  } catch (error) {

    console.error("Receipt upload error:", error);

    res.status(500).json({
      message: "Server error"
    });

  }

});


module.exports = router;