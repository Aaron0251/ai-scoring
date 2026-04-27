#!/usr/bin/env python3
"""
使用 Firebase Hosting REST API + gcloud token 部署前端，不需要 firebase login
"""
import subprocess, requests, json, os, hashlib, mimetypes, sys, time

SITE_ID = "vertex-ai-491502"
DIST_DIR = os.path.join(os.path.dirname(__file__), "frontend", "dist")

def get_token():
    result = subprocess.run(["gcloud", "auth", "print-access-token"],
                            capture_output=True, text=True, check=True)
    return result.stdout.strip()

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()

def collect_files(dist_dir):
    files = {}
    for root, _, filenames in os.walk(dist_dir):
        for fname in filenames:
            fpath = os.path.join(root, fname)
            rel = "/" + os.path.relpath(fpath, dist_dir).replace("\\", "/")
            files[rel] = fpath
    return files

def main():
    print("▶ 取得 gcloud access token...")
    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    base = f"https://firebasehosting.googleapis.com/v1beta1/sites/{SITE_ID}"

    print("▶ 建立新版本...")
    resp = requests.post(f"{base}/versions", headers=headers, json={
        "config": {
            "headers": [{"glob": "**", "headers": {"Cache-Control": "max-age=3600"}}],
            "rewrites": [{"glob": "**", "path": "/index.html"}]
        }
    })
    resp.raise_for_status()
    version_name = resp.json()["name"]
    version_id = version_name.split("/")[-1]
    print(f"  版本 ID: {version_id}")

    print("▶ 掃描 dist 目錄並計算 hash...")
    files = collect_files(DIST_DIR)
    file_hashes = {rel: sha256_file(path) for rel, path in files.items()}
    print(f"  共 {len(files)} 個檔案")

    print("▶ 取得需要上傳的檔案清單...")
    resp = requests.post(
        f"{base}/versions/{version_id}:populateFiles",
        headers=headers,
        json={"files": file_hashes}
    )
    resp.raise_for_status()
    data = resp.json()
    upload_url = data.get("uploadUrl", "")
    to_upload = data.get("uploadRequiredHashes", [])
    print(f"  需要上傳 {len(to_upload)} 個檔案")

    if to_upload and upload_url:
        hash_to_rel = {v: k for k, v in file_hashes.items()}
        upload_headers = {"Authorization": f"Bearer {token}"}
        for i, fhash in enumerate(to_upload, 1):
            rel = hash_to_rel.get(fhash)
            if not rel:
                continue
            fpath = files[rel]
            mime = mimetypes.guess_type(fpath)[0] or "application/octet-stream"
            print(f"  [{i}/{len(to_upload)}] 上傳 {rel}")
            with open(fpath, "rb") as f:
                content = f.read()
            up_headers = {**upload_headers, "Content-Type": mime}
            r = requests.post(f"{upload_url}/{fhash}", headers=up_headers, data=content)
            r.raise_for_status()

    print("▶ 最終化版本...")
    resp = requests.patch(
        f"{base}/versions/{version_id}",
        headers=headers,
        params={"updateMask": "status"},
        json={"status": "FINALIZED"}
    )
    resp.raise_for_status()

    print("▶ 發布版本...")
    resp = requests.post(
        f"{base}/releases",
        headers=headers,
        params={"versionName": version_name},
        json={}
    )
    resp.raise_for_status()

    print()
    print("✓ 前端部署完成！")
    print(f"▶ 網址：https://{SITE_ID}.web.app")

if __name__ == "__main__":
    main()
