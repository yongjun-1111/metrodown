import { appWindow, escapeHtml } from "./dom";
import { initReader, showMessage } from "./reader";
import { initSession, openFile, startSession } from "./session";
import { initShell } from "./shell";
import { initTree } from "./tree";

initShell();
initTree((path) => void openFile(path));
initReader();
initSession();

// Show the window after the first frame so it never flashes white.
requestAnimationFrame(() => void appWindow.show());
startSession().catch((err) => showMessage("Something went wrong while starting", escapeHtml(String(err))));
