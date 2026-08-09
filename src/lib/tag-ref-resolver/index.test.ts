import { describe, expect, it } from "vitest";

import { findTagByPath, isTagRawId } from "./index.ts";

// FILE: src/lib/tag-ref-resolver/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify nested tag path resolution and raw-id detection.
//   SCOPE: Pure path walking over flat tag lists.
//   DEPENDS: vitest, src/lib/tag-ref-resolver/index.ts
//   LINKS: V-M-TAG-REF-RESOLVER, M-TAG-REF-RESOLVER
// END_MODULE_CONTRACT

const tags = [
  { id: "A-1", title: "PTP", parent: "", removed: false },
  { id: "A-2", title: "state", parent: "A-1", removed: false },
  { id: "A-3", title: "waiting", parent: "A-2", removed: false },
  { id: "A-4", title: "req", parent: "A-1", removed: false },
  { id: "A-5", title: "laptop", parent: "A-4", removed: false },
  { id: "A-6", title: "removed-tag", parent: "A-1", removed: true },
];

describe("isTagRawId", () => {
  it("detects raw A- ids", () => {
    expect(isTagRawId("A-ed073cca-dc6")).toBe(true);
    expect(isTagRawId("state/waiting")).toBe(false);
    expect(isTagRawId("waiting")).toBe(false);
  });
});

describe("findTagByPath", () => {
  it("resolves a two-level nested path", () => {
    expect(findTagByPath(tags, "state/waiting")).toEqual(tags[2]);
  });

  it("resolves a three-level nested path", () => {
    expect(findTagByPath(tags, "PTP/req/laptop")).toEqual(tags[4]);
  });

  it("returns undefined for a missing path", () => {
    expect(findTagByPath(tags, "state/nope")).toBeUndefined();
    expect(findTagByPath(tags, "nope/x/y")).toBeUndefined();
  });

  it("ignores removed tags", () => {
    expect(findTagByPath(tags, "PTP/removed-tag")).toBeUndefined();
  });

  it("resolves a bare title", () => {
    expect(findTagByPath(tags, "waiting")).toEqual(tags[2]);
  });
});
