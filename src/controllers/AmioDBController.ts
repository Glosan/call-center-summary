import { DBController } from "~/abstracts/DBController";
import { SourceInfo, GptOutput, ContactInfo, isContactInfo} from "~/helpers/types";
import MSSQL from 'mssql'

export class AmioDBController extends DBController{
    async setSource(content: string, objInfo: SourceInfo): Promise<void> {
        try {
            if (!DBController.pool.connected){
                this.connectPool();
            }
            if (!isContactInfo(objInfo)){
                return
            }

            const query = "INSERT INTO dbo.amioRecords VALUES (@contactID, @channelID, @record)"

            const result = await DBController.pool.request()
                .input('contactID', MSSQL.VarChar, objInfo.contactID)
                .input('channelID', MSSQL.VarChar, objInfo.channelID)
                .input('record', MSSQL.VarChar, content)
                .query(query);
        } catch (error) {
            this.errorLogger.throw({
                message: 'Failed database insertion ' + error,
                fun: 'amioDBController/setSource'
            })
        }
    }
    async setSummary(gptOut: GptOutput, objInfo: SourceInfo): Promise<void> {
        try {
            if (!DBController.pool.connected){
                this.connectPool();
            }
            if (!isContactInfo(objInfo)){
                return
            }

            const query = "INSERT INTO dbo.amioSummary VALUES (@contactID, @channelID, @summary, @topic, @resolve, @countryCode, @orderNum, @date)";

            const result = await DBController.pool.request()
                .input('contactID', MSSQL.VarChar, objInfo.contactID)
                .input('channelID', MSSQL.VarChar, objInfo.channelID)
                .input('summary', MSSQL.VarChar, gptOut.summary)
                .input('topic', MSSQL.VarChar, gptOut.topic)
                .input('resolve', MSSQL.VarChar, gptOut.resolve)
                .input('countryCode', MSSQL.VarChar, gptOut.language)
                .input('orderNum', MSSQL.VarChar, gptOut.orderNum)
                .input('date', MSSQL.DateTime, gptOut.date)
                .query(query);
        } catch (error) {
            this.errorLogger.throw({
                message: 'Failed database insertion ' + error,
                fun: 'amioDBController/setSummary'
            })
        }
    }
    
    public async getAmioRecord(contactID: string){
        try {
            if (!DBController.pool.connected){
                this.connectPool();
            }
            const selQuery = `SELECT record FROM dbo.amioRecords WHERE contactID = ${contactID}`
            
            const result = await DBController.pool.request().query(selQuery)

            return result.recordset[0].record
        }catch (error) {
            this.errorLogger.throw({
                message: 'Failed database request ' + error,
                fun: 'AmioDBController/getAmioRecord'
            })
        }
    }

    public async deleteAmioRecord(ids: ContactInfo){
        try {
            if (!DBController.pool.connected){
                this.connectPool();
            }
            const delQuery = `DELETE FROM dbo.amioRecords WHERE contactID = ${ids.contactID} AND channelID = ${ids.channelID}`
            const delResult = await DBController.pool.request().query(delQuery)
    
        }catch (error) {
            this.errorLogger.throw({
                message: 'Failed deletion of amioSummary from DB ' + error,
                fun: 'AmioDBController/deleteAmioRecord'
            })
        }
    }

    public async deleteAmioSummary(ids: ContactInfo){
        try {
            this.connectPool();
            const delQuery = `DELETE FROM dbo.amioSummary WHERE contactID = ${ids.contactID} AND channelID = ${ids.channelID}`
            const delResult = await DBController.pool.request().query(delQuery)
    
        }catch (error) {
            this.errorLogger.throw({
                message: 'Failed deletion of amioSummary from DB ' + error,
                fun: 'AmioDBController/deleteAmioSummary'
            })
        }
    }
    // Getting all contacts from amio chatbot
    public async getAllContacts(): Promise<Array<ContactInfo>>{
        try {
            this.connectPool();
            const query = "SELECT contactID FROM dbo.amioRecords"
        
            const result = await DBController.pool.request().query(query)
            return result.recordset
        } catch (error) {
            this.errorLogger.throw({
                message: 'Failed database select ' + error,
                fun: 'AmioDBController/getAllContacts'
            })
            return []
        }
    }
}