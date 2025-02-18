import { ErrorLogger } from "~/helpers/ErrorLogger";
import { EmailInfo } from "~/helpers/types";
import { getOrderNum } from "~/helpers/utils";

export class EmailController{
    public constructor(
		private readonly errorLogger = new ErrorLogger(),
		private readonly accessToken = "0"
	) { }

    public async getEmail(activitySign: string): Promise<EmailInfo | string>{
        const baseUrl = 'https://fistar.daktela.com/api/v6/activities';
		const url = `${baseUrl}/${activitySign}.json?accessToken=${this.accessToken}`;

		const response = await fetch(url, {
			method: "GET",
			headers: {
				'Content-Type': 'application/json'
			}
		});

        const data = await response.json();
		const { result } = data
        if(!result.item){
            return "NOEMAIL"
        }
        const orderNum = getOrderNum(result.item.title)

        return {
            text: result.item.text,
            email: result.item.address,
            orderNum,
            activitySign
        }
    }
}