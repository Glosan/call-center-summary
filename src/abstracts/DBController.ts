import MSSQL from 'mssql'
import { ErrorLogger } from '~/helpers/ErrorLogger';
import { GptOutput, AudioInfo, EmailInfo, SourceInfo } from '../helpers/types';
import dbconfig from '../../dbconfig.json'

export abstract class DBController{
    private config: MSSQL.config
    protected static pool: any;

    public constructor(
        protected readonly errorLogger = new ErrorLogger(),
    ){
        this.config = dbconfig
        if(!DBController.pool){
            this.connectPool()
        }
    }

    public async connectPool(): Promise<void>{
        if (!DBController.pool || !DBController.pool.connected){
            try{
                DBController.pool = new MSSQL.ConnectionPool(this.config);
                await DBController.pool.connect();

                if (DBController.pool.connected){
                    console.log('Database connected successfully');
                }
                else{
                    this.errorLogger.throw({
                        message: 'Failed database connection ',
                        fun: 'DBController/connectPool'
                    })
                }

            }catch(error){
                this.errorLogger.throw({
                    message: 'Failed database connection ' + error,
                    fun: 'DBController/connectPool'
                })
            }
        }   
    }
    abstract setSource(content: string, objInfo: SourceInfo): Promise<void>
    abstract setSummary(gptOut: GptOutput, objInfo: SourceInfo): Promise<void>

}