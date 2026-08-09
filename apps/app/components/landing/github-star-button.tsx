"use client";

import GitHubLogo from "@crm/ui/components/brand-logos/github";
import { Button } from "@crm/ui/components/button";
import { type CtaLocation, captureLanding } from "./analytics";
import { REPO_URL } from "./links";

export function GitHubStarButton({ location }: { location: CtaLocation }) {
	return (
		<Button variant="outline-ghost" size="xl" asChild>
			<a
				href={REPO_URL}
				target="_blank"
				rel="noreferrer"
				onClick={() => captureLanding("github_star_clicked", location)}
			>
				<GitHubLogo data-icon="inline-start" className="size-[15px]" />
				Star on GitHub
			</a>
		</Button>
	);
}

