//
// ─── IMPORT EXPRESS ─────────────────────────────────────────────────────────────
//
const express = require('express');
const app = express();
const port = 4000;

//
// ─── IMPORT FILE SYSTEM ─────────────────────────────────────────────────────────
//
const fs = require('fs');

//
// ─── GRAPHQL REQUEST ────────────────────────────────────────────────────────────
//
const { GraphQLClient } = require('graphql-request');

//
// ─── IMPORT MIDDLEWARE ──────────────────────────────────────────────────────────
//
const bodyParser = require('body-parser');
const cors = require('cors');

//
// ─── FFMPEG ─────────────────────────────────────────────────────────────────────
//
const ffmpeg = require('fluent-ffmpeg');

//
// ─── AXIOS ──────────────────────────────────────────────────────────────────────
//
const axios = require('axios');

//
// ─── FORM DATA ──────────────────────────────────────────────────────────────────
//
const FormData = require('form-data');

//
// ─── LOAD .ENV FILE ─────────────────────────────────────────────────────────────
//
require('dotenv').config();

//
// ─── IMPORT CONFIGURATION ───────────────────────────────────────────────────────
//
const config = require('./util.json');

//
// ─── IMPORT UTIL ────────────────────────────────────────────────────────────────
//
const { mkdirSyncIfNotExist, downloadFileSync } = require('./util');

//
// ─── IMPORT QUERY ───────────────────────────────────────────────────────────────
//
const { GET_PROGRESSES, GET_IMAGE_DATAS, GET_AUDIO_DATAS, UPDATE_PROGRESS_STATUS } = require('./graphql/');

//
// ─── USE MIDDLEWARE ─────────────────────────────────────────────────────────────
//
app.use(bodyParser());
app.use(cors());

//
// ─── GRAPHQL CLIENT ─────────────────────────────────────────────────────────────
//
const client = new GraphQLClient(process.env.HASURA_ENDPOINT, {
	headers: {
		"x-hasura-admin-secret": process.env.ADMIN_SECRET,
	},
});

//
// ─── CONTROLLERS ────────────────────────────────────────────────────────────────
//
app.post('/notify', async (req, res) => {

	res.sendStatus(200);

	const { progresses } = await client.request(GET_PROGRESSES);

	mkdirSyncIfNotExist(config.progresses_path)

	progresses.forEach(async (progress) => {
		//
		// ─── IMAGE DATAS ─────────────────────────────────────────────────
		//
		const { image_datas } = await client.request(GET_IMAGE_DATAS, {
			workId: progress.workId,
		});

		//
		// ─── AUDIO DATAS ─────────────────────────────────────────────────
		//
		const { audio_datas } = await client.request(GET_AUDIO_DATAS, {
			workId: progress.workId,
		});

		//
		// ─── IF IMAGE TRAINING DATAS > 0 AND AUDIO TRAINING DATAS > 0 ────────
		//
		if (image_datas.length && audio_datas.length) {
			//
			// ─── MKDIR BY PROGRESS ID ────────────────────────────────────────
			//
			mkdirSyncIfNotExist(`${config.progresses_path}/${progress.id}`);

			//
			// ─── MKDIR IMAGES UNDER PROGRESS ID DIRECTORY ────────────────────
			//
			mkdirSyncIfNotExist(`${config.progresses_path}/${progress.id}/images`);

			//
			// ─── DOWNLOAD IMAGE DATAS ────────────────────────────────────────
			//
			image_datas.forEach((image, idx) => {
				const des = `${config.progresses_path}/${progress.id}/images/${image.fileUrl.replace('uploads/', '')}`;
				const url = `${process.env.FILE_SERVER_ENDPOINT}/${image.fileUrl}`;
				!fs.existsSync(des) && downloadFileSync(des, url);
				console.log(`${image.fileUrl} has been downloaded.`);
			})

			//
			// ─── MKDIR AUDIOS UNDER PROGRESS ID DIRECTORY ────────────────────
			//
			mkdirSyncIfNotExist(`${config.progresses_path}/${progress.id}/audios`);

			//
			// ─── DOWNLOAD AUDIO DATAS ────────────────────────────────────────
			//
			audio_datas.forEach((audio, idx) => {
				const des = `${config.progresses_path}/${progress.id}/audios/${audio.fileUrl.replace('uploads/', '')}`;
				const url = `${process.env.FILE_SERVER_ENDPOINT}/${audio.fileUrl}`;
				!fs.existsSync(des) && downloadFileSync(des, url);
				console.log(`${audio.fileUrl} has been downloaded.`);
			})

			//
			// ─── DOWNLOAD DRIVING VIDEO ──────────────────────────────────────
			//
			const des = `${config.progresses_path}/${progress.id}/driving.mp4`;
			const url = `${process.env.FILE_SERVER_ENDPOINT}/${progress.drivingVideoUrl}`;

			await downloadFileSync(des, url);
			//
			// ─── SEPARATE THE DRIVING VIDEO TO VIDEO AND AUDIO ───────────────
			//

			await new Promise((res, req) => {
				ffmpeg(des)
					.withNoAudio()
					.saveToFile(`${config.progresses_path}/${progress.id}/ground.mp4`)
					.on("end", () => res())
					.on("error", (err) => rej(err));
			}).then(() => {
				console.log("video from driving video has been extracted.")
			});

			await new Promise((res, rej) => {
				ffmpeg(des)
					.withNoVideo()
					.saveToFile(`${config.progresses_path}/${progress.id}/ground.mp3`)
					.on("end", () => res())
					.on("error", (err) => rej(err));
			}).then(() => {
				console.log("audio from driving video has been extracted.")
			});

			//
			// ─── ASSIGN A TASK TO TALKING HEAD MODELS SERVER ─────────────────
			//
			axios.post(`http://localhost:4001`, {
					id: progress.id,
				},
			).then(() => {
				console.log("successfully post a request to the talking head models server.")
			}).catch(() => {
				console.log("cannot post a request to the talking head server.")
			});

			//
			// ─── ASSIGN A TASK TO DEEP VOICE CONVERSION SERVER ───────────────
			//
			axios.post(`http://localhost:4002`, {
					id: progress.id,
				},
			).then(() => {
				console.log("successfully post a request to the deep voice conversion server.")
			}).catch(() => {
				console.log("cannot post a request to the deep voice conversion server.")
			});

			//
			// ─── SET PROGRESS ISPROCESSING STATUS TO TRUE ────────────────────
			//
			await client.request(UPDATE_PROGRESS_STATUS, {
				id: progress.id,
			});
		} else {
			console.log(`progress ${progress.id} does not have enough training material to process the synthesization.`)
		}
	})
})

app.post('/merge', async (req, res) => {

	res.sendStatus(200);

	//
	// ─── GET PROGRESS ID ────────────────────────────────────────────────────────────
	//
	const id = req.body.id || req.params.id || req.query.id;

	if (fs.existsSync(`${config.progresses_path}/${id}/fake.mp4`)&& fs.existsSync(`${config.progresses_path}/${id}/fake.mp3`)) {

		await new Promise((res, req) => {
			ffmpeg(`${config.progresses_path}/${id}/fake.mp4`)
			.addInput(`${config.progresses_path}/${id}/fake.mp3`)
			.saveToFile(`${config.progresses_path}/${id}/result.mp4`)
			.on("end", () => res())
			.on("error", (err) => rej(err));
		}).then(() => {
			console.log(`progress ${id} has been merged.`)

			const endpoint = `${process.env.FILE_SERVER_ENDPOINT}/result`;
			const formData = new FormData();
			formData.append('id', id);
			formData.append('file', fs.createReadStream(`${config.progresses_path}/${id}/result.mp4`));

			console.log(`sending synthesized video to file server.`);
			axios.post(endpoint, formData, {
				headers: {
					...formData.getHeaders(),
				},
			}).then(x => {
				console.log(`successfully update progress ${id} resultUrl.`);
			});
		});

	} else {
		console.log(`progress ${id} is not ready to merge.`);
	}
});

app.listen(port, "0.0.0.0", () => {
	console.log(`Express server listening on port ${port}.`);
})