import fs from 'fs';
import { ApplicationError } from '~/ApplicationError';
import { ErrorLogger } from './ErrorLogger';

export class DataController{
    public constructor(
        private readonly errorLogger = new ErrorLogger()
    ){}

    public async exportToFile(content: Array<object>, filePath: string): Promise<void>{
        const jsonContent = content.map(obj => JSON.stringify(obj)).join('\n')
        filePath += '.jsonl';

        fs.writeFile(filePath, jsonContent, 'utf-8', (err) => {
            if(err){
                this.errorLogger.throw({
                    message: 'Failed to write file:',
                    fun: 'DataController/exportToFile',
                    activitySign: filePath.split('/')[-1]
                });
            }
        })
    }
}