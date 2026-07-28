import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSWAutoUpdate } from "./lib/sw-update";

createRoot(document.getElementById("root")!).render(<App />);

// Kick off SW auto-update logic after the React tree has mounted.
// initSWAutoUpdate() is a no-op when service workers are unsupported
// (e.g., non-HTTPS, Firefox private mode) so it is always safe to call.
initSWAutoUpdate();
