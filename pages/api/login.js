import { serialize } from "cookie";
import jwt from "jsonwebtoken";

const PASSWORD = process.env.LOGIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { password } = req.body;
  if (password !== PASSWORD) return res.json({ success: false });

  const token = jwt.sign({ user: "andrey" }, JWT_SECRET, { expiresIn: "30d" });
  res.setHeader("Set-Cookie", serialize("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax"
  }));
  res.json({ success: true });
}
