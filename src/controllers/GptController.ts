import OpenAI from "openai";
import { delay } from "../helpers/utils"
import { MessageOptions } from "../helpers/types";
import { GptOutput } from "../helpers/types";
import { ErrorLogger } from "~/helpers/ErrorLogger";

export class GptController{
    private assistantID: string;
    private openai;
    private errorLogger;
    private maxRetries = 3
    public constructor(
        //private readonly assistantId = 'asst_nwoScC0Sbb12eHELyB7lSMVS'
        
        assistantID: string
    ){
        this.assistantID = assistantID
        this.openai = new OpenAI({
            apiKey: ''
        })
        this.errorLogger = new ErrorLogger()
    }

    public async getSummary(text: string): Promise<GptOutput>{
        const thread = await this.createThread();

        await this.setMessage({
            thread,
            message: text
        })
        let retryCount = 0
        let run
        let last_error: any
        while (retryCount < this.maxRetries){
            try {
                run = await this.runAndWait(thread)
                break;
            } catch (error) {
                await delay(60000)
                retryCount++
                last_error = error
            }
        }
        if(!run){
            this.errorLogger.throw({
                message: 'Failed GPT query '+  last_error,
                fun: 'DBController/setSummary',
                apiErrorCode:101
            })
        }

        const response = await this.getResponse(thread);

        this.deleteThread(thread);

        return response
    }

    private async createThread(){
        return await this.openai.beta.threads.create();
    }

    private async deleteThread(thread: OpenAI.Beta.Threads.Thread){
        const x = await this.openai.beta.threads.del(thread.id);
    }

    
    private async setMessage(messageOptions: MessageOptions){
        messageOptions.role = messageOptions.role ?? "user"

        return await this.openai.beta.threads.messages.create(
            messageOptions.thread.id,
            {
              role: messageOptions.role,
              content: messageOptions.message
            }
          );

    }

    private async runAndWait(thread: OpenAI.Beta.Threads.Thread){
        let run = await this.openai.beta.threads.runs.create(thread.id, {
            assistant_id: this.assistantID
        });
        while(run.status !== "completed"){
            await delay(2000);
            run = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
            if (run.status == "failed"){
                this.errorLogger.throw({
                    message: 'Failed GPT query '+ run.last_error?.message ,
                    fun: 'DBController/setSummary',
                    apiErrorCode:101
                })
            }
        }
        return run;
    }

    private async getResponse(thread: OpenAI.Beta.Threads.Thread){
        const messages: any = await this.openai.beta.threads.messages.list(thread.id);
        
        const jsonResponse = messages.data[0].content[0].text.value;
        try {
            return JSON.parse(jsonResponse);
        } catch (error) {
            this.errorLogger.throw({
                message: `${error} -> ${jsonResponse}`,
                fun: 'DBController/setSummary',
                apiErrorCode: 100
            })
        }
        
    }

}