import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import { ApplicationError } from './helpers/ApplicationError';
import { ErrorLogger } from './helpers/ErrorLogger';
import { Manager } from './Manager';

process.on('uncaughtException', err => {
	console.error(err);
})

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
	manager.proccessAllChannels()
})


router.get('/getEmail', async (ctx) => {
	const { activity }  = ctx.query;
	console.log(ctx.query)
	console.log(ctx)
	console.log("toto je vystup" ,activity)

	if (!activity){
		errorLogger.throw({
			message: "Email Not Found",
			fun: '/getEmail'
		});
	}
	manager.emailHandler(activity as string)
})

// Webhook for Transcriptor
router.post('/transcript', async (ctx) => {
	const { body } = ctx.request as any;
	manager.transcribeAndSummaryHandler(ctx.request.body);
})

// Webhook for Daktela call
router.get('/getCall', async (ctx) => {
	const {call} = ctx.query;
	console.log(ctx.query)
	console.log(ctx)
	console.log("toto je vystup" ,call)
	if (!call){
		errorLogger.throw({
			message: "Call Not Found",
			fun: '/getCall'
		});
	}
	manager.callHandler(call as string);
});


server.use(bodyParser());
server.use(router.routes());
server.use(router.allowedMethods());

server.listen(3000, '0.0.0.0');