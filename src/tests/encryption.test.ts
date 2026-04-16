import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptSecretValue,
  decryptSecretValue,
  maskSecretValue,
} from "../utils/crypto/encryption.js";

process.env.CONFIG_MASTER_KEY =
  process.env.CONFIG_MASTER_KEY || "test-master-key";

test("encrypts and decrypts secrets", () => {
  const value = "secret-value-1234";
  const encrypted = encryptSecretValue(value);
  assert.notEqual(encrypted, value);

  const decrypted = decryptSecretValue(encrypted);
  assert.equal(decrypted, value);

  const masked = maskSecretValue(value);
  assert.equal(masked, "****1234");
});
