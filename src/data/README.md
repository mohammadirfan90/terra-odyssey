# Terra Odyssey — Data boundary

Adapters are the only code allowed to know product-specific field names, scale
factors, QA bits, time support, and source URLs. Each adapter must implement the
contract described in `docs/DATA_CATALOG.md` and emit a validated manifest.

