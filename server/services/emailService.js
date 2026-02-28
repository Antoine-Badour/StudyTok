import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER || process.env.EMAIL_USER;
const pass = process.env.SMTP_APP_PASSWORD || process.env.EMAIL_PASS;
const fromEmail = process.env.SMTP_FROM_EMAIL || user;
const fromName = process.env.SMTP_FROM_NAME || "StudyTok";

if (!host || !user || !pass) {
  throw new Error(
    "Missing SMTP env variables. Expected SMTP_USER/SMTP_APP_PASSWORD (or EMAIL_USER/EMAIL_PASS)."
  );
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass,
  },
});

export async function sendTwoFactorEmail({ to, code }) {
  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: "Your StudyTok verification code",
    text: `Your StudyTok 2FA code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your StudyTok 2FA code is <b>${code}</b>.</p><p>It expires in 10 minutes.</p>`,
  });
}
