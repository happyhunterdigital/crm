/**
 * First-party consent store for happyhunterdigital projects.
 *
 * Nothing optional (analytics, pixels, marketing tags, session replay) may
 * load before the visitor accepts.
 */
export const CONSENT_KEY = "hh-cookie-consent";
export const CONSENT_EVENT = "hh:consent-change";
export const CONSENT_OPEN_EVENT = "hh:open-consent";

export type ConsentChoice = "accepted" | "declined" | null;

function normalise(value: string | null): ConsentChoice {
	if (!value) return null;
	if (value === "accepted" || value === "declined") return value;
	if (value === "true" || value === "all") return "accepted";
	if (value === "false" || value === "essential") return "declined";
	try {
		const parsed = JSON.parse(value) as { value?: string; choice?: string };
		const inner = parsed?.value ?? parsed?.choice;
		if (inner === "accepted" || inner === "all" || inner === "true") return "accepted";
		if (inner === "declined" || inner === "essential" || inner === "false") return "declined";
	} catch {
		/* not JSON */
	}
	return null;
}

export function getConsent(): ConsentChoice {
	if (typeof window === "undefined") return null;
	try {
		return normalise(window.localStorage.getItem(CONSENT_KEY));
	} catch {
		/* storage blocked */
	}
	return null;
}

export function hasConsent(): boolean {
	return getConsent() === "accepted";
}

export function setConsent(choice: "accepted" | "declined"): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ value: choice, ts: Date.now() }));
	} catch {
		/* storage blocked: choice applies to this page view */
	}
	window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
	document.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
}

export function onConsentChange(listener: (choice: ConsentChoice) => void): () => void {
	if (typeof window === "undefined") return () => {};
	const handler = (event: Event) => {
		const detail = (event as CustomEvent<ConsentChoice>).detail;
		listener(detail ?? getConsent());
	};
	const storageHandler = (event: StorageEvent) => {
		if (event.key === CONSENT_KEY) listener(getConsent());
	};
	window.addEventListener(CONSENT_EVENT, handler);
	window.addEventListener("storage", storageHandler);
	return () => {
		window.removeEventListener(CONSENT_EVENT, handler);
		window.removeEventListener("storage", storageHandler);
	};
}
