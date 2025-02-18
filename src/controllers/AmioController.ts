import { ErrorLogger } from "~/helpers/ErrorLogger"
import { getAmioOffset } from "~/helpers/utils"


export class AmioController{
    private headers = {
      accept: 'application/json',
      Authorization: ''
    }

    public constructor(
      private readonly errorLogger = new ErrorLogger
    ){}

    // gets 100 contacts
    private async getContacts(channelId: string, offset: number): Promise<Array<any>>{
        const options = {method: 'GET', headers: this.headers}
        const response = await fetch(`https://api.amio.io/v1/channels/${channelId}/contacts?max=100&offset=${offset}`, options)
        const data = await response.json()
        if (response.status !== 200){
          this.errorLogger.throw({
            message: `Amio API error code: ${data.status.code} message: ${data.status.message} `,
            fun: 'AmioController/getContacts'
          })
        }
        return data
    }

    // get all available contacts
    public async getAllContacts(channelID: string){
        let allContacts = new Array()
        let tmp
        let offset = getAmioOffset(channelID)
        console.log(`Starting channel ${channelID} with offset=${offset}`)
        do {
            tmp = await this.getContacts(channelID, offset)
            offset += 100
            allContacts = allContacts.concat(tmp)
        }while(tmp.length === 100)

        return allContacts
        
    }

    // getting all data about one Contact
    public async getContactData(contactId: string, channelId: string){
      const options = {method: 'GET', headers: this.headers}
        const response = await fetch(`https://api.amio.io/v1/channels/${channelId}/contacts/${contactId}/messages`, options)
        const data = await response.json()
        if (response.status !== 200){
          this.errorLogger.throw({
            message: `Amio API error code: ${data.status.code} message: ${data.status.message} `,
            fun: 'AmioController/getContactData'
          })
        }
        return data
    }

    public async deleteContact(channelID: string, contactID: string){
        const options = {method: 'DELETE', headers: this.headers}
        const response = await fetch(`https://api.amio.io/v1/channels/${channelID}/contacts/${contactID}`, options)
        const data = await response.json()
        if (response.status !== 200){
          this.errorLogger.throw({
            message: `Amio API error code: ${data.status.code} message: ${data.status.message} `,
            fun: 'AmioController/deleteContact'
          })
        }
    }

    
}