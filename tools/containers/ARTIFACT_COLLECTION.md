# Kit Artifact Collection for Containerized Applications

Automatically uploads Kit logs and metadata to cloud storage when a containerized Kit application exits. Supports Azure Blob Storage, AWS S3, and Google Cloud Storage with configurable path templates.

## Configuration

Configure via NVCF secrets or environment variables.

### Required Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `ARTIFACT_STORAGE_URI` | Cloud storage destination URI | `s3://my-bucket`, `az://my-container`, `gs://my-bucket` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ARTIFACT_PATH_TEMPLATE` | Path template with variable substitution | `{NVCF_FUNCTION_NAME}/{session_id}` |
| `ARTIFACT_MAX_FILE_SIZE_MB` | Maximum file size in MB for uploads | `512` |
| `ARTIFACT_UPLOAD_ON_ERROR_ONLY` | Upload artifacts only when exit code is non-zero | `false` |

### Cloud Provider Credentials

#### Azure Blob Storage
```bash
ARTIFACT_STORAGE_URI=az://my-container
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
```

#### AWS S3
```bash
ARTIFACT_STORAGE_URI=s3://my-bucket
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-west-2
```

#### Google Cloud Storage

**Option 1: Using a credentials file path**
```bash
ARTIFACT_STORAGE_URI=gs://my-bucket
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

**Option 2: Using NVCF secrets (JSON content as string)**
```bash
ARTIFACT_STORAGE_URI=gs://my-bucket
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"my-project",...}'
```

The script will automatically write the JSON content to a temporary file and configure the credentials.

## Path Templates

The `ARTIFACT_PATH_TEMPLATE` uses Python format syntax with these variables:

### Available Variables

#### NVCF Environment Variables
All NVCF variables are automatically available:

| Variable | Description |
|----------|-------------|
| `{NVCF_FUNCTION_ID}` | Unique function identifier |
| `{NVCF_FUNCTION_NAME}` | Function name |
| `{NVCF_FUNCTION_VERSION_ID}` | Function version identifier |
| `{NVCF_NCA_ID}` | Organization's NCA ID |
| `{NVCF_BACKEND}` | Backend/cluster group |
| `{NVCF_INSTANCETYPE}` | Instance type |
| `{NVCF_REGION}` | Deployment region |
| `{NVCF_ENV}` | Spot environment (if applicable) |
| `{NVCF_REQID}` | Request ID (also used as session_id) |

#### Helper Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{session_id}` | NVCF request ID or fallback identifier | `abc-123-def-456` |
| `{date}` | Current date | `2025-12-09` |
| `{datetime}` | Current date and time | `2025-12-09_14-30-15` |
| `{hostname}` | Container hostname | `nvcf-pod-12345` |

### Path Template Examples

#### Default (Simple organization by function name)
```bash
# Default (simple organization by function name)
ARTIFACT_PATH_TEMPLATE={NVCF_FUNCTION_NAME}/{session_id}

# Multi-level organization
ARTIFACT_PATH_TEMPLATE={NVCF_FUNCTION_ID}/{NVCF_FUNCTION_VERSION_ID}/{NVCF_REGION}/{session_id}

# Project-based organization
ARTIFACT_PATH_TEMPLATE=my-project/prod/{NVCF_REGION}/{datetime}

# Simple session ID
ARTIFACT_PATH_TEMPLATE={session_id}
```

## Complete Example

```bash
# Required
ARTIFACT_STORAGE_URI=s3://my-kit-artifacts-bucket

# Optional
ARTIFACT_PATH_TEMPLATE={NVCF_FUNCTION_NAME}/v{NVCF_FUNCTION_VERSION_ID}/{NVCF_REGION}/{date}/{session_id}
ARTIFACT_MAX_FILE_SIZE_MB=512  # Skip files larger than 512 MB
ARTIFACT_UPLOAD_ON_ERROR_ONLY=false  # Set to true to only upload on errors/failures

# AWS credentials
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-west-2
```

**Result:** Uploads Kit logs, profiler traces, and metadata to structured paths like:
```
s3://my-kit-artifacts-bucket/my-function/v123/us-west-2/2025-12-09/req-789xyz/
├── metadata.json
├── kit_20251209_143015.log
└── ct-profile_2025-12-09_14-30-45.json.gz
```

## Notes

- Artifacts are uploaded on container exit (normal or signal-terminated)
- The most recent Kit log from `~/.nvidia-omniverse/logs/Kit/` is uploaded
- Profiler traces (chrome tracing format) are automatically detected and uploaded if present
- Files exceeding the size limit (default 512 MB) are skipped and recorded in `metadata.json`
- A `metadata.json` file includes NVCF context, exit code, and file information
- Upload failures are logged but don't prevent container exit
- Check container logs for `[ARTIFACT_COLLECTOR]` messages
- When `ARTIFACT_UPLOAD_ON_ERROR_ONLY` is enabled:
  - Uploads occur only when exit code is non-zero (errors, crashes, or signal termination)
  - Exit code 0 (successful completion) skips artifact upload to save storage costs
  - Signal termination (SIGTERM, SIGINT) results in non-zero exit codes and triggers upload