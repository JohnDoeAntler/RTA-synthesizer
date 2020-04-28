//
// ─── IMPORT FS ──────────────────────────────────────────────────────────────────
//
const fs = require('fs');
const http = require('http');

//
// ─── DOWNLOAD FILE SYNC ─────────────────────────────────────────────────────────
//
exports.downloadFileSync = downloadFileSync = (des, url) => {
	return new Promise((res, rej) => {
		const file = fs.createWriteStream(des);
		const request = http.get(url, (req) => {
			req.pipe(file)
				.on("close", () => res())
				.on("error", () => rej());
		});
	});
}

//
// ─── MAKE DIRECTORY IF NOT EXIST ────────────────────────────────────────────────
//
exports.mkdirSyncIfNotExist =  mkdirSyncIfNotExist = (path) => !fs.existsSync(path) && fs.mkdirSync(path);