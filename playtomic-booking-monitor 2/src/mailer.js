const nodemailer = require("nodemailer");

function createMailer({
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  fromEmail,
  alertEmailTo
}) {
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  async function verifyConnection() {
    await transporter.verify();
  }

  async function sendBookingAlert({ subject, text }) {
    await transporter.sendMail({
      from: fromEmail,
      to: alertEmailTo.join(", "),
      subject,
      text
    });
  }

  return {
    verifyConnection,
    sendBookingAlert
  };
}

module.exports = {
  createMailer
};
