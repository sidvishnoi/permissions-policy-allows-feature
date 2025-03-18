import { ok } from "node:assert/strict";
import { describe, it } from "node:test";
import { PermissionsPolicy } from "../src/index.ts";

const OH = "https://sidvishnoi.com";
const OI = "https://example.com";
const OT = "https://www.example.org";

const feature = "fullscreen";

type Origin = typeof OH | typeof OI | typeof OT;
type TestOrigin = null | Origin;

type TestCase = {
	name?: string;
	headerValue: string;
	expectations: { allowed: TestOrigin[]; notAllowed: TestOrigin[] };
	allow?: string;
};

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

	describe("with header provided", () => {
		const testCases: TestCase[] = [
			{
				headerValue: "*",
				expectations: { allowed: [null, OH, OI], notAllowed: [] },
			},
			{
				headerValue: "self",
				expectations: { allowed: [null, OH], notAllowed: [OI] },
			},
			{
				headerValue: "(self)",
				expectations: { allowed: [null, OH], notAllowed: [OI] },
			},
			{
				headerValue: "()",
				expectations: { allowed: [], notAllowed: [null, OH, OI] },
			},
			{
				headerValue: `"${OH}"`,
				expectations: { allowed: [null, OH], notAllowed: [OI] },
			},
			{
				headerValue: `"${OI}"`,
				expectations: { allowed: [OI], notAllowed: [null, OH] },
			},
			{
				headerValue: `("${OI}")`,
				expectations: { allowed: [OI], notAllowed: [null, OH] },
			},
			{
				headerValue: `(self "${OI}")`,
				expectations: { allowed: [null, OH, OI], notAllowed: [] },
			},
			{
				headerValue: `(self "${OH}")`,
				expectations: { allowed: [null, OH], notAllowed: [OI] },
			},
			{
				headerValue: `(self "${OT}")`,
				expectations: { allowed: [null, OH], notAllowed: [OI] },
			},
		];
		for (const { headerValue: header, expectations } of testCases) {
			it(`Permissions-Policy: fullscreen=${header}`, () => {
				const policy = new PermissionsPolicy({
					origin: OH,
					headerValue: `fullscreen=${header}`,
					defaultAllowlist: { fullscreen: `'self'` },
				});
				for (const origin of expectations.allowed) {
					allowed(policy, "fullscreen", origin ?? undefined);
				}
				for (const origin of expectations.notAllowed) {
					notAllowed(policy, "fullscreen", origin ?? undefined);
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
			const testCases: TestCase[] = [
				{
					name: "no allow attribute, headers allow everything",
					headerValue: "*",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					headerValue: "self",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					headerValue: `"${OI}"`,
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					headerValue: "()",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					headerValue: `"${OH}"`,
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
			];
			for (const { headerValue: header, expectations: exp } of testCases) {
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

		describe("allow attribute provided", () => {
			const testCases: TestCase[] = [
				{
					name: "subset of header",
					headerValue: "fullscreen=*",
					allow: "fullscreen *",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					name: "header too strict but allow *",
					headerValue: "fullscreen=()",
					allow: "fullscreen *",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header too strict and allow src",
					headerValue: "fullscreen=()",
					allow: "fullscreen 'src'",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header only allow self, allow as default-empty",
					headerValue: "fullscreen=(self)",
					allow: "fullscreen;",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					name: "header allow self + 1 #1",
					headerValue: `fullscreen=(self "${OH}")`,
					allow: "fullscreen",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					name: "header allow self + 1 #2",
					headerValue: `fullscreen=(self "${OI}")`,
					allow: "fullscreen",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					name: "header allow other only #1",
					headerValue: `fullscreen=("${OI}")`,
					allow: "fullscreen",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					name: "header allow other only #2",
					headerValue: `fullscreen=("${OT}")`,
					allow: "fullscreen",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header allow many, iframe restricts #1",
					headerValue: "fullscreen=*",
					allow: `fullscreen ${OT};`,
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header allow many, iframe restricts #2",
					headerValue: `fullscreen=(self "${OI}" "${OT}")`,
					allow: `fullscreen ${OI}`,
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
			];

			for (const {
				name,
				headerValue: header,
				allow = "",
				expectations: exp,
			} of testCases) {
				it(`${name} {Permissions-Policy: ${header} & allow=${allow}}`, (t) => {
					if (exp.allowed.length + exp.notAllowed.length === 0) {
						t.skip("no expectations");
					}

					const policy = new PermissionsPolicy({
						origin,
						headerValue: header,
						defaultAllowlist: { fullscreen: `'self'` },
					}).inherit({ allow, origin });

					for (const origin of exp.allowed) {
						allowed(policy, feature, origin ?? undefined);
					}
					for (const origin of exp.notAllowed) {
						notAllowed(policy, feature, origin ?? undefined);
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
			const testCases: TestCase[] = [
				{
					name: "no allow attribute, headers allow everything",
					headerValue: "*",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					headerValue: "self",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					headerValue: `"${OH}"`,
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					headerValue: "()",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					headerValue: `"${OI}"`,
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
			];
			for (const { headerValue: header, expectations } of testCases) {
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

		describe("allow attribute provided", () => {
			const testCases: TestCase[] = [
				{
					name: "subset of header",
					headerValue: "fullscreen=*",
					allow: "fullscreen *",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					name: "subset of header",
					headerValue: "fullscreen=()",
					allow: "",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header too strict - disallow everything #1",
					headerValue: "fullscreen=()",
					allow: "fullscreen *;",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header too strict - disallow everything  #2",
					headerValue: "fullscreen=()",
					allow: "fullscreen 'src'",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header only allow self, allow=src",
					headerValue: "fullscreen=(self)",
					allow: "fullscreen;",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header allow self + 1 #1",
					headerValue: `fullscreen=(self "${OH}")`,
					allow: "fullscreen",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header allow self + 1 #2",
					headerValue: `fullscreen=(self "${OI}")`,
					allow: "fullscreen",
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
				{
					name: "header allow other only #1",
					headerValue: `fullscreen=("${OH}")`,
					allow: "fullscreen;",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header allow other only #2",
					headerValue: `fullscreen=("${OT}")`,
					allow: "fullscreen",
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header allow many, iframe restricts #1",
					headerValue: "fullscreen=*",
					allow: `fullscreen ${OT};`,
					expectations: { allowed: [], notAllowed: [null, OI, OH, OT] },
				},
				{
					name: "header allow many, iframe restricts #2",
					headerValue: `fullscreen=(self "${OI}" "${OT}")`,
					allow: `fullscreen ${OI}`,
					expectations: { allowed: [null, OI], notAllowed: [OH, OT] },
				},
			];

			for (const {
				name,
				headerValue,
				allow = "",
				expectations: exp,
			} of testCases) {
				it(`${name} {Permissions-Policy: ${headerValue} & allow=${allow}}`, (t) => {
					const policy = new PermissionsPolicy({
						origin: OH,
						headerValue,
						defaultAllowlist: { fullscreen: `'self'` },
					}).inherit({ allow, origin: OI });

					if (exp.allowed.length + exp.notAllowed.length === 0) {
						t.skip("no expectations");
					}
					for (const origin of exp.allowed) {
						allowed(policy, feature, origin ?? undefined);
					}
					for (const origin of exp.notAllowed) {
						notAllowed(policy, feature, origin ?? undefined);
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
