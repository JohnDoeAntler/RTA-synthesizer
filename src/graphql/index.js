exports.GET_PROGRESSES = `
	{
		progresses (
			where: {
				isProcessing: {
					_eq: false
				}
			}
		) {
			id
			userId
			workId
			drivingVideoUrl
		}
	}
`;

exports.GET_IMAGE_DATAS = `
	query (
		$workId: uuid!
	) {
		image_datas (
			where: {
				workId: {
					_eq: $workId
				}
			}
		) {
			fileUrl
		}
	}
`;

exports.GET_AUDIO_DATAS = `
	query (
		$workId: uuid!
	) {
		audio_datas (
			where: {
				workId: {
					_eq: $workId
				}
			}
		) {
			fileUrl
		}
	}
`;

exports.UPDATE_PROGRESS_STATUS = `
	mutation (
		$id: uuid
	) {
		update_progresses (
			_set: {
				isProcessing: true
			}
			where: {
				id: {
					_eq: $id
				}
			}
		) {
			affected_rows
		}
	}
`;