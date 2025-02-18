import { CallController } from './controllers/CallController';
import { TranscribeController } from './controllers/TranscribeController';
import { GptController } from './controllers/GptController';
import './helpers/types'
import { EmailController } from './controllers/EmailController';
import { AmioController } from './controllers/AmioController';
import { delay, getAmioChannels, getOrderNum, increaseAmioOffset, modifyContactData } from './helpers/utils';
import { CallDBController } from './controllers/CallDBController';
import { EmailDBController } from './controllers/EmailDBController';
import { AmioDBController } from './controllers/AmioDBController';

export class Manager{
        public constructor(
            private readonly callController = new CallController(),
            private readonly transcribeController = new TranscribeController(),
            private readonly callDBController = new CallDBController(),
            private readonly emailDBController = new EmailDBController(),
            private readonly amioDBController = new AmioDBController(),
            private readonly callGptController = new GptController('asst_nwoScC0Sbb12eHELyB7lSMVS'),
            private readonly emailGptController = new GptController('asst_SW7CNjymEmkuzYyF7T6gHcdQ'),
            private readonly amioGptController = new GptController('asst_QXUsnSAtap5zoWJPWogjA3do'),
            private readonly emailController = new EmailController(),
            private readonly amioController = new AmioController()

        ){
        }
        private async hadleContactData(id: string, knownContacts: Set<string>, channelID: string){
            let mergeData;
            if (knownContacts.has(id)){
                let [knownData, newData] = await Promise.all([
                    this.amioDBController.getAmioRecord(id),
                    this.amioController.getContactData(id, channelID)
                ])

                newData = modifyContactData(newData)
                if (!newData.received){console.log("skipped");return ""}
                mergeData = JSON.stringify(newData) + knownData


                this.amioDBController.deleteAmioRecord({contactID: id, channelID})
                this.amioDBController.deleteAmioSummary({contactID: id, channelID})

            }else{
                let newData = modifyContactData(await this.amioController.getContactData(id, channelID))
                if (!newData.received){console.log("skipped");return""}
                mergeData = JSON.stringify(newData)
            }

            this.amioDBController.setSource(mergeData, {contactID: id, channelID: channelID})
            return mergeData
        }


        public async callHandler(activitySign: string){
            const [audioRecord, audioInfo] = await Promise.all([
                this.callController.getAudio(activitySign),
                this.callController.getAudioInfo(activitySign)
            ]);

            // Sent to transcriptor & wait for webhook
            if (audioRecord.byteLength > 42_000){
                const givenOrderId = await this.transcribeController.transcribe(Buffer.from(audioRecord), audioInfo);
                const body = await this.transcribeController.retrieveTranscript(givenOrderId);
                this.transcribeAndSummaryHandler(body);
            }
            else {
                console.log(`call: ${audioInfo.activitySign} was ditched`);
            }

        }

        public async transcribeAndSummaryHandler(body: any): Promise<void>{
            //const transcript = body.content;
            const jsonTranscript = body.data.content.map((obj: object) => JSON.stringify(obj)).join('\n');
            const audioInfo = await this.callController.getAudioInfo(body.data.filename.split('.')[0].replace(/:/g, '.'))
            audioInfo.web = audioInfo.web.split(' - ')[0];

            this.callDBController.setSource(jsonTranscript, audioInfo);

            const gptOut = await this.callGptController.getSummary(jsonTranscript);

            this.callDBController.setSummary(gptOut, audioInfo);
            
        }

        public async emailHandler(activitySign: string){
            const data = await this.emailController.getEmail(activitySign)
            if (typeof data === 'string'){console.log(`email: ${activitySign} was ditchet`);return}
            this.emailDBController.setSource(data.text, data)
            const gptOut = await this.emailGptController.getSummary(data.text)
            
            this.emailDBController.setSummary(gptOut, data)
        }

        public async proccessAllChannels(){
            // get channel from dev/amioChannels (localhost different from container on server)
            for (const channelID of getAmioChannels()){
                await this.amioChannelHandler(channelID)
            }
            console.log(`Amio chat extraction is completed`)
        }
        private async amioChannelHandler(channelID: string){
            // this.amoiController.getContacts('7153353656766318406')
            const knownContacts = new Set((await this.amioDBController.getAllContacts()).map(item => item.contactID))
            const newContacts = await this.amioController.getAllContacts(channelID)

            let newContactData
            let contactCounter = 0
            for (const newContact of newContacts){                
                newContactData = await this.hadleContactData(newContact.id, knownContacts, channelID)
                contactCounter++
                if(newContactData === ""){continue}
                

                // GPT
                let gptOut
                try {
                    gptOut = await this.amioGptController.getSummary(newContactData)  
                } catch (error: any) {
                    if (error.apiErrorCode === 100){
                        await delay(1000)
                        continue
                    }else {
                        throw error
                    }                   
                }

                if(gptOut){
                    gptOut.orderNum = getOrderNum(gptOut.orderNum as string)
                    this.amioDBController.setSummary(gptOut, {contactID: newContact.id, channelID: channelID})
                    console.log("done "+ newContact.id)
                    await delay(1000)
                }
                //await this.amioController.deleteContact('7153353656766318406', newContact.id)
            }
            increaseAmioOffset(contactCounter, channelID)
            console.log(`Amio chat extraction for channel ${channelID} is completed`)
    }

}
