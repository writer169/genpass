import jwt from "jsonwebtoken";

export default function handler(req, res) {
  const token = req.cookies?.token;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    res.json({ authenticated: true });
  } catch {
    res.json({ authenticated: false });
  }
}
