import * as React from "react";
import { createRoot } from "react-dom/client";
import CleanroomEntry from "./CleanroomEntry";
import "./cleanroom-join.css";

const params = new URLSearchParams(window.location.search);
const game = params.get("game");
const cleanroom = params.get("cleanroom") === "1" || (game === null && params.get("classic") !== "1");
const root = document.getElementById("root");
if (root !== null && (cleanroom || game === "guandan")) {
  createRoot(root).render(<React.StrictMode><CleanroomEntry /></React.StrictMode>);
}
