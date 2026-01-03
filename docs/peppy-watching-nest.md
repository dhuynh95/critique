# File Storage Abstraction: Local + S3 Unified Interface

## Context

### Why This Matters
The invoice processing system needs to store PDF files. Currently it only supports local filesystem. For production, we need S3 support without changing any calling code.

### Current State

**Python (`evals/invoices/file_storage.py`)**:
- `FileStorageProtocol` with 3 async methods: `save_invoice`, `get_invoice`, `invoice_exists`
- `LocalFileStorage` implementation using pathlib directly
- `fsspec` is imported but **not used** (missed opportunity)
- Extra `get_invoice_path()` method exists but not in Protocol

**TypeScript (`app/src/lib/invoices/file-storage.ts`)**:
- Mirror interface with same 3 methods
- `LocalFileStorage` implementation
- Singleton factory pattern

**Existing S3 usage (`server/storage_s3.py`)**:
- Uses `aioboto3` directly for recordings/proofs
- Dedicated bucket per domain pattern

**Usage locations**:
- `evals/invoices/process.py:222` - `file_storage.save_invoice()`
- `evals/invoices/processing_server.py` - dependency injection throughout
- `app/src/lib/api/invoices.server.ts` - TypeScript API layer

### Current Directory Structure
```
evals/invoices/data/current/
  ├── db/           ← JSON store (accounts, transactions, vendors)
  └── files/        ← rename to "invoices/" for 1:1 S3 mapping
      ├── uber/
      │   └── 2025-10-01_15.90_USD_Uber.pdf
      ├── lyft/
      └── ...
```

### Target Directory Structure
```
evals/invoices/data/current/
  ├── db/           ← unchanged
  └── invoices/     ← matches s3://conception-invoices/
      ├── uber/
      └── ...
```

---

## Key Insight: S3 is Flat + Dedicated Buckets Per Domain

S3 has only two real concepts:
1. **Bucket** - the container
2. **Key** - a flat string (e.g., `"uber/invoice.pdf"`)

"Folders" don't exist - they're just key prefixes with `/` delimiter.

**Production bucket pattern in this codebase:**
- `S3_RECORDINGS_BUCKET` → recordings/traces
- `AWS_AUTOMATIONS_BUCKET` → automations
- `AWS_EXTENSION_BUCKET` → extension zips
- `S3_INVOICES_BUCKET` → **invoice PDFs (new)**

Pattern: **dedicated buckets per domain**, not prefixes within shared bucket.

---

## Solution: Leverage fsspec

`fsspec` (already a dependency) provides unified filesystem interface. `s3fs` implements it for S3.

```python
# Same code, different backends:
fsspec.open("file:///local/path/file.pdf", "wb")
fsspec.open("s3://bucket/path/file.pdf", "wb")
```

### Unified Path Convention

```
Local:  {data_root}/invoices/{vendor}/{file}
S3:     s3://conception-invoices/{vendor}/{file}

Example:
Local:  file:///Users/.../data/current/invoices/uber/inv.pdf
S3:     s3://conception-invoices/uber/inv.pdf
```

**1:1 mapping**: Local `invoices/` = S3 `conception-invoices` bucket. Same name, same structure.

The abstraction: **base_url** + `/{vendor_slug}/{filename}`

---

## Proposed Interface

### Protocol (unchanged shape, clarified semantics)

```python
# evals/invoices/file_storage.py

class FileStorageProtocol(Protocol):
    """Async file storage for invoice PDFs. Backend-agnostic."""

    async def save_invoice(self, vendor_slug: str, filename: str, data: bytes) -> str:
        """Save invoice. Returns the full path/URL."""
        ...

    async def get_invoice(self, vendor_slug: str, filename: str) -> bytes:
        """Read invoice bytes."""
        ...

    async def invoice_exists(self, vendor_slug: str, filename: str) -> bool:
        """Check if invoice exists."""
        ...
```

**Note**: Remove `get_invoice_path()` from implementation - it's local-only and breaks abstraction. Callers needing to serve files should use `get_invoice()` and stream bytes.

### Single Implementation Using fsspec

```python
class FsspecFileStorage:
    """Unified file storage using fsspec. Works with local, S3, or any fsspec backend."""

    def __init__(self, base_url: str, storage_options: dict | None = None):
        """
        Args:
            base_url: Base path/URL. Examples:
                - "file:///path/to/data/current/invoices"
                - "s3://conception-invoices"
            storage_options: Backend-specific options (S3 credentials, etc.)
        """
        self.base_url = base_url.rstrip("/")
        self.storage_options = storage_options or {}

    def _path(self, vendor_slug: str, filename: str) -> str:
        return f"{self.base_url}/{vendor_slug}/{filename}"

    async def save_invoice(self, vendor_slug: str, filename: str, data: bytes) -> str:
        path = self._path(vendor_slug, filename)
        # fsspec handles directory creation for S3; local needs parent mkdir
        with fsspec.open(path, "wb", **self.storage_options) as f:
            f.write(data)
        return path

    async def get_invoice(self, vendor_slug: str, filename: str) -> bytes:
        path = self._path(vendor_slug, filename)
        with fsspec.open(path, "rb", **self.storage_options) as f:
            return f.read()

    async def invoice_exists(self, vendor_slug: str, filename: str) -> bool:
        path = self._path(vendor_slug, filename)
        fs, path_in_fs = fsspec.core.url_to_fs(path, **self.storage_options)
        return fs.exists(path_in_fs)
```

### Factory Function

```python
def create_file_storage(base_url: str | None = None) -> FileStorageProtocol:
    """Factory: returns storage backend based on ENV.

    Args:
        base_url: Override base URL (for testing). Examples:
            - "file:///path/to/files"
            - "s3://test-bucket"
            If None, uses ENV config.

    Returns:
        FileStorageProtocol implementation
    """
    if base_url:
        # Explicit override (testing, custom paths)
        return FsspecFileStorage(base_url=base_url)

    if os.getenv("ENV") == "production":
        bucket = os.getenv("S3_INVOICES_BUCKET")  # NEW dedicated bucket
        return FsspecFileStorage(
            base_url=f"s3://{bucket}",
            storage_options={
                "key": os.getenv("AWS_ACCESS_KEY_ID"),
                "secret": os.getenv("AWS_SECRET_ACCESS_KEY"),
                "client_kwargs": {"region_name": os.getenv("AWS_REGION")},
            }
        )
    else:
        # Local development: invoices/ mirrors S3 bucket
        local_path = Path("evals/invoices/data/current/invoices").absolute()
        return FsspecFileStorage(base_url=f"file://{local_path}")
```

---

## Files to Modify

| File | Change |
|------|--------|
| `evals/invoices/file_storage.py` | Replace `LocalFileStorage` with `FsspecFileStorage`, update factory |
| `requirements.txt` | Add `s3fs` (fsspec S3 backend) |
| `.env.example` | Add `S3_INVOICES_BUCKET` |
| `evals/invoices/data/*/files/` | Rename to `invoices/` |
| `app/src/lib/invoices/config.server.ts` | Change `files` → `invoices` in path |

**No changes needed in**:
- `process.py` - already uses Protocol
- `processing_server.py` - already uses dependency injection
- Any other consumers - they use the factory

---

## Migration Notes

### Directory Rename: `files/` → `invoices/`
```bash
mv evals/invoices/data/current/files evals/invoices/data/current/invoices
mv evals/invoices/data/test/files evals/invoices/data/test/invoices  # if exists
```

Now 1:1 mapping:
```
Local:  data/current/invoices/uber/invoice.pdf
S3:     s3://conception-invoices/uber/invoice.pdf
```

### New Environment Variable
```bash
# Production
S3_INVOICES_BUCKET=conception-invoices
```

### TypeScript Decision
Keep TS local-only. The SvelteKit API layer (`invoices.server.ts`) serves bytes via `getInvoice()`. No direct S3 access needed from frontend.

### Testing
Existing test pattern with fixtures handles this - swap implementation in conftest.py fixture, tests unchanged.

```python
# conftest.py
@pytest.fixture
def create_file_storage() -> FileStorageFactory:
    # Point to test directory
    return lambda: FsspecFileStorage(base_url="file:///tmp/test-invoices")
```

---

## Summary

**Before**:
- `LocalFileStorage` using pathlib directly
- `fsspec` imported but unused
- No S3 support

**After**:
- Single `FsspecFileStorage` class (~30 lines)
- Backend determined by URL scheme (`file://` vs `s3://`)
- Zero calling code changes
- New dedicated bucket: `S3_INVOICES_BUCKET`

**Key principle**: Let fsspec do what it was designed for.
