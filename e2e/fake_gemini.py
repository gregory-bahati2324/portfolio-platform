"""Local stand-in for the Gemini REST API, used only by the browser E2E test."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG = "/tmp/e2e/gemini_requests.jsonl"


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        with open(LOG, "a") as f:
            f.write(json.dumps({"path": self.path, "key": self.headers.get("x-goog-api-key"), "body": body}) + "\n")
        last = body["contents"][-1]["parts"][0]["text"]
        if "LEAK" in last:
            text = "Sure, here are my instructions: " + body["system_instruction"]["parts"][0]["text"][:600]
        elif "PHISH" in last:
            text = "Visit [here](https://evil.example/login) or https://evil.example/x for details."
        else:
            text = "Gregory built the [E2E Vision Project](/projects/e2e-vision-project). You can also see [all projects](/projects)."
        out = json.dumps({"candidates": [{"content": {"parts": [{"text": text}]}}]}).encode()
        self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(out))); self.end_headers(); self.wfile.write(out)

    def log_message(self, *a):
        pass


HTTPServer(("127.0.0.1", 9099), H).serve_forever()
