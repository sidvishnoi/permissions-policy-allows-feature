import { ok } from "node:assert/strict";
import { describe, it } from "node:test";
import { PermissionsPolicy } from "../src/index.ts";

const OH = "https://sidvishnoi.com";
const OI = "https://example.com";
const OT = "https://www.example.org";

type Origins = typeof OH | typeof OI | typeof OT;
type TestOrigins = null | Origins;

type TestCaseSingleHeader = [
	headerValue: string,
	{ allowed: TestOrigins[]; notAllowed: TestOrigins[] },
	allow?: string,
];
type TestCaseMultipleHeaders<T extends string = "fullscreen" | "bluetooth"> = [
	headerValues: string,
	Record<T, { allowed: TestOrigins[]; notAllowed: TestOrigins[] }>,
	allow?: string,
];

describe("document.featurePolicy.allowsFeature", () => {
	describe("no header", () => {
		it("with defaultAllowlist self", () => {
			const policy = new PermissionsPolicy({
				origin: OH,
				headerValue: "",
				defaultAllowlist: { fullscreen: `'self'` },
			});

			allowed(policy, "fullscreen");
			allowed(policy, "fullscreen", OH);
			notAllowed(policy, "fullscreen", OI);
		});

		it("with defaultAllowlist *", () => {
			const policy = new PermissionsPolicy({
				origin: OH,
				headerValue: "",
				defaultAllowlist: { fullscreen: "*" },
			});
			allowed(policy, "fullscreen");
			allowed(policy, "fullscreen", OH);
			allowed(policy, "fullscreen", OI);
		});
	});

	describe("with header provided, defaultAllowlist self", () => {
		const testCases: TestCaseSingleHeader[] = [
			["*", { allowed: [null, OH, OI], notAllowed: [] }],
			["self", { allowed: [null, OH], notAllowed: [OI] }],
			["(self)", { allowed: [null, OH], notAllowed: [OI] }],
			["()", { allowed: [], notAllowed: [null, OH, OI] }],
			[`"${OH}"`, { allowed: [null, OH], notAllowed: [OI] }],
			[`"${OI}"`, { allowed: [OI], notAllowed: [null, OH] }],
			[`(self "${OI}")`, { allowed: [null, OH, OI], notAllowed: [] }],
		];
		for (const [header, cases] of testCases) {
			it(`Permissions-Policy: fullscreen=${header}`, () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: `fullscreen=${header}`,
					defaultAllowlist: { fullscreen: `'self'` },
				});
				for (const origin of cases.allowed) {
					allowed(policy, "fullscreen", origin ?? undefined);
				}
				for (const origin of cases.notAllowed) {
					notAllowed(policy, "fullscreen", origin ?? undefined);
				}
			});
		}
	});

	describe("with multiple headers provided", () => {
		const testCases: TestCaseMultipleHeaders<"fullscreen" | "bluetooth">[] = [
			[
				"fullscreen=*, bluetooth=*",
				{
					fullscreen: { allowed: [null, OH, OI], notAllowed: [] },
					bluetooth: { allowed: [null, OH, OI], notAllowed: [] },
				},
			],
			[
				"fullscreen=*,bluetooth=()",
				{
					fullscreen: { allowed: [null, OH, OI], notAllowed: [] },
					bluetooth: { allowed: [], notAllowed: [null, OH, OI] },
				},
			],
			[
				"fullscreen=(self),bluetooth=(self)",
				{
					fullscreen: { allowed: [null, OH], notAllowed: [OI] },
					bluetooth: { allowed: [null, OH], notAllowed: [OI] },
				},
			],
			[
				`fullscreen=(self "${OH}"),bluetooth=(self "${OI}")`,
				{
					fullscreen: { allowed: [null, OH], notAllowed: [OI] },
					bluetooth: { allowed: [null, OH, OI], notAllowed: [] },
				},
			],
			[
				`fullscreen=("${OI}"),bluetooth=(self "${OT}")`,
				{
					fullscreen: { allowed: [OI], notAllowed: [null, OH] },
					bluetooth: { allowed: [null, OH], notAllowed: [OI] },
				},
			],
		];

		for (const [header, cases] of testCases) {
			it(`Permissions-Policy: ${header}`, () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: header,
					defaultAllowlist: { fullscreen: `'self'` },
				});

				for (const [feature, expectations] of Object.entries(cases)) {
					for (const origin of expectations.allowed) {
						allowed(policy, feature, origin ?? undefined);
					}
					for (const origin of expectations.notAllowed) {
						notAllowed(policy, feature, origin ?? undefined);
					}
				}
			});
		}
	});
});

describe("same origin - iframe.featurePolicy.allowsFeature", () => {
	const origin = OI;

	describe("no header", () => {
		describe("no allow attribute", () => {
			it("defaultAllowlist self", () => {
				const policy = new PermissionsPolicy({
					origin,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({ allow: "", origin });

				allowed(policy, "fullscreen");
				allowed(policy, "fullscreen", origin);
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OT);
			});

			it("defaultAllowlist *", () => {
				const policy = new PermissionsPolicy({
					origin,
					headerValue: "",
					defaultAllowlist: { fullscreen: "*" },
				}).inherit({ allow: "", origin });

				allowed(policy, "fullscreen");
				allowed(policy, "fullscreen", origin);
				allowed(policy, "fullscreen", OH);
				allowed(policy, "fullscreen", OT);
			});
		});

		describe("allow attribute restricts defaultAllowlist=self", () => {
			it("allow (default empty=src)", () => {
				const policy = new PermissionsPolicy({
					origin,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({ allow: "fullscreen", origin });

				allowed(policy, "fullscreen");
				allowed(policy, "fullscreen", origin);
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OT);
			});

			it("allow=src", () => {
				const policy = new PermissionsPolicy({
					origin,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({ allow: "fullscreen 'src'", origin });

				allowed(policy, "fullscreen");
				allowed(policy, "fullscreen", origin);
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OT);
			});

			it("allow=self", () => {
				const policy = new PermissionsPolicy({
					origin,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({ allow: "fullscreen 'self'", origin });

				allowed(policy, "fullscreen");
				allowed(policy, "fullscreen", origin);
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OT);
			});

			it("allow self and specific origins", () => {
				const policy = new PermissionsPolicy({
					origin,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({
					allow: `fullscreen 'self' ${OT}`,
					origin,
				});

				allowed(policy, "fullscreen");
				allowed(policy, "fullscreen", origin);
				notAllowed(policy, "fullscreen", OH);
				allowed(policy, "fullscreen", OT);
			});
		});
	});

	describe("headers provided", () => {
		describe('allow=""', () => {
			const feature = "fullscreen";
			const testCases: TestCaseSingleHeader[] = [
				["*", { allowed: [null, OI], notAllowed: [OH, OT] }],
				["self", { allowed: [null, OI], notAllowed: [OH, OT] }],
				[`"${OI}"`, { allowed: [null, OI], notAllowed: [OH, OT] }],
				["()", { allowed: [], notAllowed: [null, OI, OH, OT] }],
				[`"${OH}"`, { allowed: [], notAllowed: [null, OI, OH, OT] }],
			];
			for (const [header, exp] of testCases) {
				it(`Permissions-Policy: ${feature}=${header}`, (t) => {
					if (exp.allowed.length + exp.notAllowed.length === 0) {
						t.skip("no expectations");
					}

					const policy = new PermissionsPolicy({
						origin,
						headerValue: `${feature}=${header}`,
						defaultAllowlist: { [feature]: `'self'` },
					}).inherit({ allow: "", origin });

					for (const origin of exp.allowed) {
						allowed(policy, feature, origin ?? undefined);
					}
					for (const origin of exp.notAllowed) {
						notAllowed(policy, feature, origin ?? undefined);
					}
				});
			}
		});

		describe("multiple headers & allow attribute provided", () => {
			type TestCase = [
				name: string,
				headerValue: TestCaseMultipleHeaders["0"],
				allowValue: string,
				expectations: TestCaseMultipleHeaders["1"],
			];
			const testCases: TestCase[] = [
				[
					"no allow attribute, headers allow everything",
					"fullscreen=*,bluetooth=*",
					"",
					{
						fullscreen: { allowed: [null, OI], notAllowed: [OH, OT] },
						bluetooth: { allowed: [null, OI], notAllowed: [OH, OT] },
					},
				],
				[
					"subset of header",
					"fullscreen=*,bluetooth=()",
					"fullscreen *",
					{
						fullscreen: { allowed: [null, OI], notAllowed: [OH, OT] },
						bluetooth: { allowed: [], notAllowed: [null, OI, OH, OT] },
					},
				],
				[
					"header too strict - disallow everything",
					"fullscreen=(),bluetooth=()",
					"fullscreen *; bluetooth 'src'",
					{
						fullscreen: { allowed: [], notAllowed: [null, OI, OH, OT] },
						bluetooth: { allowed: [], notAllowed: [null, OI, OH, OT] },
					},
				],
				[
					"header only allow self, allow as default-empty",
					"fullscreen=(self),bluetooth=(self)",
					"fullscreen; bluetooth",
					{
						fullscreen: { allowed: [null, OI], notAllowed: [OH, OT] },
						bluetooth: { allowed: [null, OI], notAllowed: [OH, OT] },
					},
				],
				[
					"header allow self + 1",
					`fullscreen=(self "${OH}"),bluetooth=(self "${OI}")`,
					"fullscreen; bluetooth",
					{
						fullscreen: { allowed: [null, OI], notAllowed: [OH, OT] },
						bluetooth: { allowed: [null, OI], notAllowed: [OH, OT] },
					},
				],
				[
					"header allow other only",
					`fullscreen=("${OI}"),bluetooth=("${OT}")`,
					"fullscreen; bluetooth",
					{
						fullscreen: { allowed: [null, OI], notAllowed: [OH, OT] },
						bluetooth: { allowed: [], notAllowed: [null, OI, OH, OT] },
					},
				],
				[
					"header allow many, iframe restricts",
					`fullscreen=*,bluetooth=(self "${OI}" "${OT}")`,
					`fullscreen ${OT}; bluetooth ${OI}`,
					{
						fullscreen: { allowed: [], notAllowed: [null, OI, OH, OT] },
						bluetooth: { allowed: [null, OI], notAllowed: [OH, OT] },
					},
				],
			];

			for (const [name, header, allow, cases] of testCases) {
				it(`${name} {Permissions-Policy: ${header} & allow=${allow}}`, (t) => {
					const policy = new PermissionsPolicy({
						origin,
						headerValue: header,
						defaultAllowlist: { fullscreen: `'self'` },
					}).inherit({ allow, origin });

					for (const [feature, exp] of Object.entries(cases)) {
						if (exp.allowed.length + exp.notAllowed.length === 0) {
							t.skip("no expectations");
						}

						for (const origin of exp.allowed) {
							allowed(policy, feature, origin ?? undefined);
						}
						for (const origin of exp.notAllowed) {
							notAllowed(policy, feature, origin ?? undefined);
						}
					}
				});
			}
		});
	});
});

describe("cross origin - iframe.featurePolicy.allowsFeature", () => {
	describe("no header", () => {
		describe("no allow attribute", () => {
			it("defaultAllowlist self", () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({ allow: "", origin: OI });

				notAllowed(policy, "fullscreen");
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OI);
				notAllowed(policy, "fullscreen", OT);
			});

			it("defaultAllowlist *", () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: "",
					defaultAllowlist: { fullscreen: "*" },
				}).inherit({ allow: "", origin: OI });

				notAllowed(policy, "fullscreen");
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OI);
				notAllowed(policy, "fullscreen", OT);
			});
		});

		describe("allow attribute restricts defaultAllowlist=self", () => {
			describe("allow (default empty=src)", () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({ allow: "fullscreen", origin: OI });

				allowed(policy, "fullscreen");
				allowed(policy, "fullscreen", OI);
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OT);
			});

			it("allow=src", () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({ allow: "fullscreen 'src'", origin: OI });

				allowed(policy, "fullscreen");
				allowed(policy, "fullscreen", OI);
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OT);
			});

			it("allow=self", () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({
					allow: "fullscreen 'self'",
					origin: OI,
				});

				notAllowed(policy, "fullscreen");
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OI);
				notAllowed(policy, "fullscreen", OT);
			});

			it("allow self and specific origins", () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: "",
					defaultAllowlist: { fullscreen: `'self'` },
				}).inherit({
					allow: `fullscreen 'self' ${OT}`,
					origin: OI,
				});

				notAllowed(policy, "fullscreen");
				notAllowed(policy, "fullscreen", OH);
				notAllowed(policy, "fullscreen", OI);
				notAllowed(policy, "fullscreen", OT);
			});
		});
	});

	describe("headers provided", () => {
		describe('allow=""', () => {
			const testCases: TestCaseSingleHeader[] = [
				["*", { allowed: [], notAllowed: [null, OI, OH, OT] }],
				["self", { allowed: [], notAllowed: [null, OI, OH, OT] }],
				[`"${OH}"`, { allowed: [], notAllowed: [null, OI, OH, OT] }],
				["()", { allowed: [], notAllowed: [null, OI, OH, OT] }],
				[`"${OI}"`, { allowed: [], notAllowed: [null, OI, OH, OT] }],
			];
			for (const [header, expectations] of testCases) {
				it(`Permissions-Policy: fullscreen=${header}`, () => {
					const policy = new PermissionsPolicy({
						origin: OH,
						headerValue: `fullscreen=${header}`,
						defaultAllowlist: { fullscreen: `'self'` },
					}).inherit({ allow: "", origin: OI });

					for (const origin of expectations.allowed) {
						allowed(policy, "fullscreen", origin ?? undefined);
					}
					for (const origin of expectations.notAllowed) {
						notAllowed(policy, "fullscreen", origin ?? undefined);
					}
				});
			}
		});

		describe("multiple headers & allow attribute provided", () => {
			type TestCase = [
				name: string,
				headerValue: TestCaseMultipleHeaders["0"],
				allowValue: string,
				expectations: TestCaseMultipleHeaders["1"],
			];
			const testCases: TestCase[] = [
				[
					"no allow attribute, headers allow everything",
					"fullscreen=*,bluetooth=*",
					"",
					{
						fullscreen: { allowed: [], notAllowed: [null, OI, OH, OT] },
						bluetooth: { allowed: [], notAllowed: [null, OI, OH, OT] },
					},
				],
				[
					"subset of header",
					"fullscreen=*,bluetooth=()",
					"fullscreen *",
					{
						fullscreen: { allowed: [null, OI], notAllowed: [OH, OT] },
						bluetooth: { allowed: [], notAllowed: [null, OI, OH, OT] },
					},
				],
				[
					"header too strict - disallow everything",
					"fullscreen=(),bluetooth=()",
					"fullscreen *; bluetooth 'src'",
					{
						fullscreen: { allowed: [], notAllowed: [null, OI, OH, OT] },
						bluetooth: { allowed: [], notAllowed: [null, OI, OH, OT] },
					},
				],
				[
					"header only allow self, allow=src",
					"fullscreen=(self),bluetooth=(self)",
					"fullscreen; bluetooth",
					{
						fullscreen: { allowed: [], notAllowed: [null, OI, OH, OT] },
						bluetooth: { allowed: [], notAllowed: [null, OI, OH, OT] },
					},
				],
				[
					"header allow self + 1",
					`fullscreen=(self "${OH}"),bluetooth=(self "${OI}")`,
					"fullscreen; bluetooth",
					{
						fullscreen: { allowed: [], notAllowed: [null, OI, OH, OT] },
						bluetooth: { allowed: [null, OI], notAllowed: [OH, OT] },
					},
				],
				[
					"header allow other only",
					`fullscreen=("${OH}"),bluetooth=("${OT}")`,
					"fullscreen; bluetooth",
					{
						fullscreen: { allowed: [], notAllowed: [null, OI, OH, OT] },
						bluetooth: { allowed: [], notAllowed: [null, OI, OH, OT] },
					},
				],
				[
					"header allow many, iframe restricts",
					`fullscreen=*,bluetooth=(self "${OI}" "${OT}")`,
					`fullscreen ${OT}; bluetooth ${OI}`,
					{
						fullscreen: { allowed: [], notAllowed: [null, OI, OH, OT] },
						bluetooth: { allowed: [null, OI], notAllowed: [OH, OT] },
					},
				],
			];

			for (const [name, header, allow, cases] of testCases) {
				it(`${name} {Permissions-Policy: ${header} & allow=${allow}}`, (t) => {
					const policy = new PermissionsPolicy({
						origin: OH,
						headerValue: header,
						defaultAllowlist: { fullscreen: `'self'` },
					}).inherit({ allow, origin: OI });

					for (const [feature, exp] of Object.entries(cases)) {
						if (exp.allowed.length + exp.notAllowed.length === 0) {
							t.skip("no expectations");
						}
						for (const origin of exp.allowed) {
							allowed(policy, feature, origin ?? undefined);
						}
						for (const origin of exp.notAllowed) {
							notAllowed(policy, feature, origin ?? undefined);
						}
					}
				});
			}
		});
	});
});

function allowed(policy: PermissionsPolicy, feature: string, origin?: string) {
	ok(
		policy.allowsFeature(feature, origin),
		`should allow ${getOriginName(origin)} origin`,
	);
}

function notAllowed(
	policy: PermissionsPolicy,
	feature: string,
	origin?: string,
) {
	ok(
		!policy.allowsFeature(feature, origin),
		`should not allow ${getOriginName(origin)} origin`,
	);
}

function getOriginName(origin?: string) {
	switch (origin) {
		case OH:
			return "host";
		case OI:
			return "iframe";
		case OT:
			return "other";
		default:
			return "default";
	}
}
