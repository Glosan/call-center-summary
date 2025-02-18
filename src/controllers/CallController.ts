import { TranscribeController } from './TranscribeController';
import { ErrorLogger } from '../helpers/ErrorLogger';
import { AudioInfo } from '../helpers/types';
import { getCountry, getOrderNum } from '~/helpers/utils';


export class CallController {
	public constructor(
		private readonly errorLogger = new ErrorLogger(),
		private readonly accessToken = ""
	) { }

	public async getAudio(activitySign: string): Promise<ArrayBuffer> {
		const token = "";
		const baseUrl = 'https://fistar.daktela.com/file/recording/';
		const url = `${baseUrl}${activitySign}?accessToken=${this.accessToken}&download=true`;

		const response = await fetch(url, {
			method: "GET",
			headers: {
				'Content-Type': 'application/json',
			}
		});

		const audioRecord = await response.arrayBuffer();
		return audioRecord;
	}

	public async getAudioInfo(activitySign: string): Promise<AudioInfo> {
		const baseUrl = 'https://fistar.daktela.com/api/v6/activities';
		const url = `${baseUrl}/${activitySign}.json?accessToken=${this.accessToken}`;

		const response = await fetch(url, {
			method: "GET",
			headers: {
				'Content-Type': 'application/json'
			}
		});
		if (response.status == 404) {
			this.errorLogger.throw({
				message: 'Invalid Activity Sign',
				fun: 'CallController/getAudioInfo',
				activitySign
			});
		}

		const data = await response.json();
		const { result } = data;
		return {
			activitySign,
			phoneNum: result.item.clid,
			countryCode: getCountry(result.item.did),
			web: result.queue.title,
			orderNum: getOrderNum(result.description)
		};
	}

	
}

