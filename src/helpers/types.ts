import OpenAI from "openai"
import { Audio } from "openai/resources/index.mjs"
import { type } from "os"

export interface AudioInfo{
    readonly activitySign: string,
    readonly countryCode: string,
    readonly phoneNum: string,
    web: string,
    orderNum: string
}

export interface MessageOptions{
    thread:  OpenAI.Beta.Threads.Thread,
    message: string,
    role?: "user" | "assistant"
}

export interface GptOutput{
    summary: string,
    topic: string,
    resolve: boolean,
    language?: string,
    date?: string,
    orderNum?: string
}
export interface EmailInfo{
    text: string,
    email: string,
    orderNum: string,
    activitySign: string
}
export interface ContactInfo{
    contactID: string,
    channelID?: string
}

export type SourceInfo = ContactInfo | AudioInfo | EmailInfo

// Type Guards
export function isAudioInfo(obj: any): obj is AudioInfo{
    return (obj as AudioInfo).phoneNum !== undefined;
}

export function isEmailInfo(obj: any): obj is EmailInfo{
    return (obj as EmailInfo).email !== undefined
}
export function isContactInfo(obj: any): obj is ContactInfo{
    return (obj as ContactInfo).contactID !==undefined
}