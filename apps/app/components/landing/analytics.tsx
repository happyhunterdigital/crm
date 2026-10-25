"use client";

import {
	POSTHOG_HOST,
	POSTHOG_KEY,
	POSTHOG_UI_HOST,
} from "@crm/telemetry/project";
import { useEffect, useRef, useState } from "react";
import { analyticsAllowed } from "@/lib/analytics";
import { hasConsent, onConsentChange } from "@/lib/consent";

export type CtaLocation = "hero" | "closing";

export function LandingAnalytics() {
	const [allowed, setAllowed] = useState(false);
	const initialised = useRef(false);

	useEffect(() => {
		const update = () =>
			setAllowed(analyticsAllowed(window.location.hostname) && hasConsent());
		update();
		return onConsentChange(update);
	}, []);

	useEffect(() => {
		if (!allowed || initialised.current) return;
		initialised.current = true;

		import("posthog-js")
			.then(({ default: posthog }) => {
				if (!hasConsent()) return;
				posthog.init(POSTHOG_KEY, {
					api_host: POSTHOG_HOST,
					ui_host: POSTHOG_UI_HOST,
					defaults: "2026-06-25",
				});
			})
			.catch(() => {});
	}, [allowed]);

	return null;
}

export function captureLanding(
	event: "setup_prompt_copied" | "github_star_clicked",
	location: CtaLocation,
): void {
	if (typeof window === "undefined") return;
	if (!analyticsAllowed(window.location.hostname) || !hasConsent()) return;

	import("posthog-js")
		.then(({ default: posthog }) => {
			posthog.capture(event, { cta_location: location });
		})
		.catch(() => {});
}
