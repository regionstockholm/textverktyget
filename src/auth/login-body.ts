import express, { type RequestHandler } from "express";

const parsers = express.Router();
parsers.use(express.json({ limit: "4kb", inflate: false }));
parsers.use(express.urlencoded({ limit: "4kb", extended: false, parameterLimit: 10, inflate: false }));

export const parseLoginBody: RequestHandler = (req, res, next) => {
  parsers(req, res, error => {
    if (!error) { next(); return; }
    const status = (error as { status?: number }).status;
    res.status(status === 413 || status === 415 ? status : 400).json({
      success: false,
      error: status === 413 ? "Login request exceeds 4 KiB" : "Invalid login request",
    });
  });
};
