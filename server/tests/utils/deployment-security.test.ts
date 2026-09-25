import { afterEach, describe, expect, it } from "vitest";
import { runtimeDeploymentChangesAllowed } from "../../api-routes/deployment";

describe("runtime deployment change gate", () => {
  const original = process.env.ALLOW_RUNTIME_DEPLOYMENT_CHANGES;
  afterEach(() => {
    if (original === undefined) delete process.env.ALLOW_RUNTIME_DEPLOYMENT_CHANGES;
    else process.env.ALLOW_RUNTIME_DEPLOYMENT_CHANGES = original;
  });

  it("is closed by default and only accepts the exact true value", () => {
    delete process.env.ALLOW_RUNTIME_DEPLOYMENT_CHANGES;
    expect(runtimeDeploymentChangesAllowed()).toBe(false);
    process.env.ALLOW_RUNTIME_DEPLOYMENT_CHANGES = "TRUE";
    expect(runtimeDeploymentChangesAllowed()).toBe(false);
    process.env.ALLOW_RUNTIME_DEPLOYMENT_CHANGES = "true";
    expect(runtimeDeploymentChangesAllowed()).toBe(true);
  });
});
