import nodemailer, { Transporter } from "nodemailer";

interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const transporter: Transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendMail({
  to,
  subject,
  text,
  html,
}: SendMailOptions): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  });
}
