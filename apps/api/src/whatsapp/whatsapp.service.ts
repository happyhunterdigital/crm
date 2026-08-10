import { type Db, RecordSource } from "@crm/db";
import {
	BadRequestException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import type { EnvironmentVariables } from "../config/env.validation";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { InjectDatabase } from "../database/database.constants";

export type WhatsAppIngestInput = {
	phone: string;
	name?: string | null;
	text: string;
	direction: "inbound" | "outbound";
	externalMessageId?: string | null;
	timestamp?: string | number | null;
};

export type WhatsAppIngestResult = {
	ok: true;
	contactId: string;
	activityId: string;
	contactCreated: boolean;
	skippedAsDuplicate?: boolean;
};

export type WhatsAppSendInput = {
	to: string;
	text: string;
};

const BOT_TIMEOUT_MS = 8_000;

@Injectable()
export class WhatsappService {
	private readonly logger = new Logger(WhatsappService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly stamp: ActivityStampService,
		private readonly agentTrigger: AgentTriggerService,
		private readonly config: ConfigService<EnvironmentVariables, true>,
	) {}

	async ingest(
		event: WhatsAppIngestInput,
	): Promise<WhatsAppIngestResult | { ok: true; skipped: "empty" }> {
		const text = event.text?.trim() ?? "";
		if (!text && !event.externalMessageId) {
			return { ok: true, skipped: "empty" };
		}

		const phone = normalizePhone(event.phone);
		if (!phone) return { ok: true, skipped: "empty" };

		if (event.externalMessageId) {
			const existing = await this.db.activity.findFirst({
				where: {
					meta: {
						path: ["externalMessageId"],
						equals: event.externalMessageId,
					},
				},
				select: { id: true, contactId: true },
			});

			if (existing) {
				return {
					ok: true,
					contactId: existing.contactId ?? "",
					activityId: existing.id,
					contactCreated: false,
					skippedAsDuplicate: true,
				};
			}
		}

		const existing = await this.findContactByPhone(phone);
		let contactCreated = false;

		const contact =
			existing ??
			(await this.db.contact.create({
				data: {
					firstName: event.name?.trim() || "WhatsApp contact",
					lastName: null,
					phone,
					source: RecordSource.IMPORT,
				},
				select: { id: true, ownerId: true, companyId: true },
			}));

		if (!existing) contactCreated = true;

		const direction = event.direction === "outbound" ? "outbound" : "inbound";

		const activity = await this.db.activity.create({
			data: {
				type: "NOTE",
				subject:
					direction === "inbound"
						? `WhatsApp message from ${phone}`
						: `WhatsApp message to ${phone}`,
				body: text || null,
				occurredAt: resolveTimestamp(event.timestamp),
				companyId: contact.companyId ?? null,
				contactId: contact.id,
				createdById: await this.authorFor(contact),
				meta: {
					channel: "whatsapp",
					direction,
					automated: true,
					...(event.externalMessageId
						? { externalMessageId: event.externalMessageId }
						: {}),
				},
			},
			select: { id: true, createdAt: true },
		});

		await this.stamp.touch(
			{ companyId: contact.companyId, contactId: contact.id },
			activity.createdAt,
		);

		if (contactCreated) {
			await this.agentTrigger.contactCreated(
				contact.id,
				`Inbound WhatsApp message from ${phone}`,
			);
		}

		this.logger.log({
			message: "WhatsApp message ingested",
			contactId: contact.id,
			direction,
			contactCreated,
		});

		return {
			ok: true,
			contactId: contact.id,
			activityId: activity.id,
			contactCreated,
		};
	}

	async send(input: WhatsAppSendInput): Promise<{ ok: true }> {
		const botUrl = this.config.get("WHATSAPP_BOT_URL", { infer: true });
		const botSecret = this.config.get("WHATSAPP_BOT_SECRET", { infer: true });

		if (!botUrl || !botSecret) {
			throw new ServiceUnavailableException(
				"WHATSAPP_BOT_URL / WHATSAPP_BOT_SECRET are not configured.",
			);
		}

		const to = normalizePhone(input.to);
		const text = input.text?.trim() ?? "";
		if (!to || !text) {
			throw new BadRequestException("A phone number and text are required.");
		}

		const response = await fetch(botUrl, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-crm-bot-secret": botSecret,
			},
			body: JSON.stringify({ to, text }),
			signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
		});

		if (!response.ok) {
			this.logger.error({
				message: "Bot send failed",
				status: response.status,
			});
			throw new ServiceUnavailableException(
				"The WhatsApp bot rejected the send request.",
			);
		}

		this.logger.log({ message: "WhatsApp message handed to bot", to });

		return { ok: true };
	}

	private async findContactByPhone(phone: string) {
		const candidates = phoneCandidates(phone);
		return this.db.contact.findFirst({
			where: { phone: { in: candidates } },
			select: { id: true, ownerId: true, companyId: true },
		});
	}

	private async authorFor(contact: {
		ownerId: string | null;
	}): Promise<string> {
		if (contact.ownerId) return contact.ownerId;

		const user = await this.db.user.findFirst({ select: { id: true } });
		if (!user) {
			throw new ServiceUnavailableException(
				"No user exists to author the activity.",
			);
		}
		return user.id;
	}
}

export function normalizePhone(raw: string): string {
	return raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function phoneCandidates(phone: string): string[] {
	const candidates = new Set([phone, `+${phone}`]);
	if (phone.startsWith("27")) {
		candidates.add(`0${phone.slice(2)}`);
		candidates.add(`+0${phone.slice(2)}`);
	}
	if (phone.startsWith("0")) {
		candidates.add(`27${phone.slice(1)}`);
		candidates.add(`+27${phone.slice(1)}`);
	}
	return [...candidates];
}

function resolveTimestamp(value: string | number | null | undefined): Date {
	if (typeof value === "number") return new Date(value * 1000);
	if (typeof value === "string") {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	return new Date();
}
