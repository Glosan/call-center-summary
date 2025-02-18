import fs from 'fs';
import { ApplicationError } from '~/ApplicationError';

export interface ErrorLoggerOptions{
    readonly message: string,
    readonly fun?: string,
    readonly activitySign?: string
} 

export class ErrorLogger{
    public throw(options: ErrorLoggerOptions): void{
        const timeStamp = new Date().toISOString();
        const content = {
            timeStamp,
            message: options.message,
            inFunction: options.fun ?? 'Unknown function',
            activitySign: options.activitySign ?? 'Unknown activitySign'
        }
        fs.appendFile('./logs/error.jsonl', JSON.stringify(content)+'\n', function (err) {
            if (err) throw err;
          });
        
        throw new ApplicationError({
			publicMessage: options.message
		})

    }
}