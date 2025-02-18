import { DBController } from "~/abstracts/DBController";
import { SourceInfo, GptOutput, isEmailInfo } from "~/helpers/types";
import MSSQL from 'mssql'

export class EmailDBController extends DBController{
    async setSource(content: string, objInfo: SourceInfo): Promise<void> {
        if(!isEmailInfo(objInfo)){return}
        console.log('inserting')
        try {
            if (!DBController.pool.connected){
                this.connectPool();
            }
            const query = "INSERT INTO dbo.emailRecords VALUES (@activitySign, @record)";

            const result = await DBController.pool.request()
                    .input('activitySign', MSSQL.VarChar, objInfo.activitySign)
                    .input('record', MSSQL.VarChar, content)
                    .query(query)  

        } catch (error) {
            this.errorLogger.throw({
                message: 'Failed database insertion ' + error,
                fun: 'amioDBController/setSummary'
            })
        }

        

    }


    async setSummary(gptOut: GptOutput, objInfo: SourceInfo): Promise<void> {
        if(!isEmailInfo(objInfo)){return}
        try {
            const currentDate = new Date();
            const adjustedDate = new Date(currentDate.getTime() + 2 * 60 * 60 * 1000); 
            if (!DBController.pool.connected){
                this.connectPool();
            }

            const query = "INSERT INTO dbo.EmailSummary VALUES (@activitySign, @orderNum, @email, @countryCode, @topic, @summary, @resolve, @date)";

            const result = await DBController.pool.request()
                .input('activitySign', MSSQL.VarChar, objInfo.activitySign)
                .input('orderNum', MSSQL.VarChar, objInfo.orderNum)
                .input('email', MSSQL.VarChar, objInfo.email)
                .input('countryCode', MSSQL.VarChar, gptOut.language)
                .input('topic', MSSQL.VarChar, gptOut.topic)
                .input('summary', MSSQL.VarChar, gptOut.summary)
                .input('resolve', MSSQL.VarChar, gptOut.resolve)
                .input('date', MSSQL.DateTime, adjustedDate)
                .query(query);
        } catch (error) {
            this.errorLogger.throw({
                message: 'Failed database insertion ' + error,
                fun: 'amioDBController/setSummary'
            })
        }
                console.log("🚀 ~ EmailDBController ~ setSummary ~ objInfo.activitySign:", objInfo.activitySign)
    }

}