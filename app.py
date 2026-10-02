import json
import os
import queue
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, Response, jsonify, request, send_from_directory, render_template, abort
import yt_dlp


BASE_DIR = Path(__file__).parent.resolve()
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_HOSTS = {
    "facebook.com", "fb.watch", "fb.com",
    "twitter.com", "x.com", "mobile.twitter.com",
    "reddit.com", "redd.it", "v.redd.it",
    "vimeo.com", "player.vimeo.com",
    "soundcloud.com", "snd.sc", "on.soundcloud.com",
    "twitch.tv", "clips.twitch.tv", "m.twitch.tv",
    "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
}

app = Flask(__name__, static_folder="static", template_folder="templates")

# job_id -> {"queue": Queue, "status": str, "files": [relpath], "title": str, "finished_at": float|None}
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()

JOB_TTL_SECONDS = 3600  # delete downloaded files 1 hour after job completes


def _cleanup_loop():
    import shutil
    while True:
        time.sleep(300)  # every 5 minutes
        now = time.time()
        to_delete = []
        with JOBS_LOCK:
            for jid, job in list(JOBS.items()):
                fin = job.get("finished_at")
                if fin and now - fin > JOB_TTL_SECONDS:
                    to_delete.append(jid)
        for jid in to_delete:
            job_dir = DOWNLOAD_DIR / jid
            if job_dir.is_dir():
                shutil.rmtree(job_dir, ignore_errors=True)
            with JOBS_LOCK:
                JOBS.pop(jid, None)


threading.Thread(target=_cleanup_loop, daemon=True).start()


def host_allowed(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return False
    host = host.lower().lstrip(".")
    if host.startswith("www."):
        host = host[4:]
    if host.startswith("m."):
        host = host[2:]
    return any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS)


def put_event(job_id: str, event: dict) -> None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if job is not None:
        job["queue"].put(event)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/terms")
def terms():
    return render_template("terms.html")


@app.route("/dmca")
def dmca():
    return render_template("dmca.html")


@app.route("/privacy")
def privacy():
    return render_template("privacy.html")


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/robots.txt")
def robots_txt():
    return app.send_static_file("robots.txt")


@app.route("/ads.txt")
def ads_txt():
    return app.send_static_file("ads.txt")


@app.route("/sitemap.xml")
def sitemap_xml():
    return app.send_static_file("sitemap.xml")


@app.route("/llms.txt")
def llms_txt():
    return app.send_static_file("llms.txt")


@app.route("/faq")
def faq():
    return render_template("faq.html")


COMPARE_PAGES = {
    "nabby-vs-cobalt": "compare_cobalt.html",
    "nabby-vs-metube": "compare_metube.html",
    "nabby-vs-ytdlp-webui": "compare_ytdlp_webui.html",
    "nabby-vs-youtubedl-material": "compare_youtubedl_material.html",
    "nabby-vs-ytdlp-cli": "compare_ytdlp_cli.html",
}


@app.route("/compare/<slug>")
def compare(slug: str):
    template = COMPARE_PAGES.get(slug)
    if not template:
        abort(404)
    return render_template(template)


@app.route("/favicons")
def favicons_preview():
    options = [
        ("a-dot", "A · The Dot", "Minimalist. Matches current brand mark."),
        ("b-n", "B · The N", "Letter mark with mint dot. Confident, brand-y."),
        ("c-pincer", "C · The Pincer", "Claw-grabber. Playful, says 'nab'."),
        ("d-face", "D · The Face", "Cute character. Mint bg stands out in tab list."),
        ("e-arrow", "E · The Scoop", "Arrow dropping into bowl. Download metaphor."),
    ]
    return render_template("favicons.html", options=options)


@app.route("/api/probe", methods=["POST"])
def probe():
    data = request.get_json(force=True)
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "missing url"}), 400
    if not host_allowed(url):
        return jsonify({"error": "host not allowed"}), 400

    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": False}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        return jsonify({"error": str(e)}), 400

    def summarize(entry):
        formats = []
        for f in entry.get("formats") or []:
            if f.get("vcodec") == "none" and f.get("acodec") == "none":
                continue
            formats.append({
                "format_id": f.get("format_id"),
                "ext": f.get("ext"),
                "resolution": f.get("resolution") or (f"{f.get('width')}x{f.get('height')}" if f.get("height") else None),
                "fps": f.get("fps"),
                "vcodec": f.get("vcodec"),
                "acodec": f.get("acodec"),
                "abr": f.get("abr"),
                "filesize": f.get("filesize") or f.get("filesize_approx"),
                "note": f.get("format_note"),
            })
        return {
            "title": entry.get("title"),
            "uploader": entry.get("uploader"),
            "duration": entry.get("duration"),
            "thumbnail": entry.get("thumbnail"),
            "webpage_url": entry.get("webpage_url"),
            "formats": formats,
        }

    if info.get("_type") == "playlist":
        entries = [summarize(e) for e in (info.get("entries") or []) if e]
        return jsonify({"type": "playlist", "title": info.get("title"), "entries": entries})
    return jsonify({"type": "video", **summarize(info)})


def run_download(job_id: str, urls: list[str], format_selector: str, audio_only: bool, audio_format: str):
    job_dir = DOWNLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    def hook(d):
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            pct = (downloaded / total * 100) if total else None
            put_event(job_id, {
                "type": "progress",
                "filename": os.path.basename(d.get("filename", "")),
                "downloaded": downloaded,
                "total": total,
                "percent": pct,
                "speed": d.get("speed"),
                "eta": d.get("eta"),
            })
        elif d["status"] == "finished":
            put_event(job_id, {"type": "file_done", "filename": os.path.basename(d.get("filename", ""))})

    outtmpl = str(job_dir / "%(title).200B [%(id)s].%(ext)s")
    ydl_opts = {
        "outtmpl": outtmpl,
        "progress_hooks": [hook],
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": False,
        "ignoreerrors": True,
        "concurrent_fragment_downloads": 4,
    }
    if audio_only:
        ydl_opts["format"] = "bestaudio/best"
        ydl_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": audio_format or "mp3",
            "preferredquality": "192",
        }]
    else:
        ydl_opts["format"] = format_selector or "bv*+ba/b"
        ydl_opts["merge_output_format"] = "mp4"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download(urls)
    except Exception as e:
        put_event(job_id, {"type": "error", "message": str(e)})

    files = sorted(p.name for p in job_dir.iterdir() if p.is_file())
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is not None:
            job["status"] = "done"
            job["files"] = files
            job["finished_at"] = time.time()
    put_event(job_id, {"type": "done", "files": files})


@app.route("/api/download", methods=["POST"])
def start_download():
    data = request.get_json(force=True)
    urls = [u.strip() for u in (data.get("urls") or []) if u.strip()]
    if not urls:
        return jsonify({"error": "no urls"}), 400
    bad = [u for u in urls if not host_allowed(u)]
    if bad:
        return jsonify({"error": "host not allowed", "urls": bad}), 400

    format_selector = data.get("format") or "bv*+ba/b"
    audio_only = bool(data.get("audio_only"))
    audio_format = data.get("audio_format") or "mp3"

    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {"queue": queue.Queue(), "status": "running", "files": []}

    t = threading.Thread(
        target=run_download,
        args=(job_id, urls, format_selector, audio_only, audio_format),
        daemon=True,
    )
    t.start()
    return jsonify({"job_id": job_id})


@app.route("/api/events/<job_id>")
def events(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if job is None:
        abort(404)

    def stream():
        q: queue.Queue = job["queue"]
        yield f"data: {json.dumps({'type': 'hello'})}\n\n"
        while True:
            try:
                event = q.get(timeout=15)
            except queue.Empty:
                yield ": keepalive\n\n"
                continue
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") in ("done", "error"):
                break

    return Response(stream(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


@app.route("/files/<job_id>/<path:filename>")
def download_file(job_id: str, filename: str):
    # prevent traversal
    if "/" in filename or ".." in filename:
        abort(400)
    job_dir = DOWNLOAD_DIR / job_id
    if not job_dir.is_dir():
        abort(404)
    return send_from_directory(job_dir, filename, as_attachment=True)


@app.route("/api/jobs/<job_id>")
def job_info(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if job is None:
        abort(404)
    return jsonify({"status": job["status"], "files": job.get("files", [])})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, threaded=True)
