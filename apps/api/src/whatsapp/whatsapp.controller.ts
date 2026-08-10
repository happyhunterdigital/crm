import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	Headers,
	Logger,
	Post,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import type { WhatsAppIngestInput, WhatsAppSendInput } from "./whatsapp.service";
import { WhatsappService } from "./whatsapp.service";

@Controller("internal/whatsapp")
export class WhatsappController {
	private readonly logger = new Logger(WhatsappController.name);
	private readonly ingestSecret: string | undefined;

	constructor(
		private readonly whatsapp: WhatsappService,
		private readonly config: ConfigService<EnvironmentVariables, true>,
	) {
		this.ingestSecret = config.get("WHATSAPP_INGEST_SECRET", { infer: true });
	}

	@Post("intake")
	@AllowAnonymous()
	async intake(
		@Headers("x-crm-ingest-secret") header: string | undefined,
		@Body() body: WhatsAppIngestInput,
	) {
		if (!this.ingestSecret) {
			this.logger.error({
				message:
					"WHATSAPP_INGEST_SECRET is not set — refusing the WhatsApp intake.",
			});
			throw new ServiceUnavailableException(
				"WhatsApp intake is not configured.",
			);
		}

		if (!timingSafeEquals(header ?? "", this.ingestSecret)) {
			throw new ForbiddenException();
		}

		if (!body || typeof body.phone !== "string" || !body.phone.trim()) {
			throw new BadRequestException("phone is required.");
		}

		const direction = body.direction === "outbound" ? "outbound" : "inbound";

		return this.whatsapp.ingest({
			phone: body.phone,
			name: typeof body.name === "string" ? body.name : null,
			text: typeof body.text === "string" ? body.text : "",
			direction,
			externalMessageId:
				typeof body.externalMessageId === "string"
					? body.externalMessageId
					: null,
			timestamp: body.timestamp ?? null,
		});
	}

	@Post("send")
	@AllowAnonymous()
	async send(
		@Headers("x-crm-bot-secret") header: string | undefined,
		@Body() body: WhatsAppSendInput,
	) {
		const botSecret = this.config.get("WHATSAPP_BOT_SECRET", { infer: true });
		if (!botSecret || !timingSafeEquals(header ?? "", botSecret)) {
			throw new ForbiddenException();
		}

		return this.whatsapp.send({ to: body?.to ?? "", text: body?.text ?? "" });
	}
}

function timingSafeEquals(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1) {
		mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}

	return mismatch === 0;
}
