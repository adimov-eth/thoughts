# Changelog

## v0.4.0-alpha

- **Breaking:** `hashFrame` now uses `@noble/hashes` with a zero-copy hex
  conversion. All previous frame hashes are invalid and devnet nodes must
  wipe state before upgrading.
