"use client";

import { useEffect, useState } from "react";
import { CONSENT_OPEN_EVENT, getConsent, setConsent } from "@/lib/consent";

/** First-party cookie banner. No vendor request happens until Accept. */
export function CookieConsent() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		setVisible(getConsent() === null);
		const open = () => setVisible(true);
		document.addEventListener(CONSENT_OPEN_EVENT, open);
		return () => document.removeEventListener(CONSENT_OPEN_EVENT, open);
	}, []);

	const choose = (choice: "accepted" | "declined") => {
		setConsent(choice);
		setVisible(false);
	};

	if (!visible) return null;

	return (
		<div
			role="dialog"
			aria-live="polite"
			aria-label="Cookie consent"
			className="fixed bottom-4 left-4 right-4 z-[100] rounded-xl border border-border bg-background p-5 text-foreground shadow-2xl sm:left-auto sm:max-w-md"
		>
			<p className="text-sm font-semibold">We value your privacy</p>
			<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
				Strictly necessary cookies keep the CRM working. Product analytics stays off until you accept.
			</p>
			<div className="mt-4 flex gap-2">
				<button
					type="button"
					onClick={() => choose("accepted")}
					className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-xs font-bold text-background transition hover:opacity-90"
				>
					Accept
				</button>
				<button
					type="button"
					onClick={() => choose("declined")}
					className="flex-1 rounded-lg border border-border px-4 py-2.5 text-xs font-bold transition hover:bg-muted"
				>
					Decline
				</button>
			</div>
		</div>
	);
}

export function CookieSettingsButton() {
	return (
		<button
			type="button"
			onClick={() => document.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
			className="text-left text-[13px]/6 text-muted-foreground transition-colors hover:text-foreground"
		>
			Cookie settings
		</button>
	);
}
