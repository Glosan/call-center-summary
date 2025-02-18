import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import { STATUS_CODES } from 'node:http';
import * as fs from 'node:fs';
import fs__default from 'node:fs';
import FormData from 'form-data';
import axios from 'axios';
import OpenAI from 'openai';
import MSSQL from 'mssql';

var ApiErrorCode;
(function (ApiErrorCode) {
    ApiErrorCode[ApiErrorCode["UNKNOWN"] = 0] = "UNKNOWN";
    ApiErrorCode[ApiErrorCode["MODEL_INVALID"] = 1] = "MODEL_INVALID";
    ApiErrorCode[ApiErrorCode["PATH_PARAM_INVALID"] = 2] = "PATH_PARAM_INVALID";
    ApiErrorCode[ApiErrorCode["NOT_FOUND"] = 3] = "NOT_FOUND";
    ApiErrorCode[ApiErrorCode["BAD_CREDENTIALS"] = 4] = "BAD_CREDENTIALS";
    ApiErrorCode[ApiErrorCode["ACCESS_DENIED"] = 5] = "ACCESS_DENIED";
    ApiErrorCode[ApiErrorCode["AUTH_INVALID"] = 6] = "AUTH_INVALID";
    ApiErrorCode[ApiErrorCode["AUTH_EXPIRED"] = 7] = "AUTH_EXPIRED";
    ApiErrorCode[ApiErrorCode["ALREADY_EXISTS"] = 8] = "ALREADY_EXISTS";
})(ApiErrorCode || (ApiErrorCode = {}));
class ApplicationError extends Error {
    apiErrorCode;
    httpStatusCode;
    innerError;
    publicMessage;
    isApplicationError = true;
    constructor(options = {}) {
        const apiErrorCode = options.apiErrorCode ?? ApiErrorCode.UNKNOWN;
        const httpStatusCode = options.httpStatusCode ?? 500;
        const publicMessage = options.publicMessage ?? STATUS_CODES[httpStatusCode] ?? STATUS_CODES[500];
        super(`[E_${ApiErrorCode[apiErrorCode]}]: ${publicMessage} ${options.privateMessage ?? ''}`);
        this.apiErrorCode = apiErrorCode;
        this.httpStatusCode = httpStatusCode;
        this.innerError = options.innerError;
        this.publicMessage = publicMessage;
    }
    toString() {
        return this.innerError
            ? `${this.message}\n\n${this.innerError.stack ?? this.innerError}`
            : '' + (this.stack ?? this);
    }
    toJSON() {
        return {
            code: ApiErrorCode[this.apiErrorCode],
            message: this.publicMessage
        };
    }
    static isApplicationError(ex) {
        return ex !== null && typeof ex === 'object' && ex.isApplicationError === true;
    }
    static wrap(ex, options = {}) {
        return ApplicationError.isApplicationError(ex)
            ? ex
            : new ApplicationError({
                ...options,
                innerError: ex instanceof Error ? ex : undefined
            });
    }
}

class ErrorLogger {
    throw(options) {
        const timeStamp = new Date().toISOString();
        const content = {
            timeStamp,
            message: options.message,
            inFunction: options.fun ?? 'Unknown function',
            activitySign: options.activitySign ?? 'Unknown ID'
        };
        fs__default.appendFile('./dev/logs/error.jsonl', JSON.stringify(content) + '\n', function (err) {
            if (err)
                throw err;
        });
        throw new ApplicationError({
            publicMessage: options.message,
            apiErrorCode: options.apiErrorCode
        });
    }
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}
function getCountry(phoneNum) {
    const coutryCode = {
        '42': 'cs-CZ',
        '40': 'ro-RO',
        '36': 'hu-HU',
        '48': 'pl-PL'
    };
    let prefix;
    switch (phoneNum.length) {
        case 9: {
            return "cs-CZ";
        }
        case 10:
        case 11: {
            prefix = phoneNum.charAt(0) + phoneNum.charAt(1);
            break;
        }
        case 12:
        case 13:
        case 14: {
            if (phoneNum.charAt(0) === '0' && phoneNum.charAt(1) === '0') {
                prefix = phoneNum.charAt(2) + phoneNum.charAt(3);
            }
            else {
                throw new ApplicationError({
                    publicMessage: `Invalid Number. Cant get a country code ${phoneNum}`
                });
            }
            break;
        }
        default: {
            throw new ApplicationError({
                publicMessage: `Invalid Number. Cant get a country code ${phoneNum}`
            });
        }
    }
    const validKeys = ['48', '42', '40', '36'];
    if (!validKeys.includes(prefix)) {
        throw new ApplicationError({
            publicMessage: `Invalid Number. Cant get a country code ${phoneNum}`
        });
    }
    return coutryCode[prefix];
}
function getOrderNum(s) {
    if (!s) {
        return "undefined";
    }
    const orderNum = s.replace(/[^0-9]/g, '');
    return orderNum ? orderNum : "undefined";
}
function modifyContactData(contactData) {
    let modified = new Array();
    if (!contactData[contactData.length - 1]) {
        return {
            timeStamp: "",
            received: false,
            data: modified
        };
    }
    const timeStamp = contactData[contactData.length - 1].sent;
    let received = false;
    contactData.forEach(item => {
        if (item.direction === 'received') {
            received = true;
        }
        let modItem = {
            direction: item.direction,
            content: item.content.payload
        };
        modified.push(modItem);
    });
    return {
        timeStamp,
        received,
        data: modified
    };
}
function getAmioOffset(channelID) {
    const path = `./dev/amioOffsets/${channelID}`;
    if (!fs.existsSync(path)) {
        return 0;
    }
    const offset = fs.readFileSync(path, 'utf-8');
    return Number(offset);
}
function increaseAmioOffset(counter, channelID) {
    const path = `./dev/amioOffsets/${channelID}`;
    const oldOffset = getAmioOffset(channelID);
    fs.writeFileSync(path, String(oldOffset + counter), 'utf-8');
}
function getAmioChannels() {
    const path = `./dev/amioChannels`;
    const channels = fs.readFileSync(path, 'utf-8').split('\n');
    console.log(channels);
    return channels;
}

class CallController {
    errorLogger;
    accessToken;
    constructor(errorLogger = new ErrorLogger(), accessToken = "49ea709218b81b9ccffbf8268f11c68e52a0df39") {
        this.errorLogger = errorLogger;
        this.accessToken = accessToken;
    }
    async getAudio(activitySign) {
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
    async getAudioInfo(activitySign) {
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

class TranscribeController {
    errorLogger;
    constructor(errorLogger = new ErrorLogger) {
        this.errorLogger = errorLogger;
    }
    async transcribe(audio, audioInfo) {
        const apiKey = '82acf3526fa869d3324f8ab34c24bb0f03f32b94e985f3462728d6ff99acf60cbdbbab065dd4154eb16feca6f6992dbc96efc39462badbbfb23fa3b12144ec2b';
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
            const presignedUrl = response.data.url;
            const fields = response.data.fields;
            const givenOrderId = fields.key.split("-+-")[0];
            const formData = new FormData();
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
        }
        catch (error) {
            this.errorLogger.throw({
                message: '???',
                fun: 'TranscribeController/transcribe',
                activitySign: audioInfo.activitySign
            });
            throw error;
        }
    }
    // Used webhook instead
    async retrieveTranscript(givenOrderId) {
        const parameters = {
            orderid: givenOrderId
        };
        const url = 'https://api.transkriptor.com/3/Get-Content';
        let response;
        let content;
        do {
            delay(2000);
            response = await axios.get(url, { params: parameters });
            content = response.data;
        } while (!('content' in content));
        return response;
    }
}

class GptController {
    assistantID;
    openai;
    errorLogger;
    maxRetries = 3;
    constructor(
    //private readonly assistantId = 'asst_nwoScC0Sbb12eHELyB7lSMVS'
    assistantID) {
        this.assistantID = assistantID;
        this.openai = new OpenAI({
            apiKey: 'sk-proj-mevth3AXpIyzMti58bwcT3BlbkFJ0Vo4rC9ymu9aVeiULeDe'
        });
        this.errorLogger = new ErrorLogger();
    }
    async getSummary(text) {
        const thread = await this.createThread();
        await this.setMessage({
            thread,
            message: text
        });
        let retryCount = 0;
        let run;
        let last_error;
        while (retryCount < this.maxRetries) {
            try {
                run = await this.runAndWait(thread);
                break;
            }
            catch (error) {
                await delay(60000);
                retryCount++;
                last_error = error;
            }
        }
        if (!run) {
            this.errorLogger.throw({
                message: 'Failed GPT query ' + last_error,
                fun: 'DBController/setSummary',
                apiErrorCode: 101
            });
        }
        const response = await this.getResponse(thread);
        this.deleteThread(thread);
        return response;
    }
    async createThread() {
        return await this.openai.beta.threads.create();
    }
    async deleteThread(thread) {
        await this.openai.beta.threads.del(thread.id);
    }
    async setMessage(messageOptions) {
        messageOptions.role = messageOptions.role ?? "user";
        return await this.openai.beta.threads.messages.create(messageOptions.thread.id, {
            role: messageOptions.role,
            content: messageOptions.message
        });
    }
    async runAndWait(thread) {
        let run = await this.openai.beta.threads.runs.create(thread.id, {
            assistant_id: this.assistantID
        });
        while (run.status !== "completed") {
            await delay(2000);
            run = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
            if (run.status == "failed") {
                this.errorLogger.throw({
                    message: 'Failed GPT query ' + run.last_error?.message,
                    fun: 'DBController/setSummary',
                    apiErrorCode: 101
                });
            }
        }
        return run;
    }
    async getResponse(thread) {
        const messages = await this.openai.beta.threads.messages.list(thread.id);
        const jsonResponse = messages.data[0].content[0].text.value;
        try {
            return JSON.parse(jsonResponse);
        }
        catch (error) {
            this.errorLogger.throw({
                message: `${error} -> ${jsonResponse}`,
                fun: 'DBController/setSummary',
                apiErrorCode: 100
            });
        }
    }
}

// Type Guards
function isAudioInfo(obj) {
    return obj.phoneNum !== undefined;
}
function isEmailInfo(obj) {
    return obj.email !== undefined;
}
function isContactInfo(obj) {
    return obj.contactID !== undefined;
}

class EmailController {
    errorLogger;
    accessToken;
    constructor(errorLogger = new ErrorLogger(), accessToken = "49ea709218b81b9ccffbf8268f11c68e52a0df39") {
        this.errorLogger = errorLogger;
        this.accessToken = accessToken;
    }
    async getEmail(activitySign) {
        const baseUrl = 'https://fistar.daktela.com/api/v6/activities';
        const url = `${baseUrl}/${activitySign}.json?accessToken=${this.accessToken}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        const { result } = data;
        if (!result.item) {
            return "NOEMAIL";
        }
        const orderNum = getOrderNum(result.item.title);
        return {
            text: result.item.text,
            email: result.item.address,
            orderNum,
            activitySign
        };
    }
}

class AmioController {
    errorLogger;
    headers = {
        accept: 'application/json',
        Authorization: 'Bearer VfNibrk1NFBWsUkOibZsAIM4HvDGBaqGrxZgvizj9UBrM4o2cZs7pNglI9z5Vr4hpKqSRNzBMKDKLY5RQkJrAI3cIP'
    };
    constructor(errorLogger = new ErrorLogger) {
        this.errorLogger = errorLogger;
    }
    // gets 100 contacts
    async getContacts(channelId, offset) {
        const options = { method: 'GET', headers: this.headers };
        const response = await fetch(`https://api.amio.io/v1/channels/${channelId}/contacts?max=100&offset=${offset}`, options);
        const data = await response.json();
        if (response.status !== 200) {
            this.errorLogger.throw({
                message: `Amio API error code: ${data.status.code} message: ${data.status.message} `,
                fun: 'AmioController/getContacts'
            });
        }
        return data;
    }
    // get all available contacts
    async getAllContacts(channelID) {
        let allContacts = new Array();
        let tmp;
        let offset = getAmioOffset(channelID);
        console.log(`Starting channel ${channelID} with offset=${offset}`);
        do {
            tmp = await this.getContacts(channelID, offset);
            offset += 100;
            allContacts = allContacts.concat(tmp);
        } while (tmp.length === 100);
        return allContacts;
    }
    // getting all data about one Contact
    async getContactData(contactId, channelId) {
        const options = { method: 'GET', headers: this.headers };
        const response = await fetch(`https://api.amio.io/v1/channels/${channelId}/contacts/${contactId}/messages`, options);
        const data = await response.json();
        if (response.status !== 200) {
            this.errorLogger.throw({
                message: `Amio API error code: ${data.status.code} message: ${data.status.message} `,
                fun: 'AmioController/getContactData'
            });
        }
        return data;
    }
    async deleteContact(channelID, contactID) {
        const options = { method: 'DELETE', headers: this.headers };
        const response = await fetch(`https://api.amio.io/v1/channels/${channelID}/contacts/${contactID}`, options);
        const data = await response.json();
        if (response.status !== 200) {
            this.errorLogger.throw({
                message: `Amio API error code: ${data.status.code} message: ${data.status.message} `,
                fun: 'AmioController/deleteContact'
            });
        }
    }
}

var server$1 = "dbfistar.database.windows.net";
var user = "fistaradmin";
var password = "KzebAurjB4nIjex95BO67X";
var database = "customer-service";
var options = {
	encrypt: true,
	trustServerCertificate: true
};
var dbconfig = {
	server: server$1,
	user: user,
	password: password,
	database: database,
	options: options
};

class DBController {
    errorLogger;
    config;
    static pool;
    constructor(errorLogger = new ErrorLogger()) {
        this.errorLogger = errorLogger;
        this.config = dbconfig;
        if (!DBController.pool) {
            this.connectPool();
        }
    }
    async connectPool() {
        if (!DBController.pool || !DBController.pool.connected) {
            try {
                DBController.pool = new MSSQL.ConnectionPool(this.config);
                await DBController.pool.connect();
                if (DBController.pool.connected) {
                    console.log('Database connected successfully');
                }
                else {
                    this.errorLogger.throw({
                        message: 'Failed database connection ',
                        fun: 'DBController/connectPool'
                    });
                }
            }
            catch (error) {
                this.errorLogger.throw({
                    message: 'Failed database connection ' + error,
                    fun: 'DBController/connectPool'
                });
            }
        }
    }
}

class CallDBController extends DBController {
    async setSource(content, objInfo) {
        if (!isAudioInfo(objInfo)) {
            return;
        }
        try {
            if (!DBController.pool.connected) {
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
                .query(transcriptQuery);
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed database query ' + error,
                fun: 'DBController/setRecord'
            });
        }
    }
    async setSummary(gptOut, objInfo) {
        if (!isAudioInfo(objInfo)) {
            return;
        }
        try {
            if (!DBController.pool.connected) {
                this.connectPool();
            }
            const query = "INSERT INTO dbo.callSummary VALUES (@activitySign, @summary, @topic, @resolve)";
            const result = await DBController.pool.request()
                .input('activitySign', MSSQL.VarChar, objInfo.activitySign)
                .input('summary', MSSQL.VarChar, gptOut.summary)
                .input('topic', MSSQL.VarChar, gptOut.topic)
                .input('resolve', MSSQL.VarChar, gptOut.resolve)
                .query(query);
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed database connection ' + error,
                fun: 'DBController/setSummary'
            });
        }
    }
}

class EmailDBController extends DBController {
    async setSource(content, objInfo) {
        if (!isEmailInfo(objInfo)) {
            return;
        }
        console.log('inserting');
        try {
            if (!DBController.pool.connected) {
                this.connectPool();
            }
            const query = "INSERT INTO dbo.emailRecords VALUES (@activitySign, @record)";
            const result = await DBController.pool.request()
                .input('activitySign', MSSQL.VarChar, objInfo.activitySign)
                .input('record', MSSQL.VarChar, content)
                .query(query);
            console.log("🚀 ~ EmailDBController ~ setSource ~ result:", result);
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed database insertion ' + error,
                fun: 'amioDBController/setSummary'
            });
        }
        console.log("🚀 ~ EmailDBController ~ setSource ~ content:", content);
        console.log("🚀 ~ EmailDBController ~ setSource ~ objInfo.activitySign:", objInfo.activitySign);
    }
    async setSummary(gptOut, objInfo) {
        if (!isEmailInfo(objInfo)) {
            return;
        }
        try {
            const currentDate = new Date();
            const adjustedDate = new Date(currentDate.getTime() + 2 * 60 * 60 * 1000);
            if (!DBController.pool.connected) {
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
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed database insertion ' + error,
                fun: 'amioDBController/setSummary'
            });
        }
        console.log("🚀 ~ EmailDBController ~ setSummary ~ objInfo.activitySign:", objInfo.activitySign);
    }
}

class AmioDBController extends DBController {
    async setSource(content, objInfo) {
        try {
            if (!DBController.pool.connected) {
                this.connectPool();
            }
            if (!isContactInfo(objInfo)) {
                return;
            }
            const query = "INSERT INTO dbo.amioRecords VALUES (@contactID, @channelID, @record)";
            const result = await DBController.pool.request()
                .input('contactID', MSSQL.VarChar, objInfo.contactID)
                .input('channelID', MSSQL.VarChar, objInfo.channelID)
                .input('record', MSSQL.VarChar, content)
                .query(query);
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed database insertion ' + error,
                fun: 'amioDBController/setSource'
            });
        }
    }
    async setSummary(gptOut, objInfo) {
        try {
            if (!DBController.pool.connected) {
                this.connectPool();
            }
            if (!isContactInfo(objInfo)) {
                return;
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
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed database insertion ' + error,
                fun: 'amioDBController/setSummary'
            });
        }
    }
    async getAmioRecord(contactID) {
        try {
            if (!DBController.pool.connected) {
                this.connectPool();
            }
            const selQuery = `SELECT record FROM dbo.amioRecords WHERE contactID = ${contactID}`;
            const result = await DBController.pool.request().query(selQuery);
            return result.recordset[0].record;
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed database request ' + error,
                fun: 'AmioDBController/getAmioRecord'
            });
        }
    }
    async deleteAmioRecord(ids) {
        try {
            if (!DBController.pool.connected) {
                this.connectPool();
            }
            const delQuery = `DELETE FROM dbo.amioRecords WHERE contactID = ${ids.contactID} AND channelID = ${ids.channelID}`;
            const delResult = await DBController.pool.request().query(delQuery);
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed deletion of amioSummary from DB ' + error,
                fun: 'AmioDBController/deleteAmioRecord'
            });
        }
    }
    async deleteAmioSummary(ids) {
        try {
            this.connectPool();
            const delQuery = `DELETE FROM dbo.amioSummary WHERE contactID = ${ids.contactID} AND channelID = ${ids.channelID}`;
            const delResult = await DBController.pool.request().query(delQuery);
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed deletion of amioSummary from DB ' + error,
                fun: 'AmioDBController/deleteAmioSummary'
            });
        }
    }
    // Getting all contacts from amio chatbot
    async getAllContacts() {
        try {
            this.connectPool();
            const query = "SELECT contactID FROM dbo.amioRecords";
            const result = await DBController.pool.request().query(query);
            return result.recordset;
        }
        catch (error) {
            this.errorLogger.throw({
                message: 'Failed database select ' + error,
                fun: 'AmioDBController/getAllContacts'
            });
            return [];
        }
    }
}

class Manager {
    callController;
    transcribeController;
    callDBController;
    emailDBController;
    amioDBController;
    callGptController;
    emailGptController;
    amioGptController;
    emailController;
    amioController;
    constructor(callController = new CallController(), transcribeController = new TranscribeController(), callDBController = new CallDBController(), emailDBController = new EmailDBController(), amioDBController = new AmioDBController(), callGptController = new GptController('asst_nwoScC0Sbb12eHELyB7lSMVS'), emailGptController = new GptController('asst_SW7CNjymEmkuzYyF7T6gHcdQ'), amioGptController = new GptController('asst_QXUsnSAtap5zoWJPWogjA3do'), emailController = new EmailController(), amioController = new AmioController()) {
        this.callController = callController;
        this.transcribeController = transcribeController;
        this.callDBController = callDBController;
        this.emailDBController = emailDBController;
        this.amioDBController = amioDBController;
        this.callGptController = callGptController;
        this.emailGptController = emailGptController;
        this.amioGptController = amioGptController;
        this.emailController = emailController;
        this.amioController = amioController;
    }
    async hadleContactData(id, knownContacts, channelID) {
        let mergeData;
        if (knownContacts.has(id)) {
            let [knownData, newData] = await Promise.all([
                this.amioDBController.getAmioRecord(id),
                this.amioController.getContactData(id, channelID)
            ]);
            newData = modifyContactData(newData);
            if (!newData.received) {
                console.log("skipped");
                return "";
            }
            mergeData = JSON.stringify(newData) + knownData;
            this.amioDBController.deleteAmioRecord({ contactID: id, channelID });
            this.amioDBController.deleteAmioSummary({ contactID: id, channelID });
        }
        else {
            let newData = modifyContactData(await this.amioController.getContactData(id, channelID));
            if (!newData.received) {
                console.log("skipped");
                return "";
            }
            mergeData = JSON.stringify(newData);
        }
        this.amioDBController.setSource(mergeData, { contactID: id, channelID: channelID });
        return mergeData;
    }
    async callHandler(activitySign) {
        const [audioRecord, audioInfo] = await Promise.all([
            this.callController.getAudio(activitySign),
            this.callController.getAudioInfo(activitySign)
        ]);
        // Sent to transcriptor & wait for webhook
        if (audioRecord.byteLength > 42_000) {
            const givenOrderId = await this.transcribeController.transcribe(Buffer.from(audioRecord), audioInfo);
            const body = await this.transcribeController.retrieveTranscript(givenOrderId);
            this.transcribeAndSummaryHandler(body);
        }
        else {
            console.log(`call: ${audioInfo.activitySign} was ditched`);
        }
    }
    async transcribeAndSummaryHandler(body) {
        //const transcript = body.content;
        const jsonTranscript = body.data.content.map((obj) => JSON.stringify(obj)).join('\n');
        const audioInfo = await this.callController.getAudioInfo(body.data.filename.split('.')[0].replace(/:/g, '.'));
        audioInfo.web = audioInfo.web.split(' - ')[0];
        this.callDBController.setSource(jsonTranscript, audioInfo);
        const gptOut = await this.callGptController.getSummary(jsonTranscript);
        this.callDBController.setSummary(gptOut, audioInfo);
    }
    async emailHandler(activitySign) {
        const data = await this.emailController.getEmail(activitySign);
        if (typeof data === 'string') {
            console.log(`email: ${activitySign} was ditchet`);
            return;
        }
        this.emailDBController.setSource(data.text, data);
        const gptOut = await this.emailGptController.getSummary(data.text);
        this.emailDBController.setSummary(gptOut, data);
    }
    async proccessAllChannels() {
        // get channel from dev/amioChannels (localhost different from container on server)
        for (const channelID of getAmioChannels()) {
            await this.amioChannelHandler(channelID);
        }
        console.log(`Amio chat extraction is completed`);
    }
    async amioChannelHandler(channelID) {
        // this.amoiController.getContacts('7153353656766318406')
        const knownContacts = new Set((await this.amioDBController.getAllContacts()).map(item => item.contactID));
        const newContacts = await this.amioController.getAllContacts(channelID);
        let newContactData;
        let contactCounter = 0;
        for (const newContact of newContacts) {
            newContactData = await this.hadleContactData(newContact.id, knownContacts, channelID);
            contactCounter++;
            if (newContactData === "") {
                continue;
            }
            // GPT
            let gptOut;
            try {
                gptOut = await this.amioGptController.getSummary(newContactData);
            }
            catch (error) {
                if (error.apiErrorCode === 100) {
                    await delay(1000);
                    continue;
                }
                else {
                    throw error;
                }
            }
            if (gptOut) {
                gptOut.orderNum = getOrderNum(gptOut.orderNum);
                this.amioDBController.setSummary(gptOut, { contactID: newContact.id, channelID: channelID });
                console.log("done " + newContact.id);
                await delay(1000);
            }
            //await this.amioController.deleteContact('7153353656766318406', newContact.id)
        }
        increaseAmioOffset(contactCounter, channelID);
        console.log(`Amio chat extraction for channel ${channelID} is completed`);
    }
}

process.on('uncaughtException', err => {
    console.error(err);
});
const server = new Koa();
const router = new Router();
const errorLogger = new ErrorLogger();
const manager = new Manager();
server.use(async (ctx, next) => {
    try {
        await next();
        const rt = ctx.response.get('X-Response-Time');
        console.log(`${ctx.method} ${ctx.url} - ${rt}`);
    }
    catch (ex) {
        const appError = ApplicationError.wrap(ex);
        ctx.status = appError.httpStatusCode;
        ctx.body = appError.toJSON();
        if (appError.httpStatusCode >= 500) {
            console.error(`Internal error:\n${appError}`);
        }
        else {
            console.debug(`Request error:\n${appError}`);
        }
    }
});
router.get('/getAmioChats', async (ctx) => {
    manager.proccessAllChannels();
});
router.get('/getEmail', async (ctx) => {
    const { activity } = ctx.query;
    console.log(ctx.query);
    console.log(ctx);
    console.log("toto je vystup", activity);
    if (!activity) {
        errorLogger.throw({
            message: "Email Not Found",
            fun: '/getEmail'
        });
    }
    manager.emailHandler(activity);
});
// Webhook for Transcriptor
router.post('/transcript', async (ctx) => {
    ctx.request;
    manager.transcribeAndSummaryHandler(ctx.request.body);
});
// Webhook for Daktela call
router.get('/getCall', async (ctx) => {
    const { call } = ctx.query;
    console.log(ctx.query);
    console.log(ctx);
    console.log("toto je vystup", call);
    if (!call) {
        errorLogger.throw({
            message: "Call Not Found",
            fun: '/getCall'
        });
    }
    manager.callHandler(call);
});
server.use(bodyParser());
server.use(router.routes());
server.use(router.allowedMethods());
server.listen(3000, '0.0.0.0');
