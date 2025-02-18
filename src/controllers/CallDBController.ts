import { DBController } from "~/abstracts/DBController";
import { SourceInfo, GptOutput, isAudioInfo } from "~/helpers/types";
import MSSQL from 'mssql'

export class CallDBController extends DBController{
    async setSource(content: string, objInfo: SourceInfo): Promise<void> {
        if(!isAudioInfo(objInfo)){return}
        try{
            if (!DBController.pool.connected){
                this.connectPool();
            }
            const currentDate = new Date();
            const adjustedDate = new Date(currentDate.getTime() + 2 * 60 * 60 * 1000);

            const activitySignQuery = "INSERT INTO dbo.activitySigns VALUES (@activitySign, @orderNum, @clientPhoneNum, @countryCode, @web, @date)";
            const result = await DBController.pool.request()
                .input('activitySign', MSSQL.VarChar, objInfo.activitySign)
                .input('orderNum', MSSQL.VarChar, objInfo.orderNum)
                .input('clientPhoneNum', MSSQL.VarChar, objInfo.phoneNum)
                .input('countryCode', MSSQL.VarChar, objInfo.countryCode)
                .input('web', MSSQL.VarChar, objInfo.web)
                .input('content', MSSQL.VarChar, content)
                .input('date', MSSQL.DateTime, adjustedDate)
                .query(activitySignQuery);
            
            const transcriptQuery = "INSERT INTO dbo.transcripts VALUES (@activitySign, @JSONcontent)";
            const result2 = await DBController.pool.request()
                .input('activitySign', MSSQL.VarChar, objInfo.activitySign)
                .input('JSONcontent', MSSQL.VarChar, content)
                .query(transcriptQuery)
            
        }catch(error){
            this.errorLogger.throw({
                message: 'Failed database query ' + error,
                fun: 'DBController/setRecord'
            })
        }
    }
    async setSummary(gptOut: GptOutput, objInfo: SourceInfo): Promise<void> {
        if(!isAudioInfo(objInfo)){return}
        try{
            if (!DBController.pool.connected){
                this.connectPool();
            }
            const query = "INSERT INTO dbo.callSummary VALUES (@activitySign, @summary, @topic, @resolve)";

            const result = await DBController.pool.request()
                .input('activitySign', MSSQL.VarChar, objInfo.activitySign)
                .input('summary', MSSQL.VarChar, gptOut.summary)
                .input('topic', MSSQL.VarChar, gptOut.topic)
                .input('resolve', MSSQL.VarChar, gptOut.resolve)
                .query(query);

        }catch(error){
            this.errorLogger.throw({
                message: 'Failed database connection ' + error,
                fun: 'DBController/setSummary'
            })
        }
    }
    
}