import type * as React from "react";

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={512}
		height={512}
		viewBox="0 0 512 512"
		fill="none"
		{...props}
		aria-label="Smart Marketing Logo"
	>
		<circle cx={256} cy={256} r={200} stroke="currentColor" strokeWidth={36} />
		<circle cx={256} cy={256} r={118} stroke="currentColor" strokeWidth={22} />
		<circle cx={256} cy={256} r={40} fill="currentColor" />
	</svg>
);
export default Logo;
