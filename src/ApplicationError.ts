import { STATUS_CODES } from 'node:http';

export enum ApiErrorCode {
	UNKNOWN,
	MODEL_INVALID,
	PATH_PARAM_INVALID,
	NOT_FOUND,
	BAD_CREDENTIALS,
	ACCESS_DENIED,
	AUTH_INVALID,
	AUTH_EXPIRED,
	ALREADY_EXISTS
}

export interface ApplicationErrorOptions {
	readonly apiErrorCode?: ApiErrorCode;
	readonly innerError?: Error;
	readonly privateMessage?: string;
	readonly publicMessage?: string;
	readonly httpStatusCode?: number;
}

export class ApplicationError extends Error {
	public readonly apiErrorCode: ApiErrorCode;
	public readonly httpStatusCode: number;
	public readonly innerError?: Error;
	public readonly publicMessage: string;

	private readonly isApplicationError = true;

	public constructor(options: ApplicationErrorOptions = {}) {
		const apiErrorCode = options.apiErrorCode ?? ApiErrorCode.UNKNOWN;

		const httpStatusCode = options.httpStatusCode ?? 500;
		const publicMessage = options.publicMessage ?? STATUS_CODES[httpStatusCode] ?? STATUS_CODES[500]!;

		super(`[E_${ApiErrorCode[apiErrorCode]}]: ${publicMessage} ${options.privateMessage ?? ''}`);
		this.apiErrorCode = apiErrorCode;
		this.httpStatusCode = httpStatusCode;
		this.innerError = options.innerError;
		this.publicMessage = publicMessage;
	}

	public toString() {
		return this.innerError
			? `${this.message}\n\n${this.innerError.stack ?? this.innerError}`
			: '' + (this.stack ?? this);
	}

	public toJSON() {
		return {
			code: ApiErrorCode[this.apiErrorCode],
			message: this.publicMessage
		};
	}

	public static isApplicationError(ex: unknown): ex is ApplicationError {
		return ex !== null && typeof ex === 'object' && (ex as { isApplicationError?: true }).isApplicationError === true;
	}

	public static wrap(ex: unknown, options: Omit<ApplicationErrorOptions, 'innerError'> = {}) {
		return ApplicationError.isApplicationError(ex)
			? ex
			: new ApplicationError({
				...options,
				innerError: ex instanceof Error ? ex : undefined
			});
	}
}
