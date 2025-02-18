import { ApplicationError } from "./ApplicationError";
import * as fs from 'fs'

export function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

export function getCountry(phoneNum: string): string {
    const coutryCode: any = {
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

export function getOrderNum(s: string | undefined){
    if (!s){return "undefined"}
    const orderNum = s.replace(/[^0-9]/g, '');
    return orderNum ? orderNum : "undefined"
}

export function modifyContactData(contactData: Array<any>){
    let modified = new Array()
    if (!contactData[contactData.length-1]){
        return {
            timeStamp: "",
            received: false,
            data: modified
        }
    }
    const timeStamp = contactData[contactData.length-1].sent
    let received = false
    contactData.forEach(item => {
        if (item.direction === 'received'){
            received = true
        }
        let modItem = {
            direction: item.direction,
            content: item.content.payload
        }
        modified.push(modItem)
    })
    return {
        timeStamp,
        received,
        data: modified
    }

}

export function getAmioOffset(channelID: string){
    const path = `./dev/amioOffsets/${channelID}`
    if (!fs.existsSync(path)) {
        return 0
    }
    const offset = fs.readFileSync(path, 'utf-8')
    return Number(offset)
}

export function increaseAmioOffset(counter: number, channelID: string){
    const path = `./dev/amioOffsets/${channelID}`
    const oldOffset = getAmioOffset(channelID)
    fs.writeFileSync(path, String(oldOffset + counter), 'utf-8')
}

export function getAmioChannels(){
    const path = `./dev/amioChannels`
    const channels = fs.readFileSync(path, 'utf-8').split('\n')
    console.log(channels)
    return channels
}