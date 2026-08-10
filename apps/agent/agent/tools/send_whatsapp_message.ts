import { defineTool } from "eve/tools";
import { z } from "zod";

const WHATSAPP_BOT_URL = process.env.WHATSAPP_BOT_URL ?? "";
const WHATSAPP_BOT_SECRET = process.env.WHATSAPP_BOT_SECRET ?? "";

const WHATSAPP_UNAVAILABLE = {
	sent: false,
	note: "WhatsApp send is not configured on this install (WHATSAPP_BOT_URL / WHATSAPP_BOT_SECRET are unset). Nothing was delivered.",
};

export default defineTool({
	description:
		"Send a WhatsApp text message to a phone number via the Happy Hunter bot. The recipient must be an E.164 style MSISDN, digits with no leading '+' (e.g. '27601016673'). Use when a rep asks you to WhatsApp someone, or as the delivery step of a follow-up the CRM says is due. Only call with a number the CRM record already shows — never invent one.",
	inputSchema: z.object({
		phone: z
			.string()
			.regex(/^\d{7,15}$/)
			.describe(
				"The recipient's WhatsApp number, digits only, no '+': '27601016673'.",
			),
		text: z.string().min(1).max(4096).describe("The plain-text body to send."),
		note: z
			.string()
			.optional()
			.describe("Why this message is going out — shown to a rep."),
	}),
	async execute({ phone, text }) {
		if (!WHATSAPP_BOT_URL || !WHATSAPP_BOT_SECRET) {
			return WHATSAPP_UNAVAILABLE;
		}

		try {
			const response = await fetch(WHATSAPP_BOT_URL, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-crm-bot-secret": WHATSAPP_BOT_SECRET,
				},
				body: JSON.stringify({ to: phone, text }),
				signal: AbortSignal.timeout(8_000),
			});

			if (!response.ok) {
				return {
					sent: false,
					note: `The bot refused the send with HTTP ${response.status}. Nothing was delivered.`,
				};
			}

			return { sent: true, note: undefined };
		} catch (error) {
			return {
				sent: false,
				note: `The bot could not be reached: ${error instanceof Error ? error.message : String(error)}. Nothing was delivered.`,
			};
		}
	},
});
