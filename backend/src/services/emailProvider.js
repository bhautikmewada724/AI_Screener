import nodemailer from 'nodemailer';

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
};

let cachedTransporter = null;

export const buildTransporter = () => {
  const host = required('SMTP_HOST');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = required('SMTP_USER');
  const pass = required('SMTP_PASS');

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
};

export const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = buildTransporter();
  return cachedTransporter;
};

export const sendEmail = async ({ to, subject, html, text, headers = {} }) => {
  const from = required('EMAIL_FROM');
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
    headers
  });
  return info;
};




