import { deepEqual, throws } from "node:assert";
import { describe, it } from "node:test";
import { parseAllow, parseHeader } from "../src/lib.ts";
import type { ParsedAllowValue, ParsedHeaderValue } from "../src/lib.ts";

describe("parseAllow", () => {
	const c = (m: Record<string, "*" | false | string[]>): ParsedAllowValue => {
		return new Map(
			Object.entries(m).map(([k, v]) => [k, Array.isArray(v) ? new Set(v) : v]),
		);
	};

	it("empty", () => {
		deepEqual(parseAllow(""), c({}));
		deepEqual(parseAllow(";"), c({}));
	});

	it("simple - single policy", () => {
		deepEqual(parseAllow("fullscreen"), c({ fullscreen: [] }));
		deepEqual(parseAllow("fullscreen;"), c({ fullscreen: [] }));
	});

	it("simple - multiple policies", () => {
		deepEqual(
			parseAllow("fullscreen; geolocation"),
			c({ fullscreen: [], geolocation: [] }),
		);
		deepEqual(
			parseAllow("fullscreen; geolocation;"),
			c({ fullscreen: [], geolocation: [] }),
		);
		deepEqual(
			parseAllow("fullscreen;geolocation;"),
			c({ fullscreen: [], geolocation: [] }),
		);
		deepEqual(
			parseAllow("  fullscreen;    geolocation;  "),
			c({ fullscreen: [], geolocation: [] }),
		);
	});

	it("with allow lists", () => {
		deepEqual(parseAllow("fullscreen *"), c({ fullscreen: "*" }));
		deepEqual(parseAllow(`fullscreen * 'self'`), c({ fullscreen: "*" }));
		deepEqual(parseAllow(`fullscreen 'self'`), c({ fullscreen: [`'self'`] }));
		deepEqual(parseAllow(`fullscreen 'src'`), c({ fullscreen: [`'src'`] }));
		deepEqual(parseAllow(`fullscreen 'none'`), c({ fullscreen: false }));
		deepEqual(
			parseAllow(`fullscreen 'self' 'none';`),
			c({ fullscreen: false }),
		);
	});

	it("with allow lists containing origins", () => {
		deepEqual(
			parseAllow(
				`fullscreen 'self' https://www.example.com:3000 https://www.example.com https://www.example.org/foo;`,
			),
			c({
				fullscreen: [
					`'self'`,
					"https://www.example.com:3000",
					"https://www.example.com",
					"https://www.example.org",
				],
			}),
		);
	});
});

describe("parseHeader", () => {
	const c = (m: Record<string, "*" | false | string[]>): ParsedHeaderValue => {
		return new Map(
			Object.entries(m).map(([k, v]) => [k, Array.isArray(v) ? new Set(v) : v]),
		);
	};

	it("empty", () => {
		deepEqual(parseHeader(""), c({}));
	});

	it("invalid", () => {
		throws(() => parseHeader(","));
		throws(() => parseHeader("()"));
		throws(() => parseHeader("fullscreen"));
	});

	it("simple - single policy", () => {
		deepEqual(parseHeader("fullscreen=*"), c({ fullscreen: "*" }));
		deepEqual(parseHeader("fullscreen=self"), c({ fullscreen: [`'self'`] }));
		deepEqual(parseHeader("fullscreen=none"), c({ fullscreen: false }));
		deepEqual(
			parseHeader("fullscreen=https://www.example.com:443"),
			c({ fullscreen: ["https://www.example.com"] }),
		);
	});

	it("simple - multiple policies", () => {
		deepEqual(
			parseHeader("fullscreen=(),geolocation=()"),
			c({ fullscreen: false, geolocation: false }),
		);
		deepEqual(
			parseHeader("fullscreen=(self),geolocation=()"),
			c({ fullscreen: [`'self'`], geolocation: false }),
		);
	});

	it("with inner lists", () => {
		deepEqual(parseHeader("fullscreen=()"), c({ fullscreen: false }));
		deepEqual(parseHeader("fullscreen=(*)"), c({ fullscreen: "*" }));
		deepEqual(parseHeader("fullscreen=(self)"), c({ fullscreen: [`'self'`] }));
		deepEqual(parseHeader("fullscreen=(none)"), c({ fullscreen: false }));
		deepEqual(
			parseHeader("fullscreen=(self),bluetooth=()"),
			c({ fullscreen: [`'self'`], bluetooth: false }),
		);
	});

	it("with inner lists containing origins", () => {
		deepEqual(
			parseHeader('fullscreen=("https://www.example.com:443")'),
			c({ fullscreen: ["https://www.example.com"] }),
		);
		deepEqual(
			parseHeader(
				'fullscreen=(self "https://www.example.com:443" "https://www.example.org")',
			),
			c({
				fullscreen: [
					`'self'`,
					"https://www.example.com",
					"https://www.example.org",
				],
			}),
		);
	});
});
