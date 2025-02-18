import FormData from 'form-data';
import axios from 'axios';
import { ErrorLogger } from "../helpers/ErrorLogger";
import { AudioInfo } from '../helpers/types';
import { delay } from '~/helpers/utils';

export class TranscribeController {
    public constructor(
        private readonly errorLogger = new ErrorLogger 
    ){}

    public async transcribe(audio: Buffer, audioInfo: AudioInfo): Promise<string> {
        const apiKey = '';
        const language = audioInfo.countryCode;
        const fileName = `${audioInfo.activitySign.replace(/\./g, ':')}.opus`;

        const url = `https://api.transkriptor.com/1/Upload`;
        const params = {
            apiKey,
            language,
            fileName
        };

        try {
            const response = await axios.get(url, { params });

            if (response.status !== 200) {
                this.errorLogger.throw({
                    message: 'Invalid params in API transkriptor/Upload',
                    fun: 'TranscribeController/transcribe/get',
                    activitySign: audioInfo.activitySign
                });
            }

            const presignedUrl: string = response.data.url;
            const fields: Record<string, string> = response.data.fields;
            const givenOrderId = fields.key.split("-+-")[0];

            const formData: FormData = new FormData();
            Object.entries(fields).forEach(([key, value]) => {
                formData.append(key, value);
            });
            formData.append('file', audio);

            const postResponse = await axios.post(presignedUrl, formData, {
                headers: formData.getHeaders(),
            });

            if (postResponse.status !== 204) {
                this.errorLogger.throw({
                    message: 'Invalid params in API transkriptor/SentData',
                    fun: 'TranscribeController/transcribe/Post',
                    activitySign: audioInfo.activitySign
                });
            }

            return givenOrderId;
        } catch (error) {
            this.errorLogger.throw({
                message: '???',
                fun: 'TranscribeController/transcribe',
                activitySign: audioInfo.activitySign
            });
            throw error;
        }
    }

    // Used webhook instead
    public async retrieveTranscript(givenOrderId: string): Promise<Object> {
        const parameters = {
            orderid: givenOrderId
        };
        const url = 'https://api.transkriptor.com/3/Get-Content';

        let response;
        let content

        do{
            delay(2000);
            response = await axios.get(url, { params: parameters })
            content = response.data
        }
        while(!('content' in content))
        return response
        
    }
}